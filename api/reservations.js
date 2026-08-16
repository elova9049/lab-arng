"use strict";

const {
  fetchAllReservationRecords,
  fetchEquipmentReservationRecords,
  intervalsOverlap,
  createReservationPage,
} = require("./_notion");
const EQUIPMENT_OPTIONS = require("./_equipment");

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

      const existing = await fetchEquipmentReservationRecords(equipment);
      const conflicts = existing.filter((record) =>
        intervalsOverlap(startMs, endMs, record.startMs, record.endMs)
      );

      if (conflicts.length > 0) {
        const nextAvailableMs = Math.max(...conflicts.map((record) => record.endMs));
        res.status(409).json({
          error: "선택한 시간에 이미 예약이 존재합니다.",
          nextAvailable: new Date(nextAvailableMs).toISOString(),
        });
        return;
      }

      const page = await createReservationPage({
        name: trimmedName,
        equipment,
        startIso: start,
        endIso: end,
      });

      res.status(201).json({ ok: true, id: page.id });
      return;
    }

    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    res.status(500).json({ error: err.message || "서버 오류가 발생했습니다." });
  }
};
