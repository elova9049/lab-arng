# Claude Code Handoff — 시험 장비 예약

정적 HTML/CSS/JS + Vercel Serverless Function으로 만든 Neon(Postgres) 연동 실험실 장비 예약 앱. 이 문서를 먼저 읽고 작업을 이어가세요.

## 프로젝트 목적

연구소 시험 장비(16종)의 사용 예약을 등록하고, 실시간 현황("지금 사용 가능한지 / 얼마나 기다려야 하는지")·달력으로 확인하는 내부용 웹앱.

## 기술 스택

- **정적 프론트엔드** — `index.html` + `css/style.css` + `js/app.js` (빌드 도구 없음, 바닐라 JS)
- **Vercel Serverless Functions** — `api/*.js` (Node.js)
- **Neon Postgres** — `@neondatabase/serverless` 드라이버로 접속 (`api/_db.js`)
- **FullCalendar 6** — CDN 스크립트, `js/app.js`에서 초기화 (설비별 달력 탭)

## 이전 구현과의 차이 (중요)

이 프로젝트는 여러 번 구조가 바뀌었습니다. 최신 순서대로:

1. **Streamlit + notion-client(Python)** — 최초 구현. Streamlit은 웹소켓 상주형 서버라 Vercel(서버리스)과 호환 불가.
2. **정적 사이트 + Vercel Serverless Function + Notion API** — Vercel 배포를 위해 재작성. Notion을 DB로 사용.
3. **정적 사이트 + Vercel Serverless Function + Neon Postgres** (현재) — Notion은 매번 (1) 통합 토큰 발급 (2) DB 페이지에 통합 연결 (3) `이름`/`태그`/`날짜` 속성을 정확한 이름·타입으로 수동 생성해야 하는 등 설정 마찰이 커서, Vercel Storage에서 바로 연결되는 Neon Postgres로 전환. 테이블 스키마는 앱이 첫 요청 시 자동 생성(`CREATE TABLE IF NOT EXISTS`)하므로 별도 마이그레이션 단계가 없음.

- 과거 `app.py`(Streamlit) 로직은 git 이력에 남아 있음 (`git log -- app.py`)
- 과거 Notion 연동 로직(`api/_notion.js`)도 git 이력에 남아 있음 (`git log --all -- api/_notion.js`)
- DB 관련 로직은 `api/_db.js`로, UI 로직은 `js/app.js`로 구현됨
- **DB 연결 문자열을 브라우저에 절대 노출하지 말 것** — DB 호출은 반드시 `api/*.js`(서버 측)에서만 수행

## 저장소

- **GitHub:** https://github.com/elova9049/lab-arng
- **브랜치:** `main`

## 로컬 실행

```bash
npm install -g vercel
npm install
vercel dev
```

Vercel 프로젝트에 Neon을 이미 연결했다면:

```bash
vercel env pull .env.development.local
```

수동으로 하려면 `.env`에 직접 추가:

```
DATABASE_URL=postgres://...neon.tech/...
```

→ http://localhost:3000 (`vercel dev`가 정적 파일과 `/api/*` 함수를 함께 서빙)

## Vercel 배포

1. https://vercel.com → GitHub 연동 → Repository: `elova9049/lab-arng` import
2. Framework Preset: **Other** (별도 빌드 명령 불필요 — 루트의 정적 파일 + `api/`를 그대로 인식, `npm install`은 `package.json`의 `@neondatabase/serverless` 의존성을 위해 자동 실행됨)
3. 프로젝트 → **Storage** 탭 → **Create Database** → **Neon (Postgres)** → 연결
   → `DATABASE_URL`이 Production/Preview/Development 환경변수로 자동 등록됨 (Project Settings → Environment Variables에서 확인 가능, 수동으로 값을 복사해서 넣을 필요 없음)
4. Deploy 후 생성된 `*.vercel.app` URL을 팀에 공유

**참고:** `vercel.json` 없이 zero-config로 동작함. `api/_db.js`, `api/_equipment.js`처럼 `_`로 시작하는 파일은 라우트로 노출되지 않고 다른 함수가 `require()`하는 공유 모듈로만 쓰임.

## 파일 구조

```
lab-arng/
├── index.html                      # 전체 UI 마크업 (탭 2개)
├── css/
│   └── style.css                   # 미니멀 실험실 스타일
├── js/
│   └── app.js                      # 탭 전환, 폼 제출, 현황/달력 렌더링
├── api/
│   ├── _db.js                      # Postgres 접속 + 쿼리 헬퍼 (라우트 아님)
│   ├── _equipment.js               # EQUIPMENT_OPTIONS (서버 측 검증용, 라우트 아님)
│   └── reservations.js             # GET(전체 조회) / POST(등록+충돌검사)
├── package.json                    # @neondatabase/serverless만 의존, engines.node >= 20
├── CLAUDE.md                       # 이 파일
├── README.md
└── .gitignore                      # .env, node_modules/, .vercel/ 제외
```

## DB 스키마 (Postgres, `reservations` 테이블)

`api/_db.js`의 `ensureSchema()`가 첫 요청 시 자동으로 생성합니다.

| 컬럼 | 타입 | 용도 |
|------|------|------|
| `id` | BIGSERIAL PRIMARY KEY | |
| `name` | TEXT NOT NULL | 예약자 이름 |
| `equipment` | TEXT NOT NULL | 장비명 (EQUIPMENT_OPTIONS 값과 일치) |
| `start_time` / `end_time` | TIMESTAMPTZ NOT NULL | 예약 기간 |
| `created_at` | TIMESTAMPTZ DEFAULT now() | |

**충돌 방지는 애플리케이션 코드가 아니라 DB 제약으로 강제됨:**

```sql
CONSTRAINT reservations_no_overlap EXCLUDE USING gist (
  equipment WITH =,
  tstzrange(start_time, end_time) WITH &&
)
```

같은 장비·겹치는 시간대로 INSERT하면 Postgres가 `23P01`(exclusion_violation)로 거부함 — 두 요청이 동시에 들어와도 레이스 컨디션 없이 안전. `api/reservations.js`의 POST 핸들러는 이 에러를 잡아서 409 + "다음 예약 가능 시간"을 계산해 반환.

### 드라이버 주의사항

- `@vercel/postgres`는 deprecated됨 — **`@neondatabase/serverless`**를 직접 사용 (`neon(process.env.DATABASE_URL)`)
- HTTP 기반 단발 쿼리 드라이버라 `sql\`...\`` 결과가 바로 행 배열임 (`{ rows: [...] }`로 감싸져 있지 않음)
- 여러 쿼리를 한 트랜잭션으로 묶어야 하면 `sql.transaction()` 사용 (현재 코드는 단일 쿼리만 사용해 불필요)

### 시간대

- KST 고정: `js/app.js`의 `toKstIsoRange()` → `YYYY-MM-DDTHH:MM:SS+09:00`
- 날짜/시간 입력값은 사용자의 브라우저 시간대와 무관하게 항상 KST 벽시계 시각으로 해석됨
- 예약 현황 표시(`formatKst`)와 FullCalendar(`timeZone: "Asia/Seoul"`)도 동일하게 KST 고정
- DB에는 `TIMESTAMPTZ`(UTC 내부 저장)로 들어가고, 조회 시 ISO 문자열로 변환해 클라이언트에 전달 → 클라이언트가 다시 KST로 포맷

## UI 구조

**앱 제목:** 시험 장비 예약

**탭:**
1. **예약 등록** — 2열 레이아웃
   - 왼쪽: Equipment(select, form 밖) → Name, Start Date/Time, Duration, Register(폼)
   - 오른쪽: **장비 예약 현황** (`#reservation-list`)
     - 상단에 상태 배지: "🔴 사용 중 — HH:MM까지 (약 N시간 M분 남음)" 또는 "🟢 지금 사용 가능"(+예정 있으면 "HH:MM부터 예약 있음")
     - 연속 예약(뒷사람이 바로 이어받는 경우)은 `mergeIntervals()`로 하나의 구간으로 합쳐서 실제 대기시간을 계산 (개별 예약 하나만 보고 판단하면 안 됨)
     - 아래에 전체 예약 목록(누가 언제~언제)
2. **설비별 달력** — FullCalendar + 장비 체크박스 필터 (`#equipment-filter`)

**Duration:** `<select>` — `500`, `1000`, `2000`, `Direct Input`(선택 시 `#custom-duration-wrap` 표시)

**충돌 검사:** DB의 EXCLUDE 제약이 최종 판단. `api/reservations.js`는 INSERT를 먼저 시도하고, 제약 위반(409)이면 그때 재조회해서 "다음 예약 가능 시간"을 계산해 응답.

**성공 피드백:** 등록 성공 시 notice 표시 + 폼 리셋 + `allRecordsCache = null`로 캐시 무효화 후 현황 재조회.

## 장비 목록 (16종)

`EQUIPMENT_OPTIONS` — `js/app.js`(클라이언트 표시용)와 `api/_equipment.js`(서버 검증용) 두 곳에 동일하게 유지해야 함. 관리번호 포함 문자열 그대로 저장.

## 스타일 / UX 규칙 (사용자 선호)

- UI 라벨은 한국어 OK, **코드 주석은 영어** (한국어 주석 넣지 말 것) — 단, 이 문서 자체는 한국어 유지
- 미니멀 실험실 스타일: `#e0e0e0` border, 40px 필드 높이, 흰 입력 배경 (`css/style.css`)
- Equipment select는 **form 밖** — 장비 변경 시 오른쪽 현황(`renderReservationList`) 즉시 갱신
- Duration은 **select** (드롭다운, radio 아님)
- FullCalendar 이벤트는 custom `eventContent` + `.lab-event-chip` (hover 전에도 색 보이게)
- 예약 현황 패널은 목록만 나열하지 말고 **"지금 쓸 수 있는지/얼마나 기다려야 하는지"를 맨 위에 한 줄로 요약**할 것 (이 앱의 핵심 목적)

## 보안

- DB 연결 문자열은 **Vercel Environment Variables만** 사용 (Neon 연동 시 자동 등록, `api/_db.js`가 `process.env.DATABASE_URL`로 조회)
- `.env`는 gitignore
- DB 호출은 반드시 `api/*.js` 서버 측에서만 — 브라우저(`js/app.js`)는 `DATABASE_URL`을 절대 알지 못함

## 알려진 이슈 / 해결 이력

| 이슈 | 해결 |
|------|------|
| Streamlit은 Vercel과 호환 불가 | 정적 사이트 + Serverless Function으로 전면 재작성 |
| Notion 설정 마찰(토큰 발급/DB 연결/속성 이름·타입 수동 생성) 큼 | Neon Postgres로 전환, 스키마는 앱이 자동 생성 |
| `@vercel/postgres` deprecated | `@neondatabase/serverless` 직접 사용으로 전환 |
| 예약 충돌 체크의 레이스 컨디션 | 애플리케이션 코드가 아니라 DB의 GiST EXCLUDE 제약으로 강제 |
| KST 9h offset | 클라이언트 `toKstIsoRange()`가 UTC 기반 계산으로 `+09:00` 명시 |
| 연속 예약(뒷사람이 바로 이어받음)을 개별 건으로만 보면 대기시간이 짧게 표시됨 | `mergeIntervals()`로 맞닿은 예약을 하나의 구간으로 합쳐서 계산 |

## 남은 작업 (우선순위)

1. **Vercel Storage에서 Neon 연결 + `DATABASE_URL` 환경변수 등록 확인**
2. **Vercel 배포 완료** — 외부 URL 공유
3. (선택) 배포 후 예약 등록·충돌검사·달력 E2E 확인
4. (선택) `main` 브랜치가 최신 기능(상태 배지, Postgres 전환)을 반영하고 있는지 확인 — 작업 브랜치에서 PR 머지 필요할 수 있음

## Git

```bash
git status
git add ...
git commit -m "..."
git push origin main
```

커밋은 사용자가 요청할 때만. `.env`는 절대 커밋하지 말 것.

## 의존성

`@neondatabase/serverless` (Neon Postgres 드라이버). Vercel Node 런타임 20+ 기준.
