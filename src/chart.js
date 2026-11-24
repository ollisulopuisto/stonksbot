import { deflateSync } from 'node:zlib';
import { drawText } from './font.js';

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
export function chartScale(points) {
  const values = points.map(p => p.close);
  const low = Math.min(...values), high = Math.max(...values);
  const padding = Math.max(high * 0.01, 0.5);
  const minimum = low === high ? Math.max(0, low - padding) : low;
  const maximum = low === high ? high + padding : high;
  return { low, high, minimum, maximum,
    ticks: Array.from({ length: 5 }, (_, i) => maximum - (maximum - minimum) * i / 4) };
}
// Small local PNG renderer. No chart host or user message leaves this process.
export function chartLabels(points, {symbol='FIXTURE',currency='USD',fixture=true}={}) {
  const values=points.map(p=>p.close), { low, high, ticks } = chartScale(points);
  return [`${symbol} - ${fixture?'DEMO FIXTURE':'PROVIDER DATA'}`,`CLOSE / ${currency}`,
    ...ticks.map(value=>`${value.toFixed(2)} ${currency}`),
    ...[points[0],points[Math.floor((points.length-1)/2)],points.at(-1)].map(p=>p.date.slice(0,10)),
    'DATE',`LAST CLOSE ${values.at(-1).toFixed(2)} ${currency}`,`HIGH ${high.toFixed(2)} ${currency}`,`LOW ${low.toFixed(2)} ${currency}`];
}
export function chartPng(points, width = 640, height = 320, metadata = {}) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 100 || width > 1600 || height < 80 || height > 1000) throw new Error('Invalid chart dimensions');
  if (points.length < 2 || points.length > 1000 || points.some(p => !Number.isFinite(p.close) || p.close < 0)) throw new Error('Invalid history');
  const data = Buffer.alloc(height * (1 + width * 3), 255);
  for (let y = 0; y < height; y++) data[y * (1 + width * 3)] = 0;
  const pixel = (x, y, rgb) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * (1 + width * 3) + 1 + x * 3;
    for (let c = 0; c < 3; c++) data[i + c] = rgb[c];
  };
  const line = (x1, y1, x2, y2, rgb) => {
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
    for (let t = 0; t <= steps; t++) {
      const x = x1 + (x2 - x1) * t / steps, y = y1 + (y2 - y1) * t / steps;
      pixel(x, y, rgb); pixel(x, y + 1, rgb);
    }
  };
  const values = points.map(p => p.close), { low, high, minimum, maximum } = chartScale(points);
  const labels=chartLabels(points,metadata);
  const left=105,right=width-25,top=68,bottom=height-83;
  drawText(pixel,labels[0],20,14,2);
  drawText(pixel,labels[1],20,43);
  const valueSpan=maximum-minimum;
  for(let i=0;i<5;i++){
    const y=top+(bottom-top)*i/4;
    line(left,y,right,y,[225,231,237]);
    drawText(pixel,labels[2+i],8,y-3);
  }
  const coords=points.map((p,i)=>[left+i*(right-left)/(points.length-1),bottom-(p.close-minimum)/valueSpan*(bottom-top)]);
  for(let i=1;i<coords.length;i++)line(...coords[i-1],...coords[i],[0,111,145]);
  for(const index of [0,Math.floor((points.length-1)/2),points.length-1]){
    const x=coords[index][0];line(x,bottom,x,bottom+5,[90,100,110]);
    drawText(pixel,points[index].date.slice(0,10),Math.min(right-59,Math.max(left-28,x-29)),bottom+12);
  }
  drawText(pixel,'DATE',Math.round((left+right)/2)-12,bottom+28);
  const markerIndices=[values.length-1,values.indexOf(high),values.indexOf(low)];
  markerIndices.forEach(i=>{const [x,y]=coords[i];for(let dx=-3;dx<=3;dx++)for(let dy=-3;dy<=3;dy++)pixel(x+dx,y+dy,[0,111,145]);});
  drawText(pixel,labels.at(-3),20,height-27);
  drawText(pixel,labels.at(-2),235,height-27);
  drawText(pixel,labels.at(-1),445,height-27);
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('tEXt', Buffer.from('Description\0'+labels.join(' | '))), chunk('IDAT', deflateSync(data)), chunk('IEND', Buffer.alloc(0))]);
}
