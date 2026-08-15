/** Quick look at the raw kick: does the ragdoll stand, run, plant and swing? */
import { scout, DT, SCENE, probeImpact, flight, ballPlacementFor } from './kick-sim.js';
import { segmentSpecs, DIM } from './skeleton.js';
import { V } from './physics-utils.js';

const aim = { yaw: 0 };
console.time('scout');
const s = scout(aim);
console.timeEnd('scout');

const { states, order } = s;
const idx = (n) => order.indexOf(n);
const at = (t, n) => states[Math.round(t / DT)][idx(n)];

console.log('\nbones:', order.join(' '));
console.log('\n-- pelvis / feet through the kick --');
for (const t of [0, 0.4, 0.8, 1.1, 1.28, 1.48, 1.6, 1.7, 1.85, 2.1]) {
  const p = at(t, 'pelvis'), fl = at(t, 'footL'), fr = at(t, 'footR');
  console.log(
    `t=${t.toFixed(2)} pelvis=(${p[0].toFixed(2)},${p[1].toFixed(2)},${p[2].toFixed(2)}) ` +
    `footL=(${fl[0].toFixed(2)},${fl[1].toFixed(2)},${fl[2].toFixed(2)}) ` +
    `footR=(${fr[0].toFixed(2)},${fr[1].toFixed(2)},${fr[2].toFixed(2)}) ` +
    `|vL|=${Math.hypot(fl[7], fl[8], fl[9]).toFixed(1)}`
  );
}

console.log('\n-- strike instant found by the scout --');
if (!s.best) { console.log('NONE'); process.exit(1); }
console.log(`  t=${s.best.t.toFixed(3)}  foot speed=${s.best.speed.toFixed(2)} m/s`);
console.log(`  boot patch=(${s.best.patch.x.toFixed(3)},${s.best.patch.y.toFixed(3)},${s.best.patch.z.toFixed(3)})`);
console.log(`  foot vel=(${s.best.vel.x.toFixed(2)},${s.best.vel.y.toFixed(2)},${s.best.vel.z.toFixed(2)})`);

console.log('\n-- trial impact (side=-0.55 rad) --');
const r = probeImpact(s, { side: -0.55 }, aim);
if (r.failed) { console.log('  FAILED:', r.failed, 'minDist=', r.minDist.toFixed(4)); process.exit(1); }
console.log(`  strike height vs ball centre: ${(r.place.strikeAboveCentre * 1000).toFixed(0)} mm  -> contact normal ${r.place.normalElevationDeg.toFixed(1)} deg up`);
console.log(`  ball placed at (${r.place.pos.x.toFixed(3)},${r.place.pos.y.toFixed(3)},${r.place.pos.z.toFixed(3)})`);
console.log(`  contact point   (${r.contact.point.x.toFixed(3)},${r.contact.point.y.toFixed(3)},${r.contact.point.z.toFixed(3)})`);
console.log(`  lever arm r     (${r.contact.r.x.toFixed(3)},${r.contact.r.y.toFixed(3)},${r.contact.r.z.toFixed(3)})`);
console.log(`  foot speed at contact ${r.contact.footSpeed.toFixed(2)} m/s`);
console.log(`  ball v = (${r.v.x.toFixed(2)},${r.v.y.toFixed(2)},${r.v.z.toFixed(2)})  |v|=${r.v.length().toFixed(2)}`);
console.log(`  spin (solver friction) |w|=${r.wSolver.length().toFixed(1)}  (${r.wSolver.x.toFixed(1)},${r.wSolver.y.toFixed(1)},${r.wSolver.z.toFixed(1)})`);
console.log(`  spin (r x J / I)       |w|=${r.wGeometric.length().toFixed(1)}  (${r.wGeometric.x.toFixed(1)},${r.wGeometric.y.toFixed(1)},${r.wGeometric.z.toFixed(1)})`);

for (const [label, w] of [['solver spin', r.wSolver], ['geometric spin', r.wGeometric], ['no spin', V(0, 0, 0)]]) {
  const f = flight(r.pos, r.v, w);
  console.log(`  ${label.padEnd(15)} crosses x=${SCENE.goalX}: ` +
    (f.crossed ? `y=${f.crossed.y.toFixed(2)} z=${f.crossed.z.toFixed(2)} at t+${f.crossed.t.toFixed(2)}s` : 'never'));
}
