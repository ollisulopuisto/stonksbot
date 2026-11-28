import test from 'node:test';import assert from 'node:assert/strict';import{inflateSync}from'node:zlib';import{chartPng}from'../src/chart.js';
function pixels(png){let p=8,idat=[];while(p<png.length){const n=png.readUInt32BE(p),type=png.toString('ascii',p+4,p+8);if(type==='IDAT')idat.push(png.subarray(p+8,p+8+n));p+=n+12;}return inflateSync(Buffer.concat(idat));}
const points=[{date:'2026-10-19',close:14.74},{date:'2026-11-01',close:18.02},{date:'2026-11-27',close:15.80}];
test('midnight chart uses dark background, cyan antialiased line without area fill',()=>{const png=chartPng(points,640,320,{symbol:'REMEDY.HE',currency:'EUR',fixture:true,range:'30d'});const p=pixels(png);assert.deepEqual([...p.subarray(1,4)],[12,19,32]);const colors=new Set();for(let i=1;i<p.length;i+=3)colors.add(p.subarray(i,i+3).toString('hex'));assert.ok(colors.size>100,'supersampled text and gradient');assert.ok(png.includes(Buffer.from('30d')));});
test('flat series, long labels, two points and custom dimensions are bounded',()=>{for(const [w,h]of [[100,80],[640,320],[1600,1000]]){const p=chartPng(points.slice(0,2).map(x=>({...x,close:0})),w,h,{symbol:'LONG.NAME.WITH.MANY.LETTERS',currency:'EUR',range:'1y'});assert.equal(p.readUInt32BE(16),w);assert.equal(p.readUInt32BE(20),h);}});
test('period-extrema axis keeps ceiling tight, a small lower gutter and readable helper ticks',async()=>{
 const{chartScale}=await import('../src/chart.js');for(const values of [[560.84,641.69],[0,0],[100,100],[15,16],[0,.000003],[1e12,1.1e12]]){
  const s=chartScale(values.map(close=>({close})));assert.ok(s.minimum<Math.min(...values));if(Math.max(...values)===Math.min(...values))assert.ok(s.maximum>Math.max(...values));else{assert.equal(s.maximum,Math.max(...values));assert.ok(Math.abs((Math.min(...values)-s.minimum)/(Math.max(...values)-Math.min(...values))-.05)<1e-8);}assert.equal(s.low,Math.min(...values));assert.equal(s.high,Math.max(...values));
  const step=Number((s.ticks[0]-s.ticks[1]).toPrecision(10)),unit=step/10**Math.floor(Math.log10(step));assert.ok([1,2,5,10].some(n=>Math.abs(n-unit)<1e-7));assert.ok(s.ticks.length>=3&&s.ticks.length<=8);assert.equal(new Set(s.ticks.map(s.formatTick)).size,s.ticks.length);
 }
});
test('value labels preserve tick precision for cents and tiny price spans',async()=>{
 const{chartLabels}=await import('../src/chart.js');for(const [lo,hi,expected]of [[.01,.015,'HIGH 0.0150 USD'],[100,100.0005,'HIGH 100.0005 USD']]){const p=[{date:'2026-11-20',close:lo},{date:'2026-11-21',close:hi}];assert.ok(chartLabels(p).includes(expected));}
});
