import {dateAxis} from './chart-dates.js';
import { deflateSync } from 'node:zlib';
import { smoothText } from './chart-font.js';

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(name, data) {
  const type = Buffer.from(name);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([length, type, data, crc]);
}
export const priceLabel=value=>value!==0&&Math.abs(value)<.01?value.toPrecision(3).replace(/0+$/,'').replace(/\.$/,''):Math.abs(value)>=1e9?value.toExponential(3):value.toFixed(2);
export function chartScale(points) {
  const values = points.map(p => p.close);
  const low = Math.min(...values), high = Math.max(...values);
  // Prices set the scale, not rounded ticks. Only a small lower gutter.
  const spread=high-low;
  const padding=spread===0?Math.max(Math.abs(high)*.01,.5):spread*.05;
  const minimum=low-padding,maximum=spread===0?high+padding:high;
  const raw=(maximum-minimum)/4;
  const power=10**Math.floor(Math.log10(raw)),fraction=raw/power;
  const step=(fraction>=5?5:fraction>=2?2:1)*power;
  const first=Math.ceil(minimum/step),last=Math.floor(maximum/step);
  const ticks=Array.from({length:last-first+1},(_,i)=>Number(((last-i)*step).toPrecision(14)));
  const decimals=Math.max(0,-Math.floor(Math.log10(step)));
  const formatTick=value=>Math.abs(value)>=1e9?value.toExponential(Math.max(0,Math.ceil(Math.log10(Math.max(Math.abs(minimum),Math.abs(maximum))/step)))):decimals>6?value.toExponential(Math.max(0,Math.ceil(Math.log10(Math.max(Math.abs(minimum),Math.abs(maximum))/step)))):value.toFixed(decimals);
  const formatValue=value=>{const digits=Math.max(2,decimals,value!==0&&Math.abs(value)<1?-Math.floor(Math.log10(Math.abs(value)))+2:2);return digits>8||Math.abs(value)>=1e9?value.toExponential(Math.max(2,Math.ceil(Math.log10(Math.max(Math.abs(minimum),Math.abs(maximum))/step)))):value.toFixed(digits);};
  return {low,high,minimum,maximum,ticks,formatTick,formatValue};
}
// Small local PNG renderer. No chart host or user message leaves this process.
export function chartLabels(points, {symbol='FIXTURE',currency='USD',fixture=true,historyKind=null,priceKind=null,range=null}={}) {
  const values=points.map(p=>p.close), { low, high, ticks,formatTick,formatValue } = chartScale(points);
  return [`${symbol} - ${historyKind === 'daily-close' ? (priceKind === 'delayed-quote' ? 'EODHD DAILY' : 'ALPHA VANTAGE DAILY') : fixture?'DEMO FIXTURE':'PROVIDER DATA'}`,`CLOSE / ${currency}${range?' / '+range:''}`,
    ...ticks.map(value=>`${formatTick(value)} ${currency}`),
    ...[points[0],points[Math.floor((points.length-1)/2)],points.at(-1)].map(p=>p.date.slice(0,10)),
    'DATE',`LAST CLOSE ${formatValue(values.at(-1))} ${currency}`,`HIGH ${formatValue(high)} ${currency}`,`LOW ${formatValue(low)} ${currency}`];
}
export function chartPng(points, width = 640, height = 320, metadata = {}) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 100 || width > 1600 || height < 80 || height > 1000) throw new Error('Invalid chart dimensions');
  if (points.length < 2 || points.length > 1000 || points.some(p => !Number.isFinite(p.close) || p.close < 0)) throw new Error('Invalid history');
  // Fixed logical artboard, 3x supersampling. Resize only at final output.
  const W=1920,H=960,bg=[12,19,32],accent=[78,215,249];
  const rgb=Buffer.alloc(W*H*3);for(let i=0;i<rgb.length;i+=3){rgb[i]=bg[0];rgb[i+1]=bg[1];rgb[i+2]=bg[2];}
  const pixel=(x,y,color,alpha=1)=>{x=Math.round(x);y=Math.round(y);if(x<0||x>=W||y<0||y>=H)return;const i=(y*W+x)*3;for(let c=0;c<3;c++)rgb[i+c]=Math.round(rgb[i+c]*(1-alpha)+color[c]*alpha);};
  const dot=(x,y,r,color)=>{for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)if(dx*dx+dy*dy<=r*r)pixel(x+dx,y+dy,color);};
  const line=(x1,y1,x2,y2,color,r=2)=>{const steps=Math.ceil(Math.max(Math.abs(x2-x1),Math.abs(y2-y1),1));for(let t=0;t<=steps;t++)dot(x1+(x2-x1)*t/steps,y1+(y2-y1)*t/steps,r,color);};
  const text=(x,y,t,size=12,color=[170,188,208],max=592)=>smoothText(pixel,t,x,y,size,color,max);
  const values=points.map(p=>p.close),{low,high,minimum,maximum,ticks,formatTick,formatValue}=chartScale(points),labels=chartLabels(points,metadata);
  const left=26*3,right=540*3,top=106*3,bottom=250*3,span=maximum-minimum;
  text(24,12,metadata.symbol??'FIXTURE',23,[240,247,255],290);
  text(330,20,`HIGH ${formatValue(high)} / LOW ${formatValue(low)}`,12,[170,188,208],286);
  const end=text(24,43,formatValue(values.at(-1)),34,[240,247,255],320);
  text(end+12,67,`${metadata.currency??'USD'} / LAST CLOSE`,11,[170,188,208],280);
  text(26,296,`${metadata.historyKind==='daily-close'?(metadata.priceKind==='delayed-quote'?'EODHD':'ALPHA VANTAGE'):metadata.fixture===false?'PROVIDER DATA':'DEMO FIXTURE'} / DAILY CLOSE${metadata.range?' / '+metadata.range:''} / ${points[0].date} - ${points.at(-1).date}`,11);
  const dates=dateAxis(points,metadata.range??'30d');
  const coords=points.map((p,i)=>[left+dates.fractions[i]*(right-left),bottom-(p.close-minimum)/span*(bottom-top)]);
  for(const tick of dates.ticks){const x=left+tick.fraction*(right-left);line(x,top,x,bottom,[48,65,84],0);text(Math.max(16,x/3-10),263,tick.label,11,[170,188,208],50);if(tick.year)text(Math.max(16,x/3-10),279,tick.year,11);}
  for(const value of ticks){const y=bottom-(value-minimum)/span*(bottom-top);line(left,y,562*3,y,[65,84,105],0);if(Math.abs(y-coords.at(-1)[1])>42)text(568,y/3-7,formatTick(value),11,[145,168,192],67);}
  for(let i=1;i<coords.length;i++)line(...coords[i-1],...coords[i],accent,3);
  for(const index of [values.length-1]){const[x,y]=coords[index];dot(x,y,12,accent);dot(x,y,6,bg);}
  const [lastX,lastY]=coords.at(-1);line(lastX+15,lastY,562*3,lastY,accent,0);text(568,lastY/3-7,formatValue(values.at(-1)),11,accent,67);


  const data=Buffer.alloc(height*(1+width*3));
  // Box integration preserves edge coverage for both standard and custom sizes.
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const x0=Math.floor(x*W/width),x1=Math.max(x0+1,Math.floor((x+1)*W/width));
    const y0=Math.floor(y*H/height),y1=Math.max(y0+1,Math.floor((y+1)*H/height));
    const sums=[0,0,0];for(let yy=y0;yy<y1;yy++)for(let xx=x0;xx<x1;xx++){const i=(yy*W+xx)*3;for(let c=0;c<3;c++)sums[c]+=rgb[i+c];}
    const dest=y*(1+width*3)+1+x*3;for(let c=0;c<3;c++)data[dest+c]=Math.round(sums[c]/((x1-x0)*(y1-y0)));
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('tEXt', Buffer.from('Description\0'+labels.join(' | '))), chunk('IDAT', deflateSync(data)), chunk('IEND', Buffer.alloc(0))]);
}
