"use strict";

// Shared Notion REST helpers for the reservation API routes.
//
// Raw fetch() is used instead of the @notionhq/client SDK so the functions
// stay dependency-free (Vercel's Node runtime ships a global fetch), and so
// the exact data-sources flow documented in CLAUDE.md is easy to follow:
//   1. GET  /v1/databases/{database_id}        -> data_sources[0].id
//   2. POST /v1/data_sources/{data_source_id}/query
// Querying /v1/databases/{id}/query directly is deprecated as of API
// version 2025-09-03 and will fail.

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2025-09-03";

const TAG_PROPERTY = "태그";
const NAME_PROPERTY = "이름";
const DATE_PROPERTY = "날짜";

function getEnv(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

async function notionFetch(path, options = {}) {
  const response = await fetch(`${NOTION_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getEnv("NOTION_TOKEN")}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message || `Notion API error (${response.status})`);
  }
  return body;
}

// Data source ids don't change during a single function invocation, and
// rarely change at all, so a per-instance cache avoids an extra round trip
// on every request without risking stale data across deploys (cold starts
// clear it naturally).
let cachedDataSourceId = null;

async function resolveDataSourceId() {
  if (cachedDataSourceId) {
    return cachedDataSourceId;
  }

  const databaseId = getEnv("DATABASE_ID");
  const database = await notionFetch(`/databases/${databaseId}`, { method: "GET" });
  const dataSources = database.data_sources || [];
  if (dataSources.length === 0) {
    throw new Error(`No data sources found for database ${databaseId}`);
  }

  cachedDataSourceId = dataSources[0].id;
  return cachedDataSourceId;
}

async function queryReservationPages(filter) {
  const dataSourceId = await resolveDataSourceId();
  const pages = [];
  let cursor;

  do {
    const body = {};
    if (filter) body.filter = filter;
    if (cursor) body.start_cursor = cursor;

    const response = await notionFetch(`/data_sources/${dataSourceId}/query`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    pages.push(...(response.results || []));
    cursor = response.has_more ? response.next_cursor : null;
  } while (cursor);

  return pages;
}

function extractPageName(prop) {
  if (!prop || prop.type !== "title") return "Unknown";
  const titleParts = prop.title || [];
  if (titleParts.length === 0) return "Unknown";
  return titleParts[0].plain_text || titleParts[0].text?.content || "Unknown";
}

function extractEquipmentTags(prop) {
  if (!prop || prop.type !== "multi_select") return [];
  return (prop.multi_select || []).map((item) => item.name).filter(Boolean);
}

function extractInterval(prop) {
  if (!prop || prop.type !== "date" || !prop.date || !prop.date.start) return null;
  const start = prop.date.start;
  const end = prop.date.end || start;
  return { start, end };
}

function parseReservationRecords(page) {
  const properties = page.properties || {};
  const interval = extractInterval(properties[DATE_PROPERTY]);
  if (!interval) return [];

  const name = extractPageName(properties[NAME_PROPERTY]);
  const tags = extractEquipmentTags(properties[TAG_PROPERTY]);
  const startMs = Date.parse(interval.start);
  const endMs = Date.parse(interval.end);

  return tags.map((equipment) => ({
    name,
    equipment,
    start: interval.start,
    end: interval.end,
    startMs,
    endMs,
  }));
}

async function fetchAllReservationRecords() {
  const pages = await queryReservationPages();
  const records = pages.flatMap(parseReservationRecords);
  records.sort((a, b) => a.startMs - b.startMs);
  return records;
}

async function fetchEquipmentReservationRecords(equipment) {
  const filter = {
    property: TAG_PROPERTY,
    multi_select: { contains: equipment },
  };
  const pages = await queryReservationPages(filter);
  const records = pages
    .flatMap(parseReservationRecords)
    .filter((record) => record.equipment === equipment);
  records.sort((a, b) => a.startMs - b.startMs);
  return records;
}

function intervalsOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

async function createReservationPage({ name, equipment, startIso, endIso }) {
  const databaseId = getEnv("DATABASE_ID");
  const properties = {
    [NAME_PROPERTY]: { title: [{ text: { content: name } }] },
    [TAG_PROPERTY]: { multi_select: [{ name: equipment }] },
    [DATE_PROPERTY]: { date: { start: startIso, end: endIso } },
  };

  return notionFetch("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { type: "database_id", database_id: databaseId },
      properties,
    }),
  });
}

module.exports = {
  fetchAllReservationRecords,
  fetchEquipmentReservationRecords,
  intervalsOverlap,
  createReservationPage,
};
