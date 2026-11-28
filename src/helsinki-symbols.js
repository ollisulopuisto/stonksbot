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
 lookup(symbol){const next=this.queue.then(()=>this.lookupLocked(symbol));this.queue=next.catch(()=>{});return next;}
 async lookupLocked(symbol){
  if(symbol.endsWith('.HE'))return this.helsinkiProvider.lookup(symbol);
  if(symbol.endsWith('.US'))return this.usProvider?.lookup(symbol.slice(0,-3))??null;
  const mapping=this.entries.get(symbol);
  if(!mapping){
   if(!this.usProvider)return null;
   let misses={};const now=this.now();
   if(this.statePath){try{misses=JSON.parse(await readFile(this.statePath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw Error('Invalid bare-symbol miss cache.');}}
   if(!misses||typeof misses!=='object'||Array.isArray(misses)||Object.values(misses).some(t=>!Number.isFinite(t)||t>now))throw Error('Invalid bare-symbol miss cache.');
   if(Object.hasOwn(misses,symbol)&&now-misses[symbol]<86400000)return null;
   let result;try{result=await this.usProvider.lookup(symbol);}catch{result=null;}
   if(!result&&this.statePath){
    misses=Object.fromEntries(Object.entries(misses).filter(([,t])=>now-t<86400000));misses[symbol]=now;
    if(Object.keys(misses).length>500)delete misses[Object.keys(misses)[0]];
    await mkdir(dirname(this.statePath),{recursive:true,mode:0o700});await writeFile(this.statePath+'.tmp',JSON.stringify(misses),{mode:0o600});await rename(this.statePath+'.tmp',this.statePath);
   }
   return result;
  }
  if(mapping.ambiguous)return {resolutionNotice:`${symbol} is ambiguous. Use $${symbol}.HE for Helsinki or $${symbol}.US for US.`};
  const quote=mapping.route.endsWith('.HE')?await this.helsinkiProvider.lookup(mapping.route):await this.usProvider?.lookup(mapping.route.slice(0,-3));
  return quote?{...quote,name:mapping.name}:null;
 }
}
