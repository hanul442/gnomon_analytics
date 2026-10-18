// G-234: terms.html (이용약관 + 운영 정책) and privacy.html (개인정보처리방침), drawn from legalText.ts.
// Articles are numbered because terms are cited by article; each gets an anchor so a notice can link "#t8".

import { shell } from './renderHtml.js';
import { esc } from './html.js';
import { TERMS_MD, PRIVACY_MD, POLICY_MD } from './legalText.js';

export const LEGAL_UPDATED = '2026-10-18';

type Article = { no: string; title: string; lead: string; body: string[] };

/** Splits the text into articles: a paragraph that starts with **제N조 (제목)** or **부칙** opens one. */
export function parseArticles(md: string): Article[] {
  const arts: Article[] = [];
  for (const block of md.split(/\n{2,}/)) {
    const head = /^\*\*(제\d+조|부칙)(?: \(([^)]*)\))?\*\*\s*(.*)$/s.exec(block);
    if (head) { arts.push({ no: head[1]!, title: head[2] ?? '', lead: head[3]!.trim(), body: [] }); continue; }
    arts.at(-1)?.body.push(block);
  }
  return arts;
}

function list(lines: string[]): string {
  const items: { text: string; sub: string[] }[] = [];
  for (const line of lines) {
    const sub = /^ {4}\d+\.\s+(.*)$/.exec(line);
    const top = /^\d+\.\s+(.*)$/.exec(line);
    if (sub && items.length) items.at(-1)!.sub.push(sub[1]!);
    else if (top) items.push({ text: top[1]!, sub: [] });
    else if (items.length) items.at(-1)!.text += ' ' + line.trim();
  }
  const start = Number(/^(\d+)\./.exec(lines[0]!)?.[1] ?? 1);
  return `<ol class="tm-list"${start > 1 ? ` start="${start}"` : ''}>${items.map((i) => `<li>${esc(i.text)}${i.sub.length ? `<ol class="tm-sub">${i.sub.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}</li>`).join('')}</ol>`;
}

function table(lines: string[]): string {
  const cells = (l: string) => l.replace(/^\||\|$/g, '').split('|').map((c) => esc(c.trim()));
  const [head, , ...rows] = lines;
  return `<div class="tm-table"><table><thead><tr>${cells(head!).map((c) => `<th scope="col">${c}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${cells(r).map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function block(md: string): string {
  const lines = md.split('\n');
  if (lines[0]!.startsWith('|')) return table(lines);
  if (/^\d+\.\s/.test(lines[0]!)) return list(lines);
  return `<p>${esc(md.replace(/\n/g, ' '))}</p>`;
}

function articleHtml(a: Article, id: string): string {
  const title = a.no === '부칙' ? '<span class="tm-no">부칙</span>' : `<span class="tm-no">${a.no}</span>${esc(a.title)}`;
  return `<section class="block" id="${id}"><div class="card terms"><h2>${title}</h2>${a.lead ? `<p>${esc(a.lead)}</p>` : ''}${a.body.map(block).join('')}</div></section>`;
}

const toc = (arts: Article[], prefix: string) => arts.filter((a) => a.no !== '부칙').map((a, i) => `<a href="#${prefix}${i + 1}">${a.no} ${esc(a.title)}</a>`).join('');
const articles = (arts: Article[], prefix: string) => arts.map((a, i) => articleHtml(a, a.no === '부칙' ? `${prefix}-end` : `${prefix}${i + 1}`)).join('\n');

const CSS = `<style>.tm-key h2{margin:0 0 12px}.tm-keys{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.tm-keys li{display:flex;flex-direction:column;gap:6px;padding:14px 16px;border-radius:16px;background:var(--soft);border:1px solid var(--line)}.tm-keys b{font-size:15.5px}.tm-keys span{font-size:13.5px;line-height:1.6;color:var(--fg2)}
.tm-toc{display:flex;flex-wrap:wrap;gap:6px}.tm-toc a{border:1px solid var(--line-strong);background:var(--surface);border-radius:999px;padding:6px 12px;font-size:13px;font-weight:700;text-decoration:none;color:var(--fg)}
.tm-part{margin:28px 0 4px;font-size:20px}
.terms{scroll-margin-top:90px}.terms h2{display:flex;align-items:baseline;gap:10px;margin:0 0 12px;font-size:17px}.tm-no{font-size:13px;font-weight:800;color:var(--accent-strong)}.terms p{margin:0 0 10px;line-height:1.75}.tm-list{margin:0;padding-left:22px}.tm-list li{margin:0 0 8px;line-height:1.75}.tm-sub{margin:6px 0 0;padding-left:20px;list-style:lower-alpha}
.tm-table{overflow-x:auto;margin:6px 0 12px}.tm-table table{border-collapse:collapse;width:100%;min-width:560px;font-size:13.5px}.tm-table th,.tm-table td{border:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top;line-height:1.6}.tm-table th{background:var(--soft);font-weight:700}
@media (max-width:820px){.tm-keys{grid-template-columns:1fr}}</style>`;

const hero = (eyebrow: string, title: string) => `<section class="hero" id="top"><div class="hero-main"><div class="eyebrow"><span>${eyebrow}</span><span>법률 검토 전</span></div><h1>${title}</h1>
<p class="hero-line">법률 검토를 받기 전의 문서예요. 비공개 베타 시작일(2026년 11월 예정)부터 시행하고, 유료 서비스를 열기 전에 검토를 거쳐 바뀔 수 있어요. 마지막 수정 ${LEGAL_UPDATED}.</p></div></section>`;

export function renderTerms(): string {
  const terms = parseArticles(TERMS_MD), policy = parseArticles(POLICY_MD);
  const body = `${hero('이용약관 · 운영 정책', '이용약관과 운영 정책')}
<section class="block"><div class="card tm-key"><h2>꼭 알아 두세요</h2><ol class="tm-keys">
<li><b>투자 권유가 아니에요</b><span>모두에게 같은 계산과 AI 해설이고, 투자 판단과 결과는 본인 책임이에요. (제8조)</span></li>
<li><b>AI가 쓴 해설이에요</b><span>생성형 AI가 쓴 글에는 표시를 붙이고, 틀린 판단도 지우지 않고 채점해 공개해요. (제12조, 제17조)</span></li>
<li><b>개인정보는 따로 정했어요</b><span>무엇을 모으고 어디에 맡기는지는 <a href="privacy.html">개인정보처리방침</a>에 있어요.</span></li>
</ol></div></section>
<nav class="block tm-toc" aria-label="이용약관 조항 목록">${toc(terms, 't')}</nav>
${articles(terms, 't')}
<h2 class="tm-part" id="policy">운영 정책</h2>
<nav class="block tm-toc" aria-label="운영 정책 조항 목록">${toc(policy, 'o')}</nav>
${articles(policy, 'o')}
<footer id="sources" style="padding:24px 0 0"><p>마지막 수정 ${LEGAL_UPDATED} · <a href="privacy.html">개인정보처리방침</a> · 투자 권유가 아니에요.</p></footer>${CSS}`;
  return shell('', '이용약관·운영 정책 | GNOMON', body, {});
}

export function renderPrivacy(): string {
  const arts = parseArticles(PRIVACY_MD);
  const intro = PRIVACY_MD.split(/\n{2,}/)[0]!;
  const body = `${hero('개인정보처리방침', '개인정보처리방침')}
<section class="block"><div class="card terms"><p>${esc(intro)}</p></div></section>
<nav class="block tm-toc" aria-label="조항 목록">${toc(arts, 'p')}</nav>
${articles(arts, 'p')}
<footer id="sources" style="padding:24px 0 0"><p>마지막 수정 ${LEGAL_UPDATED} · <a href="terms.html">이용약관</a></p></footer>${CSS}`;
  return shell('', '개인정보처리방침 | GNOMON', body, {});
}
