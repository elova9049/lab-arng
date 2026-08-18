"use strict";

const {
  fetchAllReservationRecords,
  fetchEquipmentReservationRecords,
  createReservation,
  deleteReservation,
} = require("./_db");
const EQUIPMENT_OPTIONS = require("./_equipment");

function intervalsOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const records = await fetchAllReservationRecords();
      res.status(200).json({ records });
      return;
    }

    if (req.method === "POST") {
      const { name, equipment, start, end } = req.body || {};

      const trimmedName = typeof name === "string" ? name.trim() : "";
      if (!trimmedName) {
        res.status(400).json({ error: "예약자 이름을 입력해주세요." });
        return;
      }

      if (!EQUIPMENT_OPTIONS.includes(equipment)) {
        res.status(400).json({ error: "유효하지 않은 장비입니다." });
        return;
      }

      const startMs = Date.parse(start);
      const endMs = Date.parse(end);
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) {
        res.status(400).json({ error: "유효하지 않은 예약 시간입니다." });
        return;
      }

      try {
        const created = await createReservation({
          name: trimmedName,
          equipment,
          startIso: new Date(startMs).toISOString(),
          endIso: new Date(endMs).toISOString(),
        });
        res.status(201).json({ ok: true, id: created.id });
      } catch (err) {
        if (!err.isConflict) throw err;

        // The database rejected the insert as overlapping (source of
        // truth). Re-read this equipment's bookings just to compute a
        // helpful "try again after" time for the notice.
        const existing = await fetchEquipmentReservationRecords(equipment);
        const conflicts = existing.filter((record) =>
          intervalsOverlap(startMs, endMs, Date.parse(record.start), Date.parse(record.end))
        );
        const nextAvailableMs = conflicts.length
          ? Math.max(...conflicts.map((record) => Date.parse(record.end)))
          : endMs;

        res.status(409).json({
          error: "선택한 시간에 이미 예약이 존재합니다.",
          nextAvailable: new Date(nextAvailableMs).toISOString(),
        });
      }
      return;
    }

    if (req.method === "DELETE") {
      const id = Number(req.query?.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "유효하지 않은 예약 id입니다." });
        return;
      }

      const deleted = await deleteReservation(id);
      if (!deleted) {
        res.status(404).json({ error: "해당 예약을 찾을 수 없습니다." });
        return;
      }

      res.status(200).json({ ok: true });
      return;
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    res.status(500).json({ error: err.message || "서버 오류가 발생했습니다." });
  }
};
