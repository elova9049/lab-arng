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
      // Used to hash the cancel password with bcrypt (crypt/gen_salt) so
      // verification happens in a single atomic query instead of the app
      // fetching a hash and comparing it in JS.
      await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
      await sql`
        CREATE TABLE IF NOT EXISTS reservations (
          id BIGSERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          equipment TEXT NOT NULL,
          start_time TIMESTAMPTZ NOT NULL,
          end_time TIMESTAMPTZ NOT NULL,
          password_hash TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT reservations_no_overlap EXCLUDE USING gist (
            equipment WITH =,
            tstzrange(start_time, end_time) WITH &&
          )
        )
      `;
      // Covers deployments where the table already existed before
      // password_hash was added — CREATE TABLE IF NOT EXISTS above is a
      // no-op against an existing table, so the column has to be added
      // separately.
      await sql`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS password_hash TEXT`;
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
    id: row.id,
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
    SELECT id, name, equipment, start_time, end_time
    FROM reservations
    ORDER BY start_time ASC
  `;
  return rows.map(toRecord);
}

async function fetchEquipmentReservationRecords(equipment) {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT id, name, equipment, start_time, end_time
    FROM reservations
    WHERE equipment = ${equipment}
    ORDER BY start_time ASC
  `;
  return rows.map(toRecord);
}

// Used for both "cancel a not-yet-started reservation" and "end an
// in-progress one early" — the app has no history view, so there's no
// benefit to distinguishing the two at the data layer, only in the button
// label the UI shows.
//
// Returns "not_found" | "forbidden" | "deleted". Checked as a separate
// SELECT before the DELETE (rather than one conditional DELETE) purely so
// the caller can tell "wrong password" apart from "already gone" and
// respond with the right status code.
async function deleteReservation(id, password) {
  await ensureSchema();
  const sql = getSql();

  const [row] = await sql`
    SELECT (password_hash IS NULL OR password_hash = crypt(${password}, password_hash)) AS authorized
    FROM reservations
    WHERE id = ${id}
  `;
  if (!row) return "not_found";
  if (!row.authorized) return "forbidden";

  const rows = await sql`DELETE FROM reservations WHERE id = ${id} RETURNING id`;
  return rows.length > 0 ? "deleted" : "not_found";
}

async function createReservation({ name, equipment, startIso, endIso, password }) {
  await ensureSchema();
  const sql = getSql();
  try {
    const rows = await sql`
      INSERT INTO reservations (name, equipment, start_time, end_time, password_hash)
      VALUES (${name}, ${equipment}, ${startIso}, ${endIso}, crypt(${password}, gen_salt('bf', 8)))
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
  deleteReservation,
};
