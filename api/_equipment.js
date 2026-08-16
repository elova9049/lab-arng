"use strict";

// Equipment catalog — keep in sync with js/app.js's EQUIPMENT_OPTIONS.
// Values are stored verbatim (management-number suffix included) in the
// Notion multi_select property, so this list is the source of truth for
// what's a valid equipment name on both the client and the server.
const EQUIPMENT_OPTIONS = [
  "Battery test system #1 (연구소-005)",
  "Battery test system #2 (연구소-006)",
  "Battery test system #3 (연구소-011)",
  "Battery test system #4 (연구소-012)",
  "항온 항습 chamber (연구소-010)",
  "항온 항습 chamber (연구소-016)",
  "강제 순환 오븐 #1 (연구소-015)",
  "강제 순환 오븐 #2 (연구소-018)",
  "강제 순환 오븐 #3 (연구소-019)",
  "강제 순환 오븐 #4 (연구소-020)",
  "강제 순환 오븐 #5 (연구소-021)",
  "자기방전시험기 (연구소-001)",
  "누설 전류 측정기 (연구소-002)",
  "저항 충,방전 cycler (연구소-003)",
  "용량 및 cycle 측정기 (연구소-013)",
  "AC HITESTER_ESR측정 (연구소-017)",
];

module.exports = EQUIPMENT_OPTIONS;
