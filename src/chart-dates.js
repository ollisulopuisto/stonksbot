const DAY=86400000,months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export function dateAxis(points,range='30d'){
 const dates=points.map(p=>Date.parse(p.date));if(dates.some((t,i)=>!Number.isFinite(t)||(i&&t<=dates[i-1])))throw Error('Chart dates must increase');
 const start=dates[0],end=dates.at(-1),span=end-start||DAY;
 const period=String(range).split(' ')[0],monthly=['3m','1y'].includes(period),ticks=[];
 // At most1001calendar days, independent of caller point count.
 for(let t=start,n=0;t<=end&&n<=1000;t+=DAY,n++){
  const d=new Date(t),weekday=d.getUTCDay();
  const keep=monthly?d.getUTCDate()===1:period==='7d'?weekday>0&&weekday<6:weekday===1;if(!keep)continue;
  ticks.push({date:d.toISOString().slice(0,10),fraction:(t-start)/span,label:monthly?months[d.getUTCMonth()]:period==='7d'?['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][weekday]:months[d.getUTCMonth()]+' '+d.getUTCDate(),year:monthly&&d.getUTCMonth()===0?String(d.getUTCFullYear()):null});
 }
 return {fractions:dates.map(t=>(t-start)/span),ticks};
}
