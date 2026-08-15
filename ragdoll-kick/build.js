/**
 * The whole pipeline: simulate -> capture -> encode.
 *
 *   node build.js
 *
 * Produces out/kick.json (the recorded simulation) and out/ragdoll-freekick.mp4.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import { record } from './src/record.js';
import { capture, VIDEO_FPS, buildTimeline } from './src/capture.js';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'out');
const FRAMES = path.join(ROOT, 'frames');
const END_SIM = 3.55;

const say = (k, v) => console.log('  ' + String(k).padEnd(16), v);

console.log('\n[1/3] simulating');
const data = record();
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'kick.json'), JSON.stringify(data));

say('recorded', `${data.frames.length} states @ ${data.fps} Hz`);
say('contact', `t=${data.contactTime.toFixed(3)} s, ${(data.contact.belowCentre * 1000).toFixed(0)} mm under the ball's centre`);
say('launch', `${data.launch.speed.toFixed(1)} m/s at ${data.launch.angleDeg.toFixed(1)} deg, ${data.launch.spin.toFixed(0)} rad/s spin`);
say('over the wall', `${data.wallY.toFixed(2)} m at x=${data.scene.wallX}`);
say('goal line', `y=${data.cross.y.toFixed(2)} z=${data.cross.z.toFixed(2)} -> ${data.goal ? 'GOAL' : 'MISS'}`);
const worst = data.audit.reduce((a, b) => (b.maxSeparation > a.maxSeparation ? b : a));
say('joint audit', `worst separation ${(worst.maxSeparation * 1000).toFixed(2)} mm (${worst.name})`);

console.log('\n[2/3] capturing frames');
const n = await capture({ root: ROOT, outDir: FRAMES, endSim: END_SIM });
const times = buildTimeline(END_SIM);
say('frames', `${n} at ${VIDEO_FPS} fps -> ${(n / VIDEO_FPS).toFixed(2)} s of video`);
say('slow motion', `sim ${times.find((t) => t > 1.5).toFixed(2)}-1.94 s played at 0.20x`);

console.log('\n[3/3] encoding');
const mp4 = path.join(OUT, 'ragdoll-freekick.mp4');
execFileSync(ffmpegPath, [
  '-y', '-framerate', String(VIDEO_FPS),
  '-i', path.join(FRAMES, 'f%05d.png'),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  mp4,
], { stdio: ['ignore', 'ignore', 'pipe'] });

const bytes = fs.statSync(mp4).size;
say('written', `${mp4} (${(bytes / 1e6).toFixed(2)} MB)`);
console.log('');
