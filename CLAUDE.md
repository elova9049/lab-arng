# Claude Code Handoff — 시험 장비 예약

Streamlit + Notion 연동 실험실 장비 예약 앱. 이 문서를 먼저 읽고 작업을 이어가세요.

## 프로젝트 목적

연구소 시험 장비(16종)의 사용 예약을 등록하고, Notion DB와 동기화하며, 실시간 현황·달력으로 확인하는 내부용 웹앱.

## 기술 스택

- **Python 3** + **Streamlit** (`app.py` 단일 파일)
- **notion-client** — Notion API
- **FullCalendar 6** — `streamlit.components.v1.html` 임베드 (설비별 달력 탭)

## 저장소

- **GitHub:** https://github.com/elova9049/lab-arng
- **브랜치:** `main`
- **메인 파일:** `app.py` (Streamlit Cloud 배포 시 이 경로 사용)

## 로컬 실행

```powershell
cd C:\Users\elova\lab_diary
pip install -r requirements.txt
```

`.streamlit/secrets.toml` 생성 (템플릿: `.streamlit/secrets.toml.example`):

```toml
NOTION_TOKEN = "노션_통합_토큰"
DATABASE_ID = "노션_데이터베이스_ID"
```

```powershell
python -m streamlit run app.py
```

→ http://localhost:8501

## Render 배포 (미완료 — 이어서 진행)

Streamlit은 웹소켓 기반 상주형 서버라 Vercel/Netlify(서버리스)와 궁합이 안 맞아 **Render**를 사용. 저장소 루트의 `render.yaml`(Blueprint)로 빌드/시작 명령이 자동 설정됨.

1. https://dashboard.render.com → GitHub 연동
2. **New +** → **Blueprint** → Repository: `elova9049/lab-arng` 선택 (또는 **Web Service**로 수동 생성 시 아래 값 입력)
   - Branch: **`main`**
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `streamlit run app.py --server.port $PORT --server.address 0.0.0.0 --server.headless true`
3. Environment → 환경변수 추가:

```
NOTION_TOKEN = ...
DATABASE_ID = ...
```

(`app.py`의 `get_secret()`이 `st.secrets` → 환경변수 순으로 조회하므로 `secrets.toml` 없이 Render에서 그대로 동작함)

4. Deploy 후 생성된 `*.onrender.com` URL을 팀에 공유

**참고:** Free plan은 일정 시간 미사용 시 슬립되며 재접속 시 콜드스타트(수십 초)가 발생할 수 있음. 상시 구동이 필요하면 유료 plan으로 업그레이드.

### (참고) Streamlit Cloud로 배포하는 경우

1. https://share.streamlit.io → GitHub 연동 → Repository: `elova9049/lab-arng` → Branch `main` / Main file `app.py`
2. Advanced settings → Secrets에 `NOTION_TOKEN`, `DATABASE_ID` (TOML 형식) 입력
3. 배포 화면에서 `This branch does not exist`가 나오면 GitHub App 권한([settings/installations](https://github.com/settings/installations) → Streamlit → `lab-arng` 저장소 허용) 확인 후 저장소 URL을 다시 붙여넣기

## 파일 구조

```
lab_diary/
├── app.py                          # 전체 앱 (UI + Notion + 달력)
├── requirements.txt
├── CLAUDE.md                       # 이 파일
├── README.md
├── .gitignore                      # secrets.toml 제외
├── render.yaml                     # Render Blueprint (build/start 명령)
└── .streamlit/
    ├── config.toml                 # 라이트 테마
    ├── secrets.toml                # 로컬 전용 (gitignore)
    └── secrets.toml.example        # 배포 템플릿
```

## Notion DB 스키마

| 속성명 (코드 상수) | Notion 타입 | 용도 |
|-------------------|-------------|------|
| `이름` (`NAME_PROPERTY`) | title | 예약자 이름 |
| `태그` (`TAG_PROPERTY`) | multi_select | 장비명 (EQUIPMENT_OPTIONS 값과 일치해야 함) |
| `날짜` (`DATE_PROPERTY`) | date (start/end) | 예약 기간 |

### API 주의사항

- **`databases.query()` 사용 금지** — `'DatabasesEndpoint' object has no attribute 'query'` 오류 발생
- 올바른 흐름:
  1. `notion.databases.retrieve(database_id)` → `data_sources[0]["id"]`
  2. `notion.data_sources.query(data_source_id=..., filter=...)`
- 구현: `resolve_data_source_id()`, `query_reservation_pages()`

### 시간대

- KST 고정: `to_notion_iso()` → `YYYY-MM-DDTHH:MM:SS+09:00`
- 9시간 밀림 방지를 위해 `+09:00` 명시 필수

## UI 구조

**앱 제목:** 시험 장비 예약

**탭:**
1. **예약 등록** — 2열 레이아웃
   - 왼쪽: Name, Equipment(selectbox, form 밖), Start Date/Time, Duration, Register
   - 오른쪽: **장비 예약 현황** (선택 장비의 활성 예약)
2. **설비별 달력** — FullCalendar + 장비 multiselect 필터

**Duration:** `st.selectbox` — `500`, `1000`, `2000`, `Direct Input` (Direct Input 시 number_input)

**충돌 검사:** 같은 장비·겹치는 시간대면 Notion 생성 거부, 다음 가능 시간 안내

**성공 피드백:** `st.session_state["last_notice"]` + `st.rerun()`; 캐시 `fetch_all_reservation_records.clear()`

## 장비 목록 (16종)

`EQUIPMENT_OPTIONS` in `app.py` — 관리번호 포함 문자열 그대로 Notion multi_select에 저장.

## 스타일 / UX 규칙 (사용자 선호)

- UI 라벨은 한국어 OK, **코드 주석은 영어** (한국어 주석 넣지 말 것)
- 미니멀 실험실 스타일: `#e0e0e0` border, 40px 필드 높이, 흰 입력 배경
- Equipment selectbox는 **form 밖** — 장비 변경 시 오른쪽 현황 즉시 갱신
- Duration은 **radio가 아니라 selectbox** (드롭다운)
- FullCalendar 이벤트는 custom `eventContent` + `.lab-event-chip` (hover 전에도 색 보이게)

## 보안

- 토큰/DB ID는 **`st.secrets`만** 사용 (`app.py`에 하드코딩 금지)
- `.streamlit/secrets.toml`은 gitignore
- 예전에 `app.py`에 토큰이 있었다면 Notion에서 **토큰 재발급** 권장

## 알려진 이슈 / 해결 이력

| 이슈 | 해결 |
|------|------|
| Notion query API | `data_sources.query` 사용 |
| KST 9h offset | `+09:00` suffix |
| 달력 이벤트 hover 전 invisible | `eventContent` 커스텀 렌더 |
| IndentationError line 941 | `pages.create`를 `else` 블록 안으로 수정 완료 |

## 남은 작업 (우선순위)

1. **Render 배포 완료** — 외부 URL 공유
2. (선택) 배포 후 Notion 연동·예약 등록·달력 E2E 확인
3. (선택) Notion integration이 해당 DB에 read/write 권한 있는지 확인

## Git

```powershell
git status
git add ...
git commit -m "..."
git push origin main
```

커밋은 사용자가 요청할 때만. `secrets.toml`은 절대 커밋하지 말 것.

## 의존성

```
streamlit>=1.29.0
notion-client>=2.2.1
```
