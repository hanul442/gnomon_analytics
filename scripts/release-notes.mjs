// docs/RELEASE_NOTES.md from src/report/releases.ts (G-180): one place for every version's note, so the
// updates page, the 🔔 release note and the docs never drift. Run after `npm run build`: node scripts/release-notes.mjs
import { writeFile } from 'node:fs/promises';
const { RELEASES, VERSION } = await import('../dist/report/releases.js');
const lines = ['# GNOMON 릴리스 노트', '', `현재 버전 **v${VERSION}**. 이 파일은 \`src/report/releases.ts\`에서 \`node scripts/release-notes.mjs\`로 만들어요. 손으로 고치지 말고 releases.ts를 고친 뒤 다시 만드세요.`, '',
  '## 릴리스 절차 (G-177)', '', '1. 브랜치에 그날의 수정을 모아 저녁에 PR 하나로 올려요. 버전은 PR당 한 번만 올려요(`VERSION`과 `RELEASES` 맨 위 항목).', '2. 머지 전 `/code-review`로 지적을 받고 반영해요. `npx tsc` · `npm test` · `check-ui`가 모두 통과해야 해요.', '3. 머지하면 Pages 배포 뒤 `version.json`이 바뀌고, Worker가 10분 안에 업데이트 알림을 보내요. **마이너(x.Y.0)만 전원에게**, 패치(x.Y.Z)는 "작은 업데이트도 알림"을 켠 사용자에게만. 밤 10시~아침 8시(KST)에 나온 버전은 아침 8시 이후에 보내요.', '4. 급한 버그 수정만 예외로 낮에 패치 버전으로 올려요.', '',
  '## 버전별 변경 사항', ''];
for (const [v, date, note] of RELEASES) lines.push(`### v${v} · ${date}`, '', note, '');
await writeFile(new URL('../docs/RELEASE_NOTES.md', import.meta.url), lines.join('\n'));
console.log('docs/RELEASE_NOTES.md', RELEASES.length, 'versions');
