const ranges=new Set(['7d','30d','3m','1y']);
export function requestedRange(text='') {
 const found=[...text.matchAll(/(?:^|\s)(7d|30d|3m|1y)(?=$|\s|[?.!,])/gi)].map(x=>x[1].toLowerCase());
 return found.length?found[0]:'30d';
}
export function rangeStart(range,now) {
 const date=new Date(now);date.setUTCHours(0,0,0,0);
 if(range==='3m'){const day=date.getUTCDate();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()-3);const last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();date.setUTCDate(Math.min(day,last));}
 else date.setUTCDate(date.getUTCDate()-(range==='1y'?365:range==='7d'?7:30));
 return date.toISOString().slice(0,10);
}
export function chartForRange(quote,range,now) {
 if(!ranges.has(range))throw Error('Unsupported chart range');
 if(quote.fixture)return {points:quote.history,notice:'DEMO history, not market data.'};
 if(range==='1y'&&quote.priceKind!=='delayed-quote')return {points:[],notice:'1y chart unavailable on the US free daily-history plan (100 trading days).'};
 if(quote.priceKind==='delayed-quote'&&(!quote.historyFrom||quote.historyFrom>rangeStart(range,now)))return {points:[],notice:`${range} chart unavailable: cached history does not cover requested range.`};
 if(quote.rangeUnavailable)return {points:[],notice:quote.rangeUnavailable};
 if(!quote.history.length)return {points:[],notice:`${range} chart unavailable: daily history is not available from this provider or quota.`};
 if(['3m','1y'].includes(range)&&Date.parse(quote.history[0].date)-Date.parse(rangeStart(range,now))>7*86400000)return {points:[],notice:`${range} chart unavailable: returned history does not cover the period (new listing or incomplete source).`};
 const points=quote.history.filter(p=>p.date>=rangeStart(range,now));
 return points.length>=2?{points,notice:null}:{points:[],notice:`${range} chart unavailable: fewer than two daily closes in this period.`};
}
