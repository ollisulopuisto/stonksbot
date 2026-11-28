// Explicit interoperability aliases only. Never guess suffixes or currencies.
export function eodhdSymbol(input){
 const symbol=String(input).toUpperCase();
 if(symbol==='EUNL')return 'EUNL.XETRA';
 return symbol.replace(/\.DE$/,'.XETRA');
}
export const markets={HE:{mic:'XHEL',currency:'EUR',zone:'Europe/Helsinki',start:600,end:1110,label:'Helsinki'},XETRA:{mic:'XETR',currency:'EUR',zone:'Europe/Berlin',start:540,end:1050,label:'Xetra'}};
export function marketFor(symbol){return markets[eodhdSymbol(symbol).split('.').at(-1)];}
export const eodhdSupported=s=>typeof s==='string'&&/^[A-Z][A-Z0-9-]{0,12}\.(HE|XETRA)$/.test(eodhdSymbol(s))&&eodhdSymbol(s).length<=16;
export function marketDate(now,symbol){return new Intl.DateTimeFormat('en-CA',{timeZone:marketFor(symbol)?.zone??'Europe/Helsinki',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
// Conservative regular weekday window, not a live holiday/open-state feed.
export function marketSession(now,symbol){const m=marketFor(symbol);if(!m)return false;const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:m.zone,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));const mins=Number(p.hour)*60+Number(p.minute);return !['Sat','Sun'].includes(p.weekday)&&mins>=m.start&&mins<m.end;}
