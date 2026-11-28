// Nasdaq Helsinki regular equity hours, local time. No holiday/half-day feed:
// this is a conservative weekday-hours window, not proof the venue is open.
// https://www.nasdaq.com/european-market-activity/trading-hours
export const helsinkiDate=t=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Helsinki',year:'numeric',month:'2-digit',day:'2-digit'}).format(t);
export function helsinkiRegularSession(now) {
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Helsinki',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));
 const minutes=Number(p.hour)*60+Number(p.minute);
 return !['Sat','Sun'].includes(p.weekday)&&minutes>=600&&minutes<1110;
}
