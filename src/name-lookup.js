import { readFile } from 'node:fs/promises';
import { loadHelsinkiSymbols } from './helsinki-symbols.js';
export const normalizeName=s=>s.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const coreName=s=>normalizeName(s.split(' - ')[0]).replace(/\b(incorporated|inc|corporation|corp|company|co|plc|oyj|abp|ab|ltd|limited|class [ab]|common stock|common shares)\b/g,' ').replace(/\s+/g,' ').trim();
export async function loadNameIndex(overridePath){
 const us=JSON.parse(await readFile(new URL('../data/us-symbol-names.json',import.meta.url),'utf8'));
 const he=await loadHelsinkiSymbols(overridePath);
 const aliases=JSON.parse(await readFile(new URL('../data/brand-aliases.json',import.meta.url),'utf8')).aliases;
 const items=[...us.entries.map(x=>({...x,canonical:x.symbol})),...[...he.values()].map(x=>({...x,canonical:x.route.endsWith('.HE')?x.route:x.route.slice(0,-3)}))];
 const index=items.map(x=>({...x,normalized:coreName(x.name),commonStock:x.commonStock??true}));index.aliases=aliases;return index;
}
function similarity(a,b){
 const row=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){let prev=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]!==b[j-1]));prev=old;}}
 return 1-row[b.length]/Math.max(a.length,b.length);
}
export function resolveName(index,input,{strict=false,namesOnly=false}={}){
 const ticker=input.toUpperCase();
 // Ticker identity wins before name matching; preserve existing bare routing.
 const exact=index.filter(x=>x.symbol===ticker);
 if(!namesOnly&&exact.length)return {symbol:exact.find(x=>x.route.endsWith('.HE'))?.canonical??exact[0].canonical,route:ticker,name:null};
 const query=normalizeName(input);
 const alias=index.aliases?.[query];if(alias){const item=index.find(x=>x.route===alias);if(item)return {symbol:item.canonical,route:item.route,name:item.name,strong:true};}
 if(new Set(['help','test','thanks','hello','ping','status','hi','hey']).has(query))return {notice:'',strong:false};if(query.length<3||query.length>80)return {notice:'No confident instrument match. Use a ticker.'};
 const ranked=index.map(item=>{
  const n=item.normalized;
  let score=n===query?1.2:strict?0:n.startsWith(query)&&query.length>=4?0.75+0.2*query.length/n.length:similarity(query,n);
  if(n!==query&&(!item.commonStock||item.etf==='Y'||/warrant|preferred|depositary shares/i.test(item.name)))score-=0.12;
  return {item,score};
 }).filter(x=>x.score>=0.45).sort((a,b)=>b.score-a.score||a.item.route.localeCompare(b.item.route));
 // Same canonical listing repeated in aliases is one candidate, not a tie.
 const candidates=ranked.filter((x,i,all)=>all.findIndex(y=>y.item.route===x.item.route)===i);
 const best=candidates[0],second=candidates[1];
 const threshold=query.length>=4?0.79:0.95;
 if(best&&best.score>=threshold&&(!second||best.score-second.score>=0.12))return {symbol:best.item.canonical,route:best.item.route,name:best.item.name,strong:best.score>=0.79};
 if(strict&&!candidates.length)return {notice:'No confident instrument match. Use a ticker.',strong:false};
 return {strong:!!best&&best.score>=0.75,notice:candidates.length?'Did you mean '+candidates.slice(0,3).map(x=>`${x.item.name} ($${x.item.canonical})`).join(' or ')+'? Use a ticker.':'No confident instrument match. Use a ticker.'};
}
