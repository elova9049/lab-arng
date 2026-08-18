"use strict";

// Shared Postgres helpers for the reservation API routes.
//
// Uses @neondatabase/serverless (Neon's own driver), which talks to Neon's
// HTTP proxy instead of holding a persistent TCP connection — a better fit
// for serverless functions than a pooled driver. @vercel/postgres used to
// be the recommended wrapper for this but is now deprecated in favor of
// using Neon's driver directly; see
// https://neon.com/docs/guides/vercel-postgres-transition-guide
//
// Linking the Neon integration to the Vercel project (Storage tab) sets
// DATABASE_URL as a project environment variable automatically — no manual
// connection-string copying needed.
//
// Overlap prevention is enforced by the database itself via a GiST
// EXCLUDE constraint (see ensureSchema), not by an application-level
// check-then-insert — that closes the race window two simultaneous
// bookings could otherwise slip through.

const { neon } = require("@neondatabase/serverless");

// Postgres error code raised when an INSERT violates the EXCLUDE constraint.
const EXCLUSION_VIOLATION = "23P01";

let cachedSql = null;

function getSql() {
  if (!cachedSql) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("Missing required environment variable: DATABASE_URL");
    }
    cachedSql = neon(connectionString);
  }
  return cachedSql;
}

let schemaReady = null;

function ensureSchema() {
  if (!schemaReady) {
    const sql = getSql();
    schemaReady = (async () => {
      await sql`CREATE EXTENSION IF NOT EXISTS btree_gist`;
      await sql`
        CREATE TABLE IF NOT EXISTS reservations (
          id BIGSERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          equipment TEXT NOT NULL,
          start_time TIMESTAMPTZ NOT NULL,
          end_time TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT reservations_no_overlap EXCLUDE USING gist (
            equipment WITH =,
            tstzrange(start_time, end_time) WITH &&
          )
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS reservations_equipment_start_idx
          ON reservations (equipment, start_time)
      `;
    })().catch((err) => {
      // Let the next call retry schema setup instead of caching a failure.
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

function toRecord(row) {
  return {
    name: row.name,
    equipment: row.equipment,
    start: new Date(row.start_time).toISOString(),
    end: new Date(row.end_time).toISOString(),
  };
}

async function fetchAllReservationRecords() {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT name, equipment, start_time, end_time
    FROM reservations
    ORDER BY start_time ASC
  `;
  return rows.map(toRecord);
}

async function fetchEquipmentReservationRecords(equipment) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT name, equipment, start_time, end_time
    FROM reservations
    WHERE equipment = ${equipment}
    ORDER BY start_time ASC
  `;
  return rows.map(toRecord);
}

async function createReservation({ name, equipment, startIso, endIso }) {
  await ensureSchema();
  const sql = getSql();
  try {
    const rows = await sql`
      INSERT INTO reservations (name, equipment, start_time, end_time)
      VALUES (${name}, ${equipment}, ${startIso}, ${endIso})
      RETURNING id
    `;
    return { id: rows[0].id };
  } catch (err) {
    if (err.code === EXCLUSION_VIOLATION) {
      const conflictError = new Error("Reservation overlaps an existing one");
      conflictError.isConflict = true;
      throw conflictError;
    }
    throw err;
  }
}

module.exports = {
  fetchAllReservationRecords,
  fetchEquipmentReservationRecords,
  createReservation,
};
