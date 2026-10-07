import {test} from 'node:test';
import assert from 'node:assert/strict';
import {aggregateBars} from './chartTools.js';
import {compareThemeMembers} from './renderThemes.js';
test('weekly and monthly bars use actual session OHLC and summed volume, sorted and deduplicated',()=>{
 const b=(date:string,open:number,close:number,volume:number)=>({date,open,high:Math.max(open,close)+2,low:Math.min(open,close)-2,close,volume});
 const rows=[b('2026-10-07',20,25,30),b('2026-09-30',10,12,10),b('2026-10-05',12,20,20),b('2026-10-07',20,24,40)];
 const w=aggregateBars(rows,'W');assert.equal(w.length,2);assert.deepEqual(w[1],{time:'2026-10-05',date:'2026-10-05',open:12,high:26,low:10,close:24,volume:60});
 const m=aggregateBars(rows,'M');assert.equal(m.length,2);assert.equal(m[0]?.time,'2026-09-01');assert.equal(m[1]?.open,12);assert.equal(m[1]?.volume,60);
});
test('theme sorting keeps missing values last in both directions and distinguishes price, value, cap and name',()=>{
 const a=['A','가',10,0,100,1000],b=['B','나',20,-1,200,500],missing=['C','다',null,null,null,null];
 for(const asc of [true,false])assert.ok(compareThemeMembers(missing,a,'change',asc)>0);
 assert.ok(compareThemeMembers(a,b,'value')>0);assert.ok(compareThemeMembers(a,b,'cap')<0);assert.ok(compareThemeMembers(a,b,'price',true)<0);assert.ok(compareThemeMembers(a,b,'name',true)<0);assert.ok(compareThemeMembers(a,b,'change')<0);
});
