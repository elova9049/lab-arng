import json
import streamlit as st
import streamlit.components.v1 as components
from datetime import datetime, time, timedelta
from typing import Any, Literal

from notion_client import Client

EQUIPMENT_OPTIONS = [
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
]
DURATION_PRESETS = [500, 1000, 2000]
DURATION_OPTIONS = [str(value) for value in DURATION_PRESETS] + ["Direct Input"]
DIRECT_DURATION_LABEL = "Direct Input"
EQUIPMENT_COLORS = [
    "#2b2b2b",
    "#3d5a80",
    "#5a4a6a",
    "#4a6a5a",
    "#6a4a4a",
    "#4a5a6a",
    "#5a6a4a",
    "#6a5a4a",
    "#4a4a6a",
    "#5a5a2b",
    "#2b5a5a",
    "#5a2b4a",
    "#4a3d5a",
    "#3d4a5a",
    "#5a3d3d",
    "#3d5a4a",
]
EQUIPMENT_COLOR_MAP = {
    equipment: EQUIPMENT_COLORS[index % len(EQUIPMENT_COLORS)]
    for index, equipment in enumerate(EQUIPMENT_OPTIONS)
}
TAG_PROPERTY = "태그"
NAME_PROPERTY = "이름"
DATE_PROPERTY = "날짜"


@st.cache_resource
def get_notion_client() -> Client:
    return Client(auth=st.secrets["NOTION_TOKEN"])


def get_database_id() -> str:
    return st.secrets["DATABASE_ID"]

INSTRUMENT_CSS = """
<style>
    :root {
        --charcoal: #2b2b2b;
        --charcoal-soft: #3a3a3a;
        --matte-grey: #6e6e6e;
        --matte-grey-light: #9a9a9a;
        --off-white: #f7f7f5;
        --surface: #fafaf8;
        --border: #e0e0e0;
        --input-bg: #ffffff;
        --field-height: 40px;
        --field-radius: 6px;
        --field-font-size: 0.875rem;
        --field-padding-x: 0.75rem;
    }

    .stApp {
        background-color: var(--off-white);
    }

    #MainMenu, footer, header {
        visibility: hidden;
    }

    .block-container {
        padding-top: 3.25rem;
        padding-bottom: 4.5rem;
        max-width: 1040px;
    }

    .app-title {
        font-size: 1.65rem;
        font-weight: 400;
        letter-spacing: 0.02em;
        color: var(--charcoal);
        margin: 0 0 2.5rem 0;
        line-height: 1.4;
    }

    .panel-title {
        font-size: 0.95rem;
        font-weight: 400;
        letter-spacing: 0.02em;
        color: var(--charcoal);
        margin: 0 0 1rem 0;
        padding-bottom: 0.55rem;
        border-bottom: 1px solid var(--border);
    }

    .section-label {
        font-size: 0.7rem;
        font-weight: 500;
        letter-spacing: 0.13em;
        text-transform: uppercase;
        color: var(--matte-grey);
        margin: 0 0 1rem 0;
        padding-bottom: 0.55rem;
        border-bottom: 1px solid var(--border);
    }

    div[data-testid="stVerticalBlockBorderWrapper"] {
        border: 1px solid var(--border) !important;
        border-radius: var(--field-radius);
        background: var(--surface);
        padding: 1.75rem 1.5rem;
        box-shadow: none;
    }

    div[data-testid="stForm"] {
        border: none;
        padding: 0;
    }

    div[data-testid="stTextInput"],
    div[data-testid="stSelectbox"],
    div[data-testid="stDateInput"],
    div[data-testid="stTimeInput"],
    div[data-testid="stNumberInput"] {
        margin-bottom: 1.15rem;
    }

    div[data-testid="stTextInput"] label,
    div[data-testid="stSelectbox"] label,
    div[data-testid="stDateInput"] label,
    div[data-testid="stTimeInput"] label,
    div[data-testid="stNumberInput"] label {
        display: block;
        font-size: 0.74rem;
        font-weight: 500;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--matte-grey);
        margin-bottom: 0.45rem;
    }

    div[data-testid="stTextInput"] [data-baseweb="input"],
    div[data-testid="stNumberInput"] [data-baseweb="input"],
    div[data-testid="stSelectbox"] [data-baseweb="select"],
    div[data-testid="stTimeInput"] [data-baseweb="select"] {
        box-sizing: border-box !important;
        height: var(--field-height) !important;
        min-height: var(--field-height) !important;
        max-height: var(--field-height) !important;
        border: 1px solid var(--border) !important;
        border-radius: var(--field-radius) !important;
        background: #ffffff !important;
        box-shadow: none !important;
        overflow: visible !important;
    }

    div[data-testid="stDateInput"] > div {
        box-sizing: border-box !important;
        display: flex !important;
        align-items: stretch !important;
        height: var(--field-height) !important;
        min-height: var(--field-height) !important;
        max-height: var(--field-height) !important;
        border: 1px solid var(--border) !important;
        border-radius: var(--field-radius) !important;
        background: #ffffff !important;
        overflow: hidden !important;
        gap: 0 !important;
    }

    div[data-testid="stNumberInputContainer"] {
        border: none !important;
        background: transparent !important;
        box-shadow: none !important;
        padding: 0 !important;
    }

    div[data-testid="stDateInput"] [data-baseweb="input"] {
        box-sizing: border-box !important;
        flex: 1 1 auto !important;
        height: 100% !important;
        min-height: 100% !important;
        border: none !important;
        border-radius: 0 !important;
        background: #ffffff !important;
        box-shadow: none !important;
    }

    div[data-testid="stTextInput"] input,
    div[data-testid="stNumberInput"] input,
    div[data-testid="stDateInput"] input,
    div[data-testid="stSelectbox"] [data-baseweb="select"] > div,
    div[data-testid="stTimeInput"] [data-baseweb="select"] > div,
    div[data-testid="stTextInput"] [data-baseweb="input"] > div,
    div[data-testid="stNumberInput"] [data-baseweb="input"] > div,
    div[data-testid="stDateInput"] [data-baseweb="input"] > div {
        border: none !important;
        outline: none !important;
        box-shadow: none !important;
        background: #ffffff !important;
        color: var(--charcoal) !important;
        font-size: var(--field-font-size) !important;
        -webkit-text-fill-color: var(--charcoal) !important;
    }

    div[data-testid="stTextInput"] input,
    div[data-testid="stNumberInput"] input,
    div[data-testid="stDateInput"] input {
        height: 100% !important;
        min-height: 100% !important;
        padding: 0 var(--field-padding-x) !important;
        color-scheme: light !important;
        caret-color: var(--charcoal) !important;
    }

    div[data-testid="stSelectbox"] [data-baseweb="select"] > div,
    div[data-testid="stTimeInput"] [data-baseweb="select"] > div {
        box-sizing: border-box !important;
        height: 100% !important;
        min-height: 100% !important;
        padding: 0 var(--field-padding-x) !important;
        padding-right: 0.5rem !important;
        align-items: center !important;
        justify-content: space-between !important;
    }

    div[data-testid="stSelectbox"] [data-baseweb="select"] > div > div:first-child,
    div[data-testid="stTimeInput"] [data-baseweb="select"] > div > div:first-child {
        margin: 0 !important;
        padding: 0 !important;
        min-width: 0 !important;
    }

    div[data-testid="stSelectbox"] [data-baseweb="select"] > div > div:first-child > div,
    div[data-testid="stTimeInput"] [data-baseweb="select"] > div > div:first-child > div {
        margin: 0 !important;
        padding: 0 !important;
        color: var(--charcoal) !important;
        -webkit-text-fill-color: var(--charcoal) !important;
    }

    div[data-testid="stSelectbox"] [data-baseweb="select"] svg,
    div[data-testid="stTimeInput"] [data-baseweb="select"] svg {
        fill: var(--matte-grey) !important;
        width: 1rem !important;
        height: 1rem !important;
        flex-shrink: 0 !important;
    }

    div[data-testid="stDateInput"] button {
        box-sizing: border-box !important;
        flex: 0 0 var(--field-height) !important;
        width: var(--field-height) !important;
        height: 100% !important;
        min-height: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
        border-left: 1px solid var(--border) !important;
        border-radius: 0 !important;
        background: #ffffff !important;
        color: var(--matte-grey) !important;
    }

    div[data-testid="stDateInput"] button svg {
        fill: var(--matte-grey) !important;
        width: 1rem !important;
        height: 1rem !important;
    }

    div[data-testid="stNumberInput"] [data-baseweb="input"] > div {
        align-items: center !important;
        height: 100% !important;
    }

    div[data-testid="stNumberInput"] button {
        box-sizing: border-box !important;
        height: 100% !important;
        min-width: 2rem !important;
        margin: 0 !important;
        padding: 0 0.45rem !important;
        border: none !important;
        border-left: 1px solid var(--border) !important;
        border-radius: 0 !important;
        background: #f3f3f3 !important;
        color: var(--charcoal) !important;
    }

    div[data-testid="stNumberInput"] button svg,
    div[data-testid="stNumberInput"] button path {
        fill: var(--charcoal) !important;
        stroke: var(--charcoal) !important;
    }

    div[data-testid="stTextInput"] [data-baseweb="input"]:focus-within,
    div[data-testid="stNumberInput"] [data-baseweb="input"]:focus-within,
    div[data-testid="stSelectbox"] [data-baseweb="select"]:focus-within,
    div[data-testid="stTimeInput"] [data-baseweb="select"]:focus-within,
    div[data-testid="stTextInput"] input:focus,
    div[data-testid="stNumberInput"] input:focus,
    div[data-testid="stDateInput"] input:focus {
        outline: none !important;
        box-shadow: none !important;
    }

    div[data-testid="stTextInput"] [data-baseweb="input"]:focus-within,
    div[data-testid="stNumberInput"] [data-baseweb="input"]:focus-within,
    div[data-testid="stSelectbox"] [data-baseweb="select"]:focus-within,
    div[data-testid="stTimeInput"] [data-baseweb="select"]:focus-within {
        border-color: var(--border) !important;
    }

    div[data-testid="stFormSubmitButton"] {
        margin-top: 0.5rem;
    }

    div[data-testid="stFormSubmitButton"] button {
        border-radius: var(--field-radius);
        border: 1px solid var(--charcoal-soft);
        background: var(--charcoal);
        color: #f5f5f3;
        font-size: 0.72rem;
        font-weight: 500;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        padding: 0.6rem 1.35rem;
        min-height: var(--field-height);
    }

    div[data-testid="stFormSubmitButton"] button:hover {
        border-color: var(--charcoal);
        background: var(--charcoal-soft);
        color: #ffffff;
    }

    div[data-testid="column"] {
        padding-left: 0.65rem;
        padding-right: 0.65rem;
    }

    .status-copy {
        font-size: 0.9rem;
        font-weight: 400;
        color: var(--charcoal-soft);
        line-height: 1.8;
        margin: 0;
    }

    .status-meta {
        font-size: 0.72rem;
        color: var(--matte-grey-light);
        letter-spacing: 0.04em;
        margin-top: 2rem;
        padding-top: 1.1rem;
        border-top: 1px solid var(--border);
    }

    .notice-block {
        margin-top: 1.25rem;
        padding: 0.9rem 1rem;
        border: 1px solid var(--border);
        border-radius: var(--field-radius);
        background: #f0f0ee;
    }

    .notice-block.success {
        background: #ececea;
        border-left: 3px solid #5a5a5a;
    }

    .notice-block.error {
        background: #e8e8e6;
        border-left: 3px solid #4a4a4a;
    }

    .notice-label {
        display: block;
        font-size: 0.66rem;
        font-weight: 500;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--matte-grey);
        margin-bottom: 0.4rem;
    }

    .notice-text {
        font-size: 0.88rem;
        font-weight: 400;
        color: var(--charcoal);
        line-height: 1.65;
        margin: 0;
        white-space: pre-line;
    }

    .reservation-empty {
        font-size: 0.88rem;
        font-weight: 400;
        color: var(--matte-grey-light);
        line-height: 1.65;
        margin: 0;
    }

    .reservation-item {
        font-size: 0.88rem;
        font-weight: 400;
        color: var(--charcoal-soft);
        line-height: 1.75;
        margin: 0;
        padding: 0.75rem 0;
        border-bottom: 1px solid var(--border);
    }

    .reservation-item:last-child {
        border-bottom: none;
        padding-bottom: 0;
    }

    .reservation-name {
        color: var(--charcoal);
        font-weight: 500;
    }

    .reservation-period {
        color: var(--matte-grey);
        font-weight: 400;
    }

    .calendar-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 0.65rem 1rem;
        margin: 0 0 1rem 0;
    }

    .calendar-legend-item {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.74rem;
        color: var(--charcoal-soft);
    }

    .calendar-legend-swatch {
        width: 0.75rem;
        height: 0.75rem;
        border-radius: 2px;
        border: 1px solid var(--border);
        flex-shrink: 0;
    }
</style>
"""


def render_notice(
    message: str,
    variant: Literal["success", "error", "neutral"] = "neutral",
) -> None:
    label_map = {
        "success": "Result",
        "error": "Notice",
        "neutral": "Info",
    }
    label = label_map[variant]
    css_class = variant if variant in ("success", "error") else ""
    st.markdown(
        f"""
        <div class="notice-block {css_class}">
            <span class="notice-label">{label}</span>
            <p class="notice-text">{message}</p>
        </div>
        """,
        unsafe_allow_html=True,
    )


KST_OFFSET = "+09:00"


def resolve_duration_hours(duration_choice: str, custom_duration_hours: int | None) -> int:
    if duration_choice == DIRECT_DURATION_LABEL:
        return int(custom_duration_hours or 24)
    return int(duration_choice)


def combine_datetime(date_value, time_value: time) -> datetime:
    return datetime.combine(date_value, time_value)


def to_notion_iso(value: datetime) -> str:
    return f"{value.strftime('%Y-%m-%dT%H:%M:%S')}{KST_OFFSET}"


def parse_notion_datetime(value: str) -> datetime:
    normalized = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is not None:
        parsed = parsed.replace(tzinfo=None)
    return parsed


def extract_page_name(prop: dict[str, Any] | None) -> str:
    if not prop or prop.get("type") != "title":
        return "Unknown"

    title_parts = prop.get("title") or []
    if not title_parts:
        return "Unknown"

    first_part = title_parts[0]
    plain_text = first_part.get("plain_text")
    if plain_text:
        return plain_text

    text_content = first_part.get("text", {}).get("content")
    return text_content or "Unknown"


def extract_reservation_interval(prop: dict[str, Any] | None) -> tuple[datetime, datetime] | None:
    if not prop or prop.get("type") != "date":
        return None

    date_value = prop.get("date") or {}
    start_raw = date_value.get("start")
    if not start_raw:
        return None

    start_dt = parse_notion_datetime(start_raw)
    end_raw = date_value.get("end")
    end_dt = parse_notion_datetime(end_raw) if end_raw else start_dt
    return start_dt, end_dt


def intervals_overlap(
    request_start: datetime,
    request_end: datetime,
    existing_start: datetime,
    existing_end: datetime,
) -> bool:
    return request_start < existing_end and existing_start < request_end


def resolve_data_source_id(database_id: str) -> str:
    database = get_notion_client().databases.retrieve(database_id)
    data_sources = database.get("data_sources") or []
    if not data_sources:
        raise ValueError(f"No data sources found for database {database_id}")
    return data_sources[0]["id"]


def extract_equipment_tags(prop: dict[str, Any] | None) -> list[str]:
    if not prop or prop.get("type") != "multi_select":
        return []

    return [
        item.get("name", "")
        for item in prop.get("multi_select", [])
        if item.get("name")
    ]


def parse_reservation_records(page: dict[str, Any], equipment: str | None = None) -> list[dict[str, Any]]:
    properties = page.get("properties", {})
    interval = extract_reservation_interval(properties.get(DATE_PROPERTY))
    if not interval:
        return []

    start_dt, end_dt = interval
    name = extract_page_name(properties.get(NAME_PROPERTY))
    records: list[dict[str, Any]] = []

    for tag in extract_equipment_tags(properties.get(TAG_PROPERTY)):
        if equipment is not None and tag != equipment:
            continue
        records.append(
            {
                "name": name,
                "start": start_dt,
                "end": end_dt,
                "equipment": tag,
            }
        )

    return records


def query_reservation_pages(query_filter: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    pages: list[dict[str, Any]] = []
    cursor = None
    data_source_id = resolve_data_source_id(get_database_id())

    while True:
        query_kwargs: dict[str, Any] = {}
        if query_filter:
            query_kwargs["filter"] = query_filter
        if cursor:
            query_kwargs["start_cursor"] = cursor

        response = get_notion_client().data_sources.query(data_source_id=data_source_id, **query_kwargs)
        pages.extend(response.get("results", []))

        if not response.get("has_more"):
            break
        cursor = response.get("next_cursor")

    return pages


@st.cache_data(ttl=60, show_spinner=False)
def fetch_all_reservation_records() -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for page in query_reservation_pages():
        records.extend(parse_reservation_records(page))

    records.sort(key=lambda item: (item["start"], item["equipment"]))
    return records


def fetch_equipment_reservation_records(equipment: str) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    query_filter = {
        "property": TAG_PROPERTY,
        "multi_select": {"contains": equipment},
    }

    for page in query_reservation_pages(query_filter):
        records.extend(parse_reservation_records(page, equipment=equipment))

    records.sort(key=lambda item: item["start"])
    return records


def fetch_equipment_reservations(equipment: str) -> list[tuple[datetime, datetime]]:
    return [
        (record["start"], record["end"])
        for record in fetch_equipment_reservation_records(equipment)
    ]


def find_conflicting_end_times(
    request_start: datetime,
    request_end: datetime,
    reservations: list[tuple[datetime, datetime]],
) -> list[datetime]:
    conflicting_ends: list[datetime] = []
    for existing_start, existing_end in reservations:
        if intervals_overlap(request_start, request_end, existing_start, existing_end):
            conflicting_ends.append(existing_end)
    return conflicting_ends


def render_reservation_list(records: list[dict[str, Any]]) -> None:
    now = datetime.now()
    active_records = [record for record in records if record["end"] >= now]

    if not active_records:
        st.markdown(
            '<p class="reservation-empty">No active reservations for this equipment.</p>',
            unsafe_allow_html=True,
        )
        return

    items = []
    for record in active_records:
        period = (
            f"{record['start'].strftime('%Y-%m-%d %H:%M')}"
            f" → {record['end'].strftime('%Y-%m-%d %H:%M')}"
        )
        items.append(
            "<p class='reservation-item'>"
            f"<span class='reservation-name'>{record['name']}</span>"
            f"<span class='reservation-period'> · {period}</span>"
            "</p>"
        )
    st.markdown("".join(items), unsafe_allow_html=True)


def render_calendar_legend(equipment_names: list[str]) -> None:
    if not equipment_names:
        return

    legend_items = []
    for equipment_name in equipment_names:
        color = EQUIPMENT_COLOR_MAP.get(equipment_name, "#6e6e6e")
        legend_items.append(
            "<span class='calendar-legend-item'>"
            f"<span class='calendar-legend-swatch' style='background:{color};'></span>"
            f"{equipment_name}"
            "</span>"
        )

    st.markdown(
        f"<div class='calendar-legend'>{''.join(legend_items)}</div>",
        unsafe_allow_html=True,
    )


def render_equipment_calendar(records: list[dict[str, Any]]) -> None:
    events = []
    for record in records:
        equipment_name = record["equipment"]
        color = EQUIPMENT_COLOR_MAP.get(equipment_name, "#6e6e6e")
        events.append(
            {
                "title": f"{record['name']} · {equipment_name}",
                "start": to_notion_iso(record["start"]),
                "end": to_notion_iso(record["end"]),
                "backgroundColor": color,
                "borderColor": color,
                "textColor": "#ffffff",
            }
        )

    calendar_html = f"""
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="utf-8" />
        <link
            href="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.css"
            rel="stylesheet"
        />
        <script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.js"></script>
        <style>
            html, body {{
                margin: 0;
                padding: 0;
                background: #fafaf8;
                font-family: "Segoe UI", sans-serif;
            }}
            #calendar {{
                background: #ffffff;
                border: 1px solid #e0e0e0;
                border-radius: 6px;
                padding: 0.75rem;
            }}
            .fc {{
                --fc-border-color: #e0e0e0;
                --fc-page-bg-color: #ffffff;
                --fc-neutral-bg-color: #f7f7f5;
                --fc-today-bg-color: #f0f0ee;
                --fc-button-bg-color: #3a3a3a;
                --fc-button-border-color: #3a3a3a;
                --fc-button-hover-bg-color: #2b2b2b;
                --fc-button-hover-border-color: #2b2b2b;
                --fc-button-active-bg-color: #2b2b2b;
                --fc-button-active-border-color: #2b2b2b;
            }}
            .fc .fc-toolbar-title {{
                font-size: 1rem;
                font-weight: 500;
                color: #2b2b2b;
            }}
            .fc .fc-col-header-cell-cushion,
            .fc .fc-daygrid-day-number,
            .fc .fc-list-day-text,
            .fc .fc-list-day-side-text {{
                color: #6e6e6e;
                text-decoration: none;
            }}
            a.fc-event,
            a.fc-event:hover,
            a.fc-event:focus,
            a.fc-event:active {{
                background: transparent !important;
                border: none !important;
                box-shadow: none !important;
                opacity: 1 !important;
                text-decoration: none !important;
                padding: 1px 2px !important;
            }}
            .fc-event-main,
            .fc-event-main-frame,
            .fc-event-title-container {{
                background: transparent !important;
            }}
            .lab-event-chip {{
                display: block;
                box-sizing: border-box;
                width: 100%;
                padding: 3px 6px;
                border-radius: 4px;
                color: #ffffff !important;
                font-size: 0.72rem;
                font-weight: 500;
                line-height: 1.35;
                white-space: normal;
                overflow: hidden;
            }}
            .fc-list-event-dot {{
                border-width: 6px !important;
            }}
            .fc-list-event-title a {{
                color: #2b2b2b !important;
                text-decoration: none !important;
            }}
        </style>
    </head>
    <body>
        <div id="calendar"></div>
        <script>
            function escapeHtml(value) {{
                return String(value)
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;");
            }}

            document.addEventListener("DOMContentLoaded", function () {{
                const calendarEl = document.getElementById("calendar");
                const calendar = new FullCalendar.Calendar(calendarEl, {{
                    initialView: "dayGridMonth",
                    locale: "ko",
                    height: 680,
                    headerToolbar: {{
                        left: "prev,next today",
                        center: "title",
                        right: "dayGridMonth,timeGridWeek,listWeek"
                    }},
                    events: {json.dumps(events, ensure_ascii=False)},
                    eventDisplay: "block",
                    dayMaxEvents: 4,
                    moreLinkClick: "popover",
                    eventContent: function(arg) {{
                        const bg = arg.event.backgroundColor || "#2b2b2b";
                        const border = arg.event.borderColor || bg;
                        const title = escapeHtml(arg.event.title || "");
                        return {{
                            html:
                                '<div class="lab-event-chip" style="' +
                                "background-color:" + bg + ";" +
                                "border:1px solid " + border + ";" +
                                'color:#ffffff;">' +
                                title +
                                "</div>",
                        }};
                    }},
                    eventDidMount: function(info) {{
                        info.el.style.background = "transparent";
                        info.el.style.border = "none";
                        info.el.style.boxShadow = "none";
                    }}
                }});
                calendar.render();
            }});
        </script>
    </body>
    </html>
    """
    components.html(calendar_html, height=720, scrolling=False)


st.set_page_config(page_title="시험 장비 예약", layout="wide")
st.markdown(INSTRUMENT_CSS, unsafe_allow_html=True)

st.markdown('<p class="app-title">시험 장비 예약</p>', unsafe_allow_html=True)

tab_register, tab_calendar = st.tabs(["예약 등록", "설비별 달력"])

with tab_register:
    col_form, col_status = st.columns([1.05, 1], gap="large")

    with col_form:
        if "last_notice" in st.session_state:
            notice_variant, notice_message = st.session_state.pop("last_notice")
            render_notice(notice_message, variant=notice_variant)
        with st.container(border=True):
            equipment = st.selectbox("Equipment", EQUIPMENT_OPTIONS)
            with st.form("reservation_form", clear_on_submit=True):
                name = st.text_input("Name", placeholder="")
                start_date = st.date_input("Start Date", datetime.now().date())
                start_time = st.time_input("Start Time", time(9, 0))
                duration_choice = st.selectbox("Test Duration (Hours)", DURATION_OPTIONS, index=0)
                custom_duration_hours = None
                if duration_choice == DIRECT_DURATION_LABEL:
                    custom_duration_hours = st.number_input(
                        "Custom Duration (Hours)",
                        min_value=1,
                        value=24,
                        step=1,
                    )
                submit_btn = st.form_submit_button("Register")

                if submit_btn:
                    if not name.strip():
                        render_notice("예약자 이름을 입력해주세요.", variant="error")
                    else:
                        try:
                            duration_hours = resolve_duration_hours(duration_choice, custom_duration_hours)
                            start_dt = combine_datetime(start_date, start_time)
                            end_dt = start_dt + timedelta(hours=int(duration_hours))
                            start_iso = to_notion_iso(start_dt)
                            end_iso = to_notion_iso(end_dt)

                            reservations = fetch_equipment_reservations(equipment)
                            conflicting_ends = find_conflicting_end_times(start_dt, end_dt, reservations)

                            if conflicting_ends:
                                next_available = max(conflicting_ends)
                                render_notice(
                                    "선택한 시간에 이미 예약이 존재합니다. "
                                    f"다음 예약 가능 시간: {next_available.strftime('%Y-%m-%d %H:%M')} 이후",
                                    variant="error",
                                )
                            else:
                                new_page_properties = {
                                    NAME_PROPERTY: {
                                        "title": [{"text": {"content": name.strip()}}],
                                    },
                                    TAG_PROPERTY: {
                                        "multi_select": [{"name": equipment}],
                                    },
                                    DATE_PROPERTY: {
                                        "date": {"start": start_iso, "end": end_iso},
                                    },
                                }

                                get_notion_client().pages.create(
                                    parent={"type": "database_id", "database_id": get_database_id()},
                                    properties=new_page_properties,
                                )
                                fetch_all_reservation_records.clear()
                                st.session_state["last_notice"] = ("success", "예약이 완료되었습니다.")
                                st.rerun()

                        except Exception as exc:
                            render_notice(f"요청 처리 중 오류가 발생했습니다.\n{exc}", variant="error")

    with col_status:
        st.markdown('<p class="panel-title">장비 예약 현황</p>', unsafe_allow_html=True)
        with st.container(border=True):
            try:
                reservation_records = fetch_equipment_reservation_records(equipment)
                render_reservation_list(reservation_records)
            except Exception as exc:
                render_notice(f"Failed to load reservations.\n{exc}", variant="error")

with tab_calendar:
    st.markdown('<p class="panel-title">전체 설비 예약 달력</p>', unsafe_allow_html=True)
    with st.container(border=True):
        calendar_equipment = st.multiselect(
            "Equipment Filter",
            EQUIPMENT_OPTIONS,
            default=EQUIPMENT_OPTIONS,
        )
        try:
            all_records = fetch_all_reservation_records()
            filtered_records = [
                record for record in all_records if record["equipment"] in calendar_equipment
            ]
            visible_equipment = [
                equipment_name
                for equipment_name in EQUIPMENT_OPTIONS
                if equipment_name in calendar_equipment
            ]
            render_calendar_legend(visible_equipment)

            if filtered_records:
                render_equipment_calendar(filtered_records)
            else:
                st.markdown(
                    '<p class="reservation-empty">No reservations to display for the selected equipment.</p>',
                    unsafe_allow_html=True,
                )
        except Exception as exc:
            render_notice(f"Failed to load calendar.\n{exc}", variant="error")
