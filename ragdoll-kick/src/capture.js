/**
 * STAGE 3 -- capture the rendered scene frame by frame in a headless browser.
 *
 * The time warp lives here: video time runs at wall-clock speed through the
 * run-up, drops to about a fifth of real time around the contact, then ramps
 * back for the flight. Because the simulation was recorded at 240 Hz and is
 * interpolated, the slow-motion section is genuinely resampled rather than
 * frame-duplicated.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';

/**
 * Use the Chromium that ships with this environment rather than the build this
 * Playwright release expects: the two revisions do not match and there is no
 * download available here.
 */
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const executablePath = fs.existsSync(CHROME) ? CHROME : undefined;

export const VIDEO_FPS = 60;

/** Simulation seconds per video second. */
function rate(t) {
  const ramp = (a, b, lo, hi) => {
    const u = Math.min(1, Math.max(0, (t - a) / (b - a)));
    const s = u * u * (3 - 2 * u);
    return lo + (hi - lo) * s;
  };
  if (t < 1.46) return 1.0;
  if (t < 1.60) return ramp(1.46, 1.60, 1.0, 0.20);   // into slow motion
  if (t < 1.94) return 0.20;                          // contact at 1.725
  if (t < 2.28) return ramp(1.94, 2.28, 0.20, 1.0);   // back up to speed
  return 1.0;
}

export function buildTimeline(endSim) {
  const times = [];
  let t = 0;
  while (t < endSim && times.length < 3000) {
    times.push(t);
    t += rate(t) / VIDEO_FPS;
  }
  return times;
}

function serve(root, port) {
  const types = {
    '.html': 'text/html', '.js': 'text/javascript',
    '.json': 'application/json', '.mjs': 'text/javascript',
  };
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(root, url === '/' ? '/render/scene.html' : url);
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404).end('not found'); return; }
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  return new Promise((ok) => server.listen(port, () => ok(server)));
}

export async function capture({ root, outDir, endSim, only = null }) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const port = 8731;
  const server = await serve(root, port);

  const browser = await chromium.launch({
    executablePath,
    args: [
      '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--disable-dev-shm-usage', '--no-sandbox',
    ],
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 806 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(`http://127.0.0.1:${port}/render/scene.html`, { waitUntil: 'load' });
  try {
    await page.waitForFunction('window.__ready === true', { timeout: 25000 });
  } catch (e) {
    await browser.close(); server.close();
    throw new Error('scene never became ready:\n' + errors.join('\n'));
  }

  const all = buildTimeline(endSim);
  const times = only ? only.map((t) => t) : all;
  for (let i = 0; i < times.length; i++) {
    await page.evaluate(([t, n]) => window.setSimTime(t, n), [times[i], i]);
    await page.screenshot({
      path: path.join(outDir, `f${String(i).padStart(5, '0')}.png`),
      type: 'png',
    });
    if (i % 40 === 0) process.stdout.write(`  frame ${i}/${times.length}\r`);
  }

  await browser.close();
  server.close();
  if (errors.length) console.warn('\npage errors:\n' + errors.slice(0, 5).join('\n'));
  return times.length;
}
