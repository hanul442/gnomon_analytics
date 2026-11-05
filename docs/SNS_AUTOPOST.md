# SNS 자동 게시 (G-321)

매일 실행이 만든 카드와 글(`promo/<날짜>/`, G-309)을 `.github/workflows/promo-post.yml`이 올려요.

| 채널 | 언제 | 무엇 |
|---|---|---|
| X | 평일 매일 | `x.png` + `x.txt` (링크는 기본으로 빼고 "전체 리포트는 프로필 링크에서") |
| 인스타 스토리 | 평일 매일 | `story.jpg` |
| 인스타 게시물 | 평일 매일 (11/5 한서, 전엔 월·수·금) | 그날 캐러셀 `deckNN-*.jpg` 7~10장 (G-322, 금요일은 주간 성적표·틀린 판단 포함, `insta.txt` 글) |
| 네이버 블로그 | 금요일 | 글쓰기 API가 없어서 `promo-blog` 라벨 이슈로 글·그림을 보내요. 복사해서 붙여 넣기 |

- 실행: 매일 실행(Daily report)이 끝나면 바로, 그리고 08:10 KST에 한 번 더 (밤에 끝난 날 몫). 새벽(07시 전)엔 올리지 않아요.
- 자동 실행은 오늘·어제 카드만 올려요. 지난 날은 Actions → SNS auto-post → Run workflow에서 날짜를 적어 올려요.
- 한 번 올린 건 `promo/<날짜>/posted.json`에 남아서 두 번 올라가지 않아요.
- 올리기 전 검사(`checkText`): 수익률·적중률, 사라·팔라, 종목 추천·목표가, 리딩방, 돈 이야기(유료·할인·VIP), 단정, 군 복무 이야기가 있거나 "투자 권유가 아닌 교육용 자료예요"가 없으면 그 글은 올리지 않고 실행이 실패로 표시돼요.
- 인스타 API는 JPEG만 받아서, 카드를 만들 때 인스타용 카드는 `.jpg`도 함께 저장해요. 그림은 사이트(`/promo/<날짜>/`)에서 인스타가 가져가요.

## 켜고 끄기 (저장소 Settings → Secrets and variables → Actions → Variables)

| 변수 | 값 |
|---|---|
| `PROMO_POST` | 없음·`off` = 미리보기만 (실행 요약에 올릴 글이 보여요) · `manual` = Run workflow를 눌렀을 때만 올림 · `on` = 알아서 올림 |
| `PROMO_X_LINK` | `on`이면 X 글에 사이트 링크를 넣어요 (링크 있는 글은 X 요금이 훨씬 비싸요) |

처음엔 `manual`로 두고 카드 모음(`/promo/`)에서 확인한 뒤 Run workflow로 몇 번 올려 보고, 괜찮으면 `on`으로 바꿔요.

## Secrets (Settings → Secrets and variables → Actions → Secrets)

| 이름 | 어디서 |
|---|---|
| `X_API_KEY`, `X_API_SECRET` | developer.x.com → 앱 → Keys and tokens → Consumer Keys |
| `X_ACCESS_TOKEN`, `X_ACCESS_SECRET` | 같은 화면 Access Token and Secret (앱 권한을 Read and write로 바꾼 **뒤에** 만들어야 해요) |
| `IG_ACCESS_TOKEN` | developers.facebook.com → 앱 → Instagram → API setup with Instagram login → Generate token (60일짜리) |
| `IG_USER_ID` | 같은 화면의 인스타 계정 ID (없으면 `me`로 써요) |
| `GH_SECRETS_PAT` (선택) | 인스타 토큰이 새로 바뀌면 자동 저장. fine-grained 토큰, 이 저장소만, Secrets: Read and write |

인스타 토큰은 매주 월요일 09:20 KST에 자동으로 늘려요. 새 토큰이 나왔는데 `GH_SECRETS_PAT`가 없으면 실행이 실패로 표시돼요: 그때는 Generate token을 다시 눌러 `IG_ACCESS_TOKEN`을 바꿔요.
