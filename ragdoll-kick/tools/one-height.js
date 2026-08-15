import { scout, DT, STRIKE } from '../src/kick-sim.js';
import { BOOT_PATCH } from '../src/skeleton.js';
import { V } from '../src/physics-utils.js';
import * as CANNON from 'cannon-es';

STRIKE.bandLo = 0.010; STRIKE.bandHi = 0.090;
const s = scout({ yaw: 0 });
const i0 = s.order.indexOf('footL');
let minPatch = 9, turfHit = 0, prevVx = 0;
const q = new CANNON.Quaternion();
for (let i = Math.round(1.55 / DT); i < Math.round(2.05 / DT); i++) {
  const st = s.states[i][i0];
  q.set(st[3], st[4], st[5], st[6]);
  const off = q.vmult(V(BOOT_PATCH.x, BOOT_PATCH.y, BOOT_PATCH.z));
  minPatch = Math.min(minPatch, st[1] + off.y);
  if (prevVx > 4 && st[7] < prevVx * 0.6) turfHit++;
  prevVx = st[7];
}
const b = s.best;
process.stdout.write(
  `${minPatch.toFixed(3)}     ${b ? b.forward.toFixed(2) : 'n/a'}      ` +
  `${b ? b.patch.y.toFixed(3) : 'n/a'}       ${turfHit}`
);
