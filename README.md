# Gnomon Analytics (GNM)

SK하이닉스 한 종목의 **일일 리포트**예요. 평일 장이 끝난 뒤(18:30 KST) 가격 움직임과 새 공시를 모아서, 무슨 일이 있었고 왜 중요한지 정적 웹페이지로 보여줘요.

- 설계와 결정: [docs/DESIGN.md](docs/DESIGN.md)
- 투자 권유가 아니에요. 매매 기능은 없어요.

## 동작

| 단계 | 내용 |
|---|---|
| 수집 | Naver 일봉(가격), OpenDART(공시) |
| 저장 | `data/` 아래 JSONL. 추가만 하고 고쳐 쓰지 않아요 |
| 리포트 | `reports/YYYY-MM-DD.json`. 그날 한 번만 만들고 그대로 보관해요 |
| 화면 | `site/` → GitHub Pages |

## 로컬 실행

```bash
npm ci
npm test
OPENDART_API_KEY=... npm run build && npm run daily
```

## 설정

- **`OPENDART_API_KEY`:** GitHub 저장소 Settings → Secrets and variables → Actions에 넣어요. 키는 https://opendart.fss.or.kr 에서 무료로 발급해요.
- **GitHub Pages:** Settings → Pages → Source를 **GitHub Actions**로 바꿔요.
