/**
 * Sweep the strike-phase body height and report what the swing actually does:
 * how low the boot goes, whether it fouls the turf, and how fast it is moving
 * forward when it passes through ball height.
 */
import { execFileSync } from 'node:child_process';

console.log('hipY   patchMinY  vxBest  patchY@best  turfHit');
for (let h = 0.93; h <= 1.07; h += 0.02) {
  const out = execFileSync(process.execPath, ['tools/one-height.js'], {
    env: { ...process.env, STRIKE_HIP_Y: h.toFixed(3) },
    encoding: 'utf8',
  });
  console.log(h.toFixed(3) + '  ' + out.trim());
}
