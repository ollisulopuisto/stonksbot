import { writeFile, mkdir } from 'node:fs/promises';
import { FixtureProvider } from './provider.js';
import { buildCard } from './bot.js';
import { chartPng } from './chart.js';
await mkdir('demo-output', { recursive: true });
const quote = await new FixtureProvider().lookup('AAPL');
await writeFile('demo-output/AAPL.png', chartPng(quote.history,640,320,quote));
await writeFile('demo-output/card.json', JSON.stringify(buildCard(quote), null, 2));
console.log('Fixture-only card and local PNG: demo-output/. No network calls.');
