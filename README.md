# 시험 장비 예약

정적 HTML/CSS/JS + Vercel Serverless Function 기반 실험실 장비 예약 앱. Neon(Postgres) 데이터베이스와 연동합니다.

## 기능

- 장비별 예약 등록 (이름, 시작 일시, 테스트 시간)
- 실시간 **장비 예약 현황** — 지금 사용 가능한지, 얼마나 기다려야 하는지 한눈에 표시
- **설비별 달력** (FullCalendar, 장비 필터)

## 로컬 실행

```bash
npm install -g vercel
npm install
vercel dev
```

DB 연결 정보(`DATABASE_URL`)가 필요합니다. Vercel에 Neon을 연결해뒀다면:

```bash
vercel env pull .env.development.local
```

→ http://localhost:3000

## 배포 (Vercel + Neon Postgres)

1. [vercel.com](https://vercel.com) → GitHub 연동 → Repository: `elova9049/lab-arng` import
2. Framework Preset: **Other** (빌드 명령 없음, 정적 파일 그대로 서빙)
3. 프로젝트 → **Storage** 탭 → **Create Database** → **Neon (Postgres)** 선택 → 연결
   → `DATABASE_URL`이 환경변수로 자동 등록됨 (직접 값 복사할 필요 없음)
4. Deploy 후 생성된 `*.vercel.app` URL 공유

테이블은 앱이 첫 요청 시 자동으로 생성합니다 (별도 마이그레이션 불필요).

## Claude Code / AI 이어하기

프로젝트 컨텍스트·DB 스키마·미완료 작업은 **[CLAUDE.md](./CLAUDE.md)** 를 참고하세요.
