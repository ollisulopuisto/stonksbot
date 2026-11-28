import {eodhdSymbol,eodhdSupported,marketFor,marketSession,marketDate} from './eodhd-symbols.js';
import { rangeStart } from './chart-ranges.js';
import { mkdir, open, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { validateQuote } from './provider.js';
const DAY=86400000, MINUTE=60000, CATALOG_TTL=7*DAY;
const fail=()=>Error('EODHD unavailable, entitlement missing or invalid data; no raw response logged.');
const supported=eodhdSupported;
const positive=n=>Number.isFinite(n)&&n>0;
const fresh=(entry,now,ttl)=>entry && Number.isFinite(entry.at) && entry.at<=now && now-entry.at<ttl;
export { helsinkiDate } from './helsinki-session.js';

// On-demand only. One process/key/state root; all four endpoint types cost1call.
export class EodhdProvider {
 constructor({apiKey,stateDir,dailyLimit=20,minuteLimit=20,fetchImpl=fetch,now=Date.now}) {
  if(typeof apiKey!=='string'||!apiKey||typeof stateDir!=='string'||!stateDir||!Number.isInteger(dailyLimit)||dailyLimit<1||dailyLimit>20||!Number.isInteger(minuteLimit)||minuteLimit<1||minuteLimit>20) throw Error('Set EODHD key, private persistent state directory and limits1..20.');
  Object.assign(this,{apiKey,stateDir:resolve(stateDir),dailyLimit,minuteLimit,fetchImpl,now});this.queue=Promise.resolve();
 }
 lookup(symbol,options={}) {
  symbol=eodhdSymbol(symbol);
  if(!supported(symbol))return Promise.resolve(null);
  const result=this.queue.then(()=>this.locked(symbol,options));this.queue=result.catch(()=>{});return result;
 }
 async locked(symbol,options) {
  await mkdir(this.stateDir,{recursive:true,mode:0o700});
  const lockPath=join(this.stateDir,'provider.lock');let lock;
  try{lock=await open(lockPath,'wx',0o600);}catch(error){
   if(error.code!=='EEXIST')throw Error('EODHD state lock could not be created.');
   let age;try{age=Date.now()-(await stat(lockPath)).mtimeMs;}catch{throw Error('EODHD state lock changed; retry later.');}
   throw Error(age>5*MINUTE?'EODHD lock may be stale; stop all instances and inspect before removal. No lock removed.':'EODHD state busy; one process per key/state directory.');
  }
  try{return await this.load(symbol,options);}finally{await lock.close();await unlink(lockPath);}
 }
 async hasCachedSymbol(code){
  const seed=JSON.parse(await readFile(new URL('../data/xetra-seed.json',import.meta.url),'utf8'));
  if(seed.verified===false&&seed.entries.some(row=>row.symbol===code+'.XETRA'&&row.currency==='EUR'))return true;
  try{const state=JSON.parse(await readFile(join(this.stateDir,'state.json'),'utf8'));return ['XETRA','HE'].some(suffix=>fresh(state.metadata?.[suffix],this.now(),CATALOG_TTL)&&Object.hasOwn(state.metadata[suffix].items,code+'.'+suffix));}catch{return false;}
 }
 resolveBare(code){
  if(typeof code!=='string'||!/^[A-Z][A-Z0-9-]{0,12}$/.test(code))return Promise.resolve([]);
  const result=this.queue.then(async()=>{const matches=[];for(const suffix of ['XETRA','HE']){if(!supported(code+'.'+suffix))continue;const items=await this.locked(code+'.'+suffix,{catalogOnly:true});if(Object.hasOwn(items,code+'.'+suffix))matches.push(code+'.'+suffix);}return matches;});this.queue=result.catch(()=>{});return result;
 }
 async load(symbol,{range='30d',catalogOnly=false}={}) {
  const path=join(this.stateDir,'state.json');let state={provider:'eodhd',calls:[],blockedUntil:0,lastSeen:0,metadata:null,quotes:{},histories:{}};
  try{state=JSON.parse(await readFile(path,'utf8'));}catch(error){if(error.code!=='ENOENT')throw fail();}
  const now=this.now();
  if(state.provider!=='eodhd'||!Array.isArray(state.calls)||state.calls.some(t=>!Number.isFinite(t)||t>now)||!Number.isFinite(state.lastSeen)||state.lastSeen>now||!Number.isFinite(state.blockedUntil)||[state.quotes,state.histories].some(x=>!x||typeof x!=='object'||Array.isArray(x)))throw fail();
  state.calls=state.calls.filter(t=>now-t<DAY);state.lastSeen=now;
  const save=async()=>{await writeFile(path+'.tmp',JSON.stringify(state),{mode:0o600});await rename(path+'.tmp',path);};
  await save();
  const request=async(endpoint,params={})=>{
   if(now<state.blockedUntil||state.calls.length>=this.dailyLimit||state.calls.filter(t=>now-t<MINUTE).length>=this.minuteLimit)throw Error('EODHD local quota exhausted (max20calls/rolling24h and20requests/min); no request sent.');
   state.calls.push(now);await save();
   const url=new URL('https://eodhd.com/api/'+endpoint);url.search=new URLSearchParams({...params,api_token:this.apiKey,fmt:'json'});
   try{
    const response=await this.fetchImpl(url,{signal:AbortSignal.timeout(15000),redirect:'error'});
    if(response.status===429||response.status===402){state.blockedUntil=now+DAY;await save();throw fail();}
    if(!response.ok)throw fail();return await response.json();
   }catch{throw fail();}
  };
  const market=marketFor(symbol),suffix=symbol.split('.').at(-1),source=`EODHD ${market.label} delayed quote and raw daily closes`;
  const date=t=>marketDate(t,symbol);
  const inSession=marketSession(now,symbol);
  const metadata=state.metadata?.[suffix]??(suffix==='HE'&&state.metadata?.items?state.metadata:null);
  const existingQuote=Object.hasOwn(state.quotes,symbol)&&state.quotes[symbol];
  // Outside regular hours, retain existing data without spending the tiny budget.
  const retainClosed=!catalogOnly&&!inSession&&existingQuote&&metadata;
  // Seven-day persisted catalogs; failed refresh backs off one day. No timer.
  if(!retainClosed&&!fresh(metadata,now,CATALOG_TTL)){
   state.catalogAttempts??={};
   if(fresh(state.catalogAttempts[suffix],now,DAY))throw Error('EODHD catalog refresh backoff or quota exhausted; no request sent.');
   state.catalogAttempts[suffix]={at:now};await save();
   const exchanges=fresh(state.exchanges,now,CATALOG_TTL)?state.exchanges.items:await request('exchanges-list/');
   state.exchanges={at:now,items:exchanges};await save();
   const he=Array.isArray(exchanges)&&exchanges.find(x=>x.Code===suffix);
   if(!he||he.OperatingMIC!==market.mic||he.Currency!==market.currency)throw fail();
   const symbols=await request('exchange-symbol-list/'+suffix);
   if(!Array.isArray(symbols)||!symbols.length||symbols.length>100000)throw fail();
   const items={};for(const row of symbols){if(row.Exchange===suffix&&row.Currency===market.currency&&supported(row.Code+'.'+suffix)&&typeof row.Name==='string')items[row.Code+'.'+suffix]={name:row.Name.slice(0,120),exchange:market.mic,currency:market.currency};}
   state.metadata={...state.metadata,[suffix]:{at:now,items}};delete state.catalogAttempts[suffix];await save();
  }
  if(catalogOnly)return (state.metadata[suffix]??metadata).items;
  const item=Object.hasOwn((state.metadata[suffix]??metadata).items,symbol)&&(state.metadata[suffix]??metadata).items[symbol];
  if(!item)return null;
  if(item.exchange!==market.mic||item.currency!==market.currency||typeof item.name!=='string')throw fail();
  let quote;
  const cached=Object.hasOwn(state.quotes,symbol)&&state.quotes[symbol];
  // Hourly cache keeps the tiny free budget useful. Source timestamp never changes.
  if(cached&&(!inSession || (fresh(cached,now,60*MINUTE)&&now-Date.parse(cached.quote?.asOf)<65*MINUTE))){
   quote=validateQuote(cached.quote);
   if(!positive(quote.previousClose)||quote.symbol!==symbol||quote.currency!=='EUR'||quote.exchange!==market.mic||quote.fixture!==false||quote.priceKind!=='delayed-quote'||quote.source!==source)throw fail();
  }else{
   const body=await request('real-time/'+symbol);
   if(body?.code!==symbol||!positive(body.close)||!positive(body.previousClose)||!Number.isInteger(body.timestamp)||body.timestamp<=0||body.timestamp*1000>now+MINUTE)throw fail();
   quote=validateQuote({symbol,name:item.name,price:body.close,previousClose:body.previousClose,currency:'EUR',exchange:market.mic,asOf:new Date(body.timestamp*1000).toISOString(),source,fixture:false,priceKind:'delayed-quote',history:[]});
   state.quotes[symbol]={at:now,quote};await save();
  }
  try{
   const historyKey=symbol+':'+(range==='7d'?'30d':range);
   let daily=Object.hasOwn(state.histories,historyKey)&&state.histories[historyKey];
   // A new Helsinki trading date invalidates yesterday's cached history.
   if(!daily||(!retainClosed&&(!fresh(daily,now,DAY)||date(daily.at)!==date(now)))){
    const requestedFrom=rangeStart(range,now);
    const from=range==='7d'||range==='30d'?new Date(now-40*DAY).toISOString().slice(0,10):requestedFrom;
    const rows=await request('eod/'+symbol,{from,to:date(now),period:'d',order:'a'});
    if(!Array.isArray(rows)||rows.length<2||rows.length>1000)throw fail();
    let previous='';const history=[];const ratios=[];
    for(const row of rows){
     if(!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||!Number.isFinite(Date.parse(row.date))||new Date(row.date).toISOString().slice(0,10)!==row.date||row.date<=previous||row.date>date(now)||!positive(row.close)||!positive(row.adjusted_close))throw fail();
     previous=row.date;history.push({date:row.date,close:row.close});ratios.push(row.adjusted_close/row.close);
    }
    daily={at:now,from,history,corporateAction:ratios.slice(-8).some(r=>Math.abs(r/ratios.at(-1)-1)>0.001)};
    state.histories[historyKey]=daily;await save();
   }
   validateQuote({...quote,history:daily.history,historyKind:'daily-close',historySource:quote.source,historyAsOf:daily.history.at(-1).date+'T00:00:00Z'});
   const prior=daily.history.filter(p=>p.date<date(Date.parse(quote.asOf)));
   const mismatch=!prior.length||Math.abs(prior.at(-1).close/quote.previousClose-1)>0.001;
   return validateQuote({...quote,historyFrom:daily.from,history:daily.history,historyKind:'daily-close',historySource:quote.source,historyAsOf:daily.history.at(-1).date+'T00:00:00Z',moodUnavailable:daily.corporateAction||mismatch?'Corporate action or previous-close/history mismatch':undefined});
  }catch{
   return {...quote,history:[],historyNotice:'EODHD daily history unavailable or quota exhausted; no chart shown.',moodUnavailable:'EODHD same-feed daily history unavailable'};
  }
 }
}

export class HelsinkiRouter {
 constructor(usProvider,helsinkiProvider){Object.assign(this,{usProvider,helsinkiProvider});}
 lookup(symbol,options){return eodhdSupported(symbol)?this.helsinkiProvider.lookup(eodhdSymbol(symbol),options):this.usProvider.lookup(symbol,options);}
}
