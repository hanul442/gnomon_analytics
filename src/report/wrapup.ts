// Alpha wrap-up (G-241): the last survey of the alpha and the closed-beta application in one form. One notice
// goes to every alpha tester seven days before the alpha ends (🔔, phone push, mail); the home pop-up and banner
// ask for it until the end. Applying for the beta only records interest in the survey answers: it never
// changes a plan or makes an account (beta accounts stay off until 한서 turns them on).

/** 2026-10-24 10:00 KST (seven days before the end) to 2026-10-31 24:00 KST, when the alpha closes. */
export const WRAPUP = { from: '2026-10-24T01:00:00Z', until: '2026-10-31T15:00:00Z', end: '10월 31일' } as const;
export const inWrapup = (now: Date): boolean => now.getTime() >= Date.parse(WRAPUP.from) && now.getTime() < Date.parse(WRAPUP.until);

export const WRAPUP_LINK = 'survey.html?k=wrapup';
/** The answer to the beta question that counts as an application. */
export const BETA_YES = '신청할게요';

/** The notice: 🔔 and push use title/body, the mail adds the longer lines. */
export const WRAPUP_NOTICE = {
  title: '알파 마무리 설문 · 클로즈드 베타 신청',
  body: `알파 테스트가 ${WRAPUP.end}에 끝나요. 3분 설문에 답하고, 원하시면 다음 테스트(클로즈드 베타)도 같이 신청해 주세요.`,
  mail: [
    `그동안 그노몬 알파 테스트에 함께해 주셔서 고마워요. 알파는 ${WRAPUP.end}에 끝나요.`,
    '마지막으로 3분만 내어 써 보신 소감을 알려 주세요. 무엇을 남기고 무엇을 뺄지 이 답으로 정해요.',
    '설문 끝에서 클로즈드 베타를 신청할 수 있어요. 신청하신 분께는 일정이 정해지면 이메일로 먼저 알려 드려요. 신청만으로 계정이 바뀌지는 않아요.',
  ],
  cta: '설문하고 베타 신청하기',
} as const;
