(function () {
  "use strict";

  // Equipment catalog — keep in sync with api/_equipment.js.
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

  const EQUIPMENT_COLORS = [
    "#2b2b2b", "#3d5a80", "#5a4a6a", "#4a6a5a", "#6a4a4a", "#4a5a6a",
    "#5a6a4a", "#6a5a4a", "#4a4a6a", "#5a5a2b", "#2b5a5a", "#5a2b4a",
    "#4a3d5a", "#3d4a5a", "#5a3d3d", "#3d5a4a",
  ];

  const EQUIPMENT_COLOR_MAP = Object.fromEntries(
    EQUIPMENT_OPTIONS.map((name, index) => [name, EQUIPMENT_COLORS[index % EQUIPMENT_COLORS.length]])
  );

  const KST_TIME_ZONE = "Asia/Seoul";

  let allRecordsCache = null;
  let calendarInstance = null;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ---------- Tabs ----------
  function initTabs() {
    const buttons = document.querySelectorAll(".tab-btn");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
        if (btn.dataset.tab === "calendar") {
          renderCalendarTab();
        }
      });
    });
  }

  // ---------- Equipment selects ----------
  function populateEquipmentSelect() {
    const select = document.getElementById("equipment-select");
    select.innerHTML = EQUIPMENT_OPTIONS.map(
      (name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`
    ).join("");
  }

  function populateEquipmentFilter() {
    const container = document.getElementById("equipment-filter");
    container.innerHTML = EQUIPMENT_OPTIONS.map(
      (name) => `
        <label class="filter-chip">
          <input type="checkbox" value="${escapeHtml(name)}" checked />
          <span>${escapeHtml(name)}</span>
        </label>
      `
    ).join("");
    container.addEventListener("change", renderCalendarTab);
  }

  // ---------- Data fetching ----------
  async function fetchAllRecords(force) {
    if (allRecordsCache && !force) return allRecordsCache;
    const res = await fetch("/api/reservations");
    if (!res.ok) throw new Error("예약 현황을 불러오지 못했습니다.");
    const data = await res.json();
    allRecordsCache = data.records.map((record) => ({
      ...record,
      startDate: new Date(record.start),
      endDate: new Date(record.end),
    }));
    return allRecordsCache;
  }

  function formatKst(date) {
    const parts = new Intl.DateTimeFormat("ko-KR", {
      timeZone: KST_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value || "";
    return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
  }

  // ---------- Reservation status panel ----------
  function formatDurationKo(ms) {
    const totalMinutes = Math.max(0, Math.round(ms / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${minutes}분`;
    if (minutes === 0) return `${hours}시간`;
    return `${hours}시간 ${minutes}분`;
  }

  // Collapses back-to-back / overlapping reservations (e.g. one researcher's
  // slot ending exactly when the next one starts) into single busy blocks,
  // so the status badge reports the real wait time instead of just the
  // current reservation's end time.
  function mergeIntervals(records) {
    const blocks = [];
    for (const record of records) {
      const last = blocks[blocks.length - 1];
      if (last && record.startDate <= last.end) {
        if (record.endDate > last.end) last.end = record.endDate;
      } else {
        blocks.push({ start: record.startDate, end: record.endDate });
      }
    }
    return blocks;
  }

  // `records` is the equipment's active-or-upcoming reservations (already
  // filtered to endDate >= now), sorted by start ascending.
  function renderStatusBadge(records, now) {
    const blocks = mergeIntervals(records);
    const currentBlock = blocks.find((block) => block.start <= now && block.end > now);

    if (currentBlock) {
      const remaining = formatDurationKo(currentBlock.end - now);
      return `
        <div class="status-badge status-busy">
          <span class="status-dot"></span>
          <span class="status-text">사용 중 — ${formatKst(currentBlock.end)}까지 (약 ${remaining} 남음)</span>
        </div>
      `;
    }

    const upcomingBlock = blocks.find((block) => block.start > now);
    if (upcomingBlock) {
      const until = formatDurationKo(upcomingBlock.start - now);
      return `
        <div class="status-badge status-free">
          <span class="status-dot"></span>
          <span class="status-text">지금 사용 가능 — ${formatKst(upcomingBlock.start)}부터 예약 있음 (약 ${until} 후)</span>
        </div>
      `;
    }

    return `
      <div class="status-badge status-free">
        <span class="status-dot"></span>
        <span class="status-text">지금 사용 가능</span>
      </div>
    `;
  }

  async function renderReservationList() {
    const listEl = document.getElementById("reservation-list");
    const equipment = document.getElementById("equipment-select").value;
    listEl.innerHTML = `<p class="reservation-empty">불러오는 중...</p>`;

    try {
      const records = await fetchAllRecords();
      const now = new Date();
      const active = records
        .filter((record) => record.equipment === equipment && record.endDate >= now)
        .sort((a, b) => a.startDate - b.startDate);

      const statusHtml = renderStatusBadge(active, now);

      if (active.length === 0) {
        listEl.innerHTML = `${statusHtml}<p class="reservation-empty">No active reservations for this equipment.</p>`;
        return;
      }

      const itemsHtml = active
        .map((record) => {
          const cancelLabel = record.startDate <= now ? "지금 종료" : "예약 취소";
          return `
            <div class="reservation-item">
              <span class="reservation-text">
                <span class="reservation-name">${escapeHtml(record.name)}</span>
                <span class="reservation-period"> · ${formatKst(record.startDate)} → ${formatKst(record.endDate)}</span>
              </span>
              <button type="button" class="btn-cancel" data-id="${record.id}" data-label="${cancelLabel}">${cancelLabel}</button>
            </div>
          `;
        })
        .join("");
      listEl.innerHTML = statusHtml + itemsHtml;
    } catch (err) {
      listEl.innerHTML = `<p class="reservation-empty">${escapeHtml(err.message)}</p>`;
    }
  }

  // ---------- Calendar tab ----------
  function renderCalendarLegend(names) {
    const legend = document.getElementById("calendar-legend");
    legend.innerHTML = names
      .map(
        (name) => `
          <span class="calendar-legend-item">
            <span class="calendar-legend-swatch" style="background:${EQUIPMENT_COLOR_MAP[name] || "#6e6e6e"};"></span>
            ${escapeHtml(name)}
          </span>
        `
      )
      .join("");
  }

  async function renderCalendarTab() {
    const checked = Array.from(
      document.querySelectorAll("#equipment-filter input:checked")
    ).map((input) => input.value);
    const visibleNames = EQUIPMENT_OPTIONS.filter((name) => checked.includes(name));
    renderCalendarLegend(visibleNames);

    const calendarEl = document.getElementById("calendar");

    try {
      const records = await fetchAllRecords();
      const filtered = records.filter((record) => checked.includes(record.equipment));

      const events = filtered.map((record) => {
        const color = EQUIPMENT_COLOR_MAP[record.equipment] || "#6e6e6e";
        return {
          title: `${record.name} · ${record.equipment}`,
          start: record.start,
          end: record.end,
          backgroundColor: color,
          borderColor: color,
          textColor: "#ffffff",
          // Kept separate from `title` so eventContent can lay the two
          // out differently per view instead of splitting a joined string.
          extendedProps: { name: record.name, equipment: record.equipment },
        };
      });

      if (!calendarInstance) {
        calendarInstance = new FullCalendar.Calendar(calendarEl, {
          initialView: "dayGridMonth",
          locale: "ko",
          height: 680,
          timeZone: KST_TIME_ZONE,
          headerToolbar: {
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,listWeek",
          },
          eventDisplay: "block",
          dayMaxEvents: 4,
          moreLinkClick: "popover",
          events: [],
          // The ko locale's default day-number formatting (via Intl)
          // appends "일" to every cell (e.g. "16일"), which reads as
          // clutter in a compact month grid — just show the bare number.
          dayCellContent: function (arg) {
            return String(arg.date.getDate());
          },
          eventContent: function (arg) {
            const name = escapeHtml(arg.event.extendedProps.name || "");
            const equipment = escapeHtml(arg.event.extendedProps.equipment || "");

            // List view already gets a colored dot per row from
            // FullCalendar itself (see .fc-list-event-dot), so name/
            // equipment can just be plain, scannable text here instead of
            // repeating the color as a full chip — a long white-on-color
            // "이름 · 장비명" block is harder to read in a dense list.
            if (arg.view.type === "listWeek") {
              return {
                html: `<span class="lab-list-name">${name}</span><span class="lab-list-equipment"> · ${equipment}</span>`,
              };
            }

            const bg = arg.event.backgroundColor || "#2b2b2b";
            const border = arg.event.borderColor || bg;
            return {
              html: `<div class="lab-event-chip" style="background-color:${bg};border:1px solid ${border};color:#ffffff;">${name} · ${equipment}</div>`,
            };
          },
          eventDidMount: function (info) {
            info.el.style.background = "transparent";
            info.el.style.border = "none";
            info.el.style.boxShadow = "none";
          },
        });
        calendarInstance.render();
      }

      calendarInstance.removeAllEvents();
      calendarInstance.addEventSource(events);
    } catch (err) {
      calendarEl.innerHTML = `<p class="reservation-empty">${escapeHtml(err.message)}</p>`;
    }
  }

  // ---------- Form ----------
  function showNotice(message, variant) {
    const area = document.getElementById("notice-area");
    const label = variant === "success" ? "Result" : variant === "error" ? "Notice" : "Info";
    const cls = variant === "success" || variant === "error" ? variant : "";
    area.innerHTML = `
      <div class="notice-block ${cls}">
        <span class="notice-label">${label}</span>
        <p class="notice-text">${escapeHtml(message)}</p>
      </div>
    `;
  }

  function clearNotice() {
    document.getElementById("notice-area").innerHTML = "";
  }

  function kstDefaultDate() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: KST_TIME_ZONE }).format(new Date());
  }

  // Interprets dateStr/timeStr as KST wall-clock time and returns
  // "YYYY-MM-DDTHH:MM:SS+09:00" strings for start/end, independent of the
  // visitor's own browser timezone. Mirrors app.py's to_notion_iso().
  function toKstIsoRange(dateStr, timeStr, durationHours) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const [hh, mm] = timeStr.split(":").map(Number);
    const startUtcMs = Date.UTC(y, m - 1, d, hh - 9, mm);
    const endUtcMs = startUtcMs + durationHours * 3600 * 1000;
    return { startIso: toKstIsoString(startUtcMs), endIso: toKstIsoString(endUtcMs) };
  }

  function toKstIsoString(utcMs) {
    const kst = new Date(utcMs + 9 * 3600 * 1000);
    const pad = (n) => String(n).padStart(2, "0");
    return (
      `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}` +
      `T${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}:${pad(kst.getUTCSeconds())}+09:00`
    );
  }

  function initDurationToggle() {
    const select = document.getElementById("duration-select");
    const wrap = document.getElementById("custom-duration-wrap");
    select.addEventListener("change", () => {
      wrap.classList.toggle("field-hidden", select.value !== "custom");
    });
  }

  function resolveDurationHours() {
    const select = document.getElementById("duration-select");
    if (select.value === "custom") {
      const custom = document.getElementById("custom-duration");
      return Number(custom.value) || 24;
    }
    return Number(select.value);
  }

  function resetFormDefaults(form) {
    form.reset();
    document.getElementById("start-date").value = kstDefaultDate();
    document.getElementById("start-time").value = "09:00";
    document.getElementById("duration-select").value = "500";
    document.getElementById("custom-duration-wrap").classList.add("field-hidden");
  }

  function initForm() {
    const form = document.getElementById("reservation-form");
    resetFormDefaults(form);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearNotice();

      const name = document.getElementById("name-input").value.trim();
      if (!name) {
        showNotice("예약자 이름을 입력해주세요.", "error");
        return;
      }

      const password = document.getElementById("password-input").value.trim();
      if (password.length < 4) {
        showNotice("취소 시 필요한 비밀번호를 4자리 이상 입력해주세요.", "error");
        return;
      }

      const equipment = document.getElementById("equipment-select").value;
      const startDate = document.getElementById("start-date").value;
      const startTime = document.getElementById("start-time").value;
      const durationHours = resolveDurationHours();
      const { startIso, endIso } = toKstIsoRange(startDate, startTime, durationHours);

      const submitBtn = form.querySelector(".btn-submit");
      submitBtn.disabled = true;

      try {
        const res = await fetch("/api/reservations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, password, equipment, start: startIso, end: endIso }),
        });
        const data = await res.json();

        if (res.status === 409) {
          const nextAvailable = formatKst(new Date(data.nextAvailable));
          showNotice(
            `선택한 시간에 이미 예약이 존재합니다. 다음 예약 가능 시간: ${nextAvailable} 이후`,
            "error"
          );
          return;
        }

        if (!res.ok) {
          showNotice(data.error || "요청 처리 중 오류가 발생했습니다.", "error");
          return;
        }

        showNotice("예약이 완료되었습니다.", "success");
        resetFormDefaults(form);
        allRecordsCache = null;
        renderReservationList();
      } catch (err) {
        showNotice(`요청 처리 중 오류가 발생했습니다.\n${err.message}`, "error");
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  // Delegated so it keeps working after renderReservationList() replaces
  // #reservation-list's contents on every refresh.
  function initCancelButtons() {
    document.getElementById("reservation-list").addEventListener("click", async (event) => {
      const btn = event.target.closest(".btn-cancel");
      if (!btn) return;

      const password = window.prompt(
        `${btn.dataset.label}하려면 등록 시 입력한 비밀번호를 입력하세요.\n` +
          `(비밀번호를 설정하지 않은 예약이면 빈 칸으로 두고 확인을 누르세요.)`
      );
      if (password === null) return; // user cancelled the prompt

      btn.disabled = true;
      try {
        const res = await fetch(`/api/reservations?id=${encodeURIComponent(btn.dataset.id)}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: password.trim() }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "취소 처리 중 오류가 발생했습니다.");
        }
        allRecordsCache = null;
        renderReservationList();
      } catch (err) {
        alert(err.message);
        btn.disabled = false;
      }
    });
  }

  // ---------- Init ----------
  document.addEventListener("DOMContentLoaded", () => {
    initTabs();
    populateEquipmentSelect();
    populateEquipmentFilter();
    initDurationToggle();
    initForm();
    initCancelButtons();

    document.getElementById("equipment-select").addEventListener("change", renderReservationList);
    renderReservationList();
  });
})();
