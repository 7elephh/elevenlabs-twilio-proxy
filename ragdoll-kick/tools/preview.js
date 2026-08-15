/** Render a handful of key moments so the framing can be judged without a full build. */
import { capture } from '../src/capture.js';

const marks = process.argv.slice(2).map(Number);
const times = marks.length ? marks : [0.35, 1.30, 1.72, 2.60, 3.35];
await capture({ root: process.cwd(), outDir: 'preview', endSim: 4, only: times });
console.log('wrote preview/ for sim times', times.join(', '));
