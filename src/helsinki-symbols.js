import {eodhdSupported,eodhdSymbol} from './eodhd-symbols.js';
import { dirname } from 'node:path';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
const bare=s=>typeof s==='string'&&/^[A-Z][A-Z0-9-]{0,12}$/.test(s);
export async function loadHelsinkiSymbols(overridePath) {
 const bundled=JSON.parse(await readFile(new URL('../data/helsinki-symbols.json',import.meta.url),'utf8'));
 const entries=new Map(bundled.entries.map(row=>[row.symbol,{...row}]));
 if(overridePath){
  const overrides=JSON.parse(await readFile(overridePath,'utf8'));
  if(!overrides||Array.isArray(overrides)||typeof overrides!=='object')throw Error('Helsinki override file must be a symbol-keyed JSON object.');
  for(const [symbol,value]of Object.entries(overrides)){
   if(!bare(symbol))throw Error('Invalid override symbol.');
   if(value===null){entries.delete(symbol);continue;}
   if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.name!=='string'||!value.name.trim()||typeof value.route!=='string'||!(/^[A-Z][A-Z0-9-]{0,12}\.HE$/.test(value.route)||/^[A-Z][A-Z0-9]{0,9}(?:[.-][AB])?\.US$/.test(value.route)))throw Error('Override needs a full name and explicit .HE or .US route.');
   entries.set(symbol,{symbol,name:value.name,route:value.route,ambiguous:false});
  }
 }
 return entries;
}
export class StaticHelsinkiRouter {
 constructor(usProvider,helsinkiProvider,entries,statePath,now=Date.now){Object.assign(this,{usProvider,helsinkiProvider,entries,statePath,now});this.queue=Promise.resolve();}
 lookup(symbol,options){const next=this.queue.then(()=>this.lookupLocked(symbol,options));this.queue=next.catch(()=>{});return next;}
 async lookupLocked(symbol,options){
  if(eodhdSupported(symbol))return this.helsinkiProvider.lookup(eodhdSymbol(symbol),options);
  if(symbol.endsWith('.US'))return this.usProvider?.lookup(symbol.slice(0,-3),options)??null;
  const mapping=this.entries.get(symbol);
  if(!mapping){
   if(!this.usProvider)return null;
   let misses={};const now=this.now();
   if(this.statePath){try{misses=JSON.parse(await readFile(this.statePath,'utf8'));}catch{misses={};}}
   // This cache is only a convenience, never provider quota state. Discard
   // corrupt/old-schema/future entries rather than making quotes unavailable.
   if(!misses||typeof misses!=='object'||Array.isArray(misses))misses={};
   misses=Object.fromEntries(Object.entries(misses).filter(([,v])=>v&&Number.isFinite(v.at)&&v.at<=now&&[900000,86400000].includes(v.ttl)&&now-v.at<v.ttl));
   if(Object.hasOwn(misses,symbol))return null;
   let result,ttl=86400000;try{result=await this.usProvider.lookup(symbol,options);}catch{result=null;ttl=900000;}
   if(this.statePath){
    if(!result)misses[symbol]={at:now,ttl};
    if(Object.keys(misses).length>500)delete misses[Object.keys(misses)[0]];
    await mkdir(dirname(this.statePath),{recursive:true,mode:0o700});await writeFile(this.statePath+'.tmp',JSON.stringify(misses),{mode:0o600});await rename(this.statePath+'.tmp',this.statePath);
   }
   return result;
  }
  if(mapping.ambiguous)return {resolutionNotice:`${symbol} is ambiguous. Use $${symbol}.HE for Helsinki or $${symbol}.US for US.`};
  const quote=mapping.route.endsWith('.HE')?await this.helsinkiProvider.lookup(mapping.route,options):await this.usProvider?.lookup(mapping.route.slice(0,-3),options);
  return quote?{...quote,name:mapping.name}:null;
 }
}
