# Claude Code Handoff — 시험 장비 예약

정적 HTML/CSS/JS + Vercel Serverless Function으로 만든 Notion 연동 실험실 장비 예약 앱. 이 문서를 먼저 읽고 작업을 이어가세요.

## 프로젝트 목적

연구소 시험 장비(16종)의 사용 예약을 등록하고, Notion DB와 동기화하며, 실시간 현황·달력으로 확인하는 내부용 웹앱.

## 기술 스택

- **정적 프론트엔드** — `index.html` + `css/style.css` + `js/app.js` (빌드 도구 없음, 바닐라 JS)
- **Vercel Serverless Functions** — `api/*.js` (Node.js, 의존성 없이 전역 `fetch`로 Notion REST API 직접 호출)
- **FullCalendar 6** — CDN 스크립트, `js/app.js`에서 초기화 (설비별 달력 탭)

## 이전 구현과의 차이 (중요)

이 프로젝트는 원래 **Streamlit + notion-client(Python)** 로 만들어졌다가, Vercel 배포를 위해
**정적 사이트 + Vercel Serverless Function** 구조로 전면 재작성되었습니다. Streamlit 서버는
웹소켓 기반 상주형 프로세스라 Vercel(서버리스)과 근본적으로 호환되지 않기 때문입니다.

- 과거 `app.py` 로직은 git 이력에 남아 있음 (필요 시 `git log -- app.py`로 복구 가능)
- Notion 관련 로직은 `api/_notion.js`로, UI 로직은 `js/app.js`로 이식됨
- **NOTION_TOKEN을 브라우저에 절대 노출하지 말 것** — Notion 호출은 반드시 `api/*.js`(서버 측)에서만 수행

## 저장소

- **GitHub:** https://github.com/elova9049/lab-arng
- **브랜치:** `main`

## 로컬 실행

```bash
npm install -g vercel
vercel dev
```

`.env` 파일 생성 (또는 `vercel env pull .env`):

```
NOTION_TOKEN=노션_통합_토큰
DATABASE_ID=노션_데이터베이스_ID
```

→ http://localhost:3000 (`vercel dev`가 정적 파일과 `/api/*` 함수를 함께 서빙)

## Vercel 배포

1. https://vercel.com → GitHub 연동 → Repository: `elova9049/lab-arng` import
2. Framework Preset: **Other** (별도 빌드 명령 불필요 — 루트의 정적 파일 + `api/`를 그대로 인식)
3. Project Settings → Environment Variables:

```
NOTION_TOKEN = ...
DATABASE_ID = ...
```

4. Deploy 후 생성된 `*.vercel.app` URL을 팀에 공유

**참고:** `vercel.json` 없이 zero-config로 동작함 (루트 정적 파일은 그대로 서빙, `api/*.js`는 자동으로 Serverless Function이 됨). `api/_notion.js`, `api/_equipment.js`처럼 `_`로 시작하는 파일은 라우트로 노출되지 않고 다른 함수가 `require()`하는 공유 모듈로만 쓰임.

## 파일 구조

```
lab-arng/
├── index.html                      # 전체 UI 마크업 (탭 2개)
├── css/
│   └── style.css                   # 미니멀 실험실 스타일
├── js/
│   └── app.js                      # 탭 전환, 폼 제출, 현황/달력 렌더링
├── api/
│   ├── _notion.js                  # Notion REST 호출 공유 헬퍼 (라우트 아님)
│   ├── _equipment.js               # EQUIPMENT_OPTIONS (서버 측 검증용, 라우트 아님)
│   └── reservations.js             # GET(전체 조회) / POST(등록+충돌검사)
├── package.json                    # 의존성 없음, engines.node >= 18만 명시
├── CLAUDE.md                       # 이 파일
├── README.md
└── .gitignore                      # .env, node_modules/, .vercel/ 제외
```

## Notion DB 스키마

| 속성명 (코드 상수) | Notion 타입 | 용도 |
|-------------------|-------------|------|
| `이름` (`NAME_PROPERTY`) | title | 예약자 이름 |
| `태그` (`TAG_PROPERTY`) | multi_select | 장비명 (EQUIPMENT_OPTIONS 값과 일치해야 함) |
| `날짜` (`DATE_PROPERTY`) | date (start/end) | 예약 기간 |

### API 주의사항

- **`/v1/databases/{id}/query` 사용 금지** — API 버전 `2025-09-03`부터 폐기됨, 반드시 data source 경유
- 올바른 흐름 (`api/_notion.js`):
  1. `GET /v1/databases/{database_id}` → `data_sources[0].id`
  2. `POST /v1/data_sources/{data_source_id}/query` (filter/start_cursor)
- 모든 요청에 `Notion-Version: 2025-09-03` 헤더 필수
- 구현: `resolveDataSourceId()`, `queryReservationPages()` (둘 다 `api/_notion.js`)

### 시간대

- KST 고정: `js/app.js`의 `toKstIsoRange()` → `YYYY-MM-DDTHH:MM:SS+09:00`
- 날짜/시간 입력값은 사용자의 브라우저 시간대와 무관하게 항상 KST 벽시계 시각으로 해석됨 (UTC 기반 계산으로 구현, 방문자 로컬 시간대에 영향받지 않음)
- 예약 현황 표시(`formatKst`)와 FullCalendar(`timeZone: "Asia/Seoul"`)도 동일하게 KST 고정

## UI 구조

**앱 제목:** 시험 장비 예약

**탭:**
1. **예약 등록** — 2열 레이아웃
   - 왼쪽: Equipment(select, form 밖) → Name, Start Date/Time, Duration, Register(폼)
   - 오른쪽: **장비 예약 현황** (선택 장비의 활성 예약, `#reservation-list`)
2. **설비별 달력** — FullCalendar + 장비 체크박스 필터 (`#equipment-filter`)

**Duration:** `<select>` — `500`, `1000`, `2000`, `Direct Input`(선택 시 `#custom-duration-wrap` 표시)

**충돌 검사:** `api/reservations.js`의 POST 핸들러가 해당 장비의 기존 예약을 다시 조회해 겹치는지 서버 측에서 검사 (클라이언트가 판단하지 않음). 겹치면 409 + 다음 가능 시간 반환.

**성공 피드백:** 등록 성공 시 notice 표시 + 폼 리셋 + `allRecordsCache = null`로 캐시 무효화 후 현황 재조회.

## 장비 목록 (16종)

`EQUIPMENT_OPTIONS` — `js/app.js`(클라이언트 표시용)와 `api/_equipment.js`(서버 검증용) 두 곳에 동일하게 유지해야 함. 관리번호 포함 문자열 그대로 Notion multi_select에 저장.

## 스타일 / UX 규칙 (사용자 선호)

- UI 라벨은 한국어 OK, **코드 주석은 영어** (한국어 주석 넣지 말 것) — 단, 이 문서 자체는 한국어 유지
- 미니멀 실험실 스타일: `#e0e0e0` border, 40px 필드 높이, 흰 입력 배경 (`css/style.css`)
- Equipment select는 **form 밖** — 장비 변경 시 오른쪽 현황(`renderReservationList`) 즉시 갱신
- Duration은 **select** (드롭다운, radio 아님)
- FullCalendar 이벤트는 custom `eventContent` + `.lab-event-chip` (hover 전에도 색 보이게)

## 보안

- 토큰/DB ID는 **Vercel Environment Variables만** 사용 (`api/_notion.js`가 `process.env`로 조회)
- `.env`는 gitignore
- Notion 호출은 반드시 `api/*.js` 서버 측에서만 — 브라우저(`js/app.js`)는 `NOTION_TOKEN`을 절대 알지 못함
- 예전에 코드에 토큰이 노출된 적 있다면 Notion에서 **토큰 재발급** 권장

## 알려진 이슈 / 해결 이력

| 이슈 | 해결 |
|------|------|
| Notion query API 폐기 (`/databases/{id}/query`) | `data_sources.query` (REST: `/v1/data_sources/{id}/query`) 사용 |
| KST 9h offset | 클라이언트 `toKstIsoRange()`가 UTC 기반 계산으로 `+09:00` 명시 |
| Streamlit은 Vercel과 호환 불가 | 정적 사이트 + Serverless Function으로 전면 재작성 |
| Vercel 배포 시 stlite(브라우저 실행)는 토큰 노출 위험 | 서버 측 API 함수로 토큰 격리 |

## 남은 작업 (우선순위)

1. **Vercel 배포 완료** — 외부 URL 공유 (Vercel 계정 연동은 사용자가 직접 진행)
2. (선택) 배포 후 Notion 연동·예약 등록·달력 E2E 확인
3. (선택) Notion integration이 해당 DB에 read/write 권한 있는지 확인

## Git

```bash
git status
git add ...
git commit -m "..."
git push origin main
```

커밋은 사용자가 요청할 때만. `.env`는 절대 커밋하지 말 것.

## 의존성

없음 (Node.js 내장 `fetch` 사용, Vercel Node 런타임 18+ 기준).
