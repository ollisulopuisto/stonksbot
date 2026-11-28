import {gunzipSync} from 'node:zlib';
import {readFileSync} from 'node:fs';
// Pre-rasterized DejaVu Sans. See data/font-LICENSE.txt; no runtime font engine.
const atlas=JSON.parse(gunzipSync(readFileSync(new URL('../data/chart-font.json.gz',import.meta.url))).toString('utf8'));
for(const chars of Object.values(atlas))for(const g of Object.values(chars))g[4]=Buffer.from(g[4],'base64');
export function smoothText(pixel,text,x,y,size=12,color=[170,188,208],maxWidth=600){
 const chars=atlas[size];let cursor=x*3;const limit=(x+maxWidth)*3;
 for(const char of String(text).normalize('NFKD').replace(/[\u0300-\u036f]/g,'')){
  const g=chars[char]??chars['?'];if(cursor+g[3]>limit)break;
  const[w,h,top,advance,alpha]=g;
  for(let dy=0;dy<h;dy++)for(let dx=0;dx<w;dx++)if(alpha[dy*w+dx])pixel(Math.round(cursor+dx),Math.round(y*3+top+dy),color,alpha[dy*w+dx]/255);
  cursor+=advance;
 }
 return cursor/3;
}
