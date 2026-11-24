import { deflateSync } from 'node:zlib';

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
// Small local PNG renderer. No chart host or user message leaves this process.
export function chartPng(points, width = 640, height = 240) {
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
  const values = points.map(p => p.close), low = Math.min(...values), high = Math.max(...values);
  const span = high - low || Math.max(high * 0.02, 1);
  for (let y = 25; y <= height - 25; y += (height - 50) / 4) line(25, y, width - 25, y, [225, 231, 237]);
  const coords = points.map((p, i) => [25 + i * (width - 50) / (points.length - 1), height - 25 - (p.close - low + span * 0.1) / (span * 1.2) * (height - 50)]);
  for (let i = 1; i < coords.length; i++) line(...coords[i - 1], ...coords[i], [0, 111, 145]);
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(data)), chunk('IEND', Buffer.alloc(0))]);
}
