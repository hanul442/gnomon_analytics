# Gnomon Analytics (GNM)

**사이트: https://hanul442.github.io/gnomon_analytics/**

코스피·코스닥 종목 리서치 대시보드예요. 공개 데이터로 기술 신호, 적정가, 예측 범위, 전략 대결, 수급, 실적을 계산하고 AI 위원회 해설을 붙여요. 예측과 판단은 기록해 두고 나중에 채점해요.

- 첫 화면: 전 종목 검색, 매일 리포트(대표 종목), 요청한 리포트, 이번 주 선정 35종목
- 종목 화면: 홈, 차트, 기술 분석, 모의투자, 수급, 펀더멘털, AI 위원회, 뉴스·공시
- 설계와 결정: [docs/DESIGN.md](docs/DESIGN.md)
- 투자 권유가 아니에요. 실제 매매 기능은 없어요.

## 동작

평일 장 마감 뒤(18:30 KST) GitHub Actions가 한 번 돌아요.

| 단계 | 내용 |
|---|---|
| 수집 | 네이버 증권(가격·수급·실적·전 종목 목록), OpenDART(공시), 뉴스 검색·RSS |
| 저장 | `data/` 아래 JSONL. 추가만 하고 고쳐 쓰지 않아요 |
| 선정 | 금요일에 주간 35종목을 골라 `data/selections/`에 남겨요 |
| 리포트 | `reports/<종목코드>/<날짜>.json`. 그날 한 번만 만들고 그대로 보관해요 |
| 화면 | `site/` → GitHub Pages |

## 종목 설정

- `tickers.json`: 매일 리포트하는 대표 종목
- `requests.json`: 리포트를 요청한 종목. 다음 장 마감 뒤에 심층 AI 리포트를 한 번 써요.

## 로컬 실행

```bash
npm ci
npm test
OPENDART_API_KEY=... npm run build && npm run daily
```

## 설정

- **Secrets** (Settings → Secrets and variables → Actions): `OPENDART_API_KEY`, `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `ANTHROPIC_API_KEY`
- **GitHub Pages:** Settings → Pages → Source를 **GitHub Actions**로 둬요.
- 마지막 실행에서 실패한 수집 출처는 `data/status/last-run.json`에서 볼 수 있어요.
