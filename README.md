# 시험 장비 예약

Streamlit 기반 실험실 장비 예약 앱. Notion 데이터베이스와 연동합니다.

## 기능

- 장비별 예약 등록 (이름, 시작 일시, 테스트 시간)
- 실시간 **장비 예약 현황** (선택 장비)
- **설비별 달력** (FullCalendar, 장비 필터)

## 로컬 실행

```powershell
pip install -r requirements.txt
```

`.streamlit/secrets.toml` 파일을 만듭니다 (`.streamlit/secrets.toml.example` 참고):

```toml
NOTION_TOKEN = "your_notion_integration_token"
DATABASE_ID = "your_notion_database_id"
```

```powershell
python -m streamlit run app.py
```

## 배포 (Render)

1. [dashboard.render.com](https://dashboard.render.com) — GitHub 연동 후 **New +** → **Blueprint** → Repository: `elova9049/lab-arng` (저장소의 `render.yaml`이 빌드/시작 명령을 자동 설정)
2. Environment에 `NOTION_TOKEN`, `DATABASE_ID` 환경변수 설정
3. Deploy 후 `*.onrender.com` URL 공유

## Claude Code / AI 이어하기

프로젝트 컨텍스트·Notion API·미완료 작업은 **[CLAUDE.md](./CLAUDE.md)** 를 참고하세요.
