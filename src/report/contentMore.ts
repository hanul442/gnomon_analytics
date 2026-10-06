/** Native expansion works for static pages and API fragments without extra initialization. */
export function contentMore(rows:readonly string[],label:string,wrap:(html:string)=>string=(html)=>html):string {
 const limit=5;
 return wrap(rows.slice(0,limit).join(''))+(rows.length>limit?`<details class="more content-more"><summary><span class="more-closed">${label} 더 보기 (${rows.length-limit}건)</span><span class="more-open">${label} 접기</span></summary>${wrap(rows.slice(limit).join(''))}</details>`:'');
}
export const CONTENT_MORE_CSS='.content-more>summary .more-open{display:none}.content-more[open]>summary .more-open{display:inline}.content-more[open]>summary .more-closed{display:none}.content-more>summary{padding:10px 0;cursor:pointer}';
