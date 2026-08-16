# 시험 장비 예약

정적 HTML/CSS/JS + Vercel Serverless Function 기반 실험실 장비 예약 앱. Notion 데이터베이스와 연동합니다.

## 기능

- 장비별 예약 등록 (이름, 시작 일시, 테스트 시간)
- 실시간 **장비 예약 현황** (선택 장비)
- **설비별 달력** (FullCalendar, 장비 필터)

## 로컬 실행

```bash
npm install -g vercel
vercel dev
```

`NOTION_TOKEN`, `DATABASE_ID` 환경변수가 필요합니다. `.env` 파일을 만들거나 `vercel env pull`로 받으세요:

```
NOTION_TOKEN=your_notion_integration_token
DATABASE_ID=your_notion_database_id
```

→ http://localhost:3000

## 배포 (Vercel)

1. [vercel.com](https://vercel.com) → GitHub 연동 → Repository: `elova9049/lab-arng` import
2. Framework Preset: **Other** (빌드 명령 없음, 정적 파일 그대로 서빙)
3. Project Settings → Environment Variables에 `NOTION_TOKEN`, `DATABASE_ID` 추가
4. Deploy 후 생성된 `*.vercel.app` URL 공유

## Claude Code / AI 이어하기

프로젝트 컨텍스트·Notion API·미완료 작업은 **[CLAUDE.md](./CLAUDE.md)** 를 참고하세요.
