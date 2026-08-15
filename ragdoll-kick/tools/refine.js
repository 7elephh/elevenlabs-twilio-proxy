/**
 * Refine the shot against the *production* code path.
 *
 * The fast rewind probe in solve-aim.js restarts the solver mid-swing, which
 * costs it a little accuracy. This runs the real continuous simulation for each
 * candidate and integrates the flight from the measured launch state, then asks
 * where a goal would have to stand for the ball to arrive in the top corner --
 * rather than forcing a distance the kick cannot reach.
 */
import { record } from '../src/record.js';
import { flight, SCENE } from '../src/kick-sim.js';
import { V } from '../src/physics-utils.js';

const yaws = [0.06, 0.09, 0.12, 0.15, 0.18, 0.21, 0.24];
const sides = [-0.22, -0.18, -0.14, -0.10, -0.06];
const bands = [[0.056, 0.070], [0.064, 0.080]];

const rows = [];
for (const band of bands) {
  for (const yaw of yaws) {
    for (const side of sides) {
      let d;
      try { d = record({ band, yaw, side }, { endT: 2.15 }); } catch { continue; }
      if (!d.launch) continue;

      const v = V(...d.launch.v);
      const w = V(...d.launch.w);
      const pos = V(...d.launchPos);
      const f = flight(pos, v, w, { until: 60, maxT: 3.5 });

      // straight-line reference tells us how much the air actually bent it
      const straight = flight(pos, v, V(0, 0, 0), { until: 60, maxT: 3.5 });

      // find where the descending ball passes through top-corner height
      let goalAt = null;
      for (let i = 1; i < f.path.length; i++) {
        const a = f.path[i - 1], b = f.path[i];
        if (a.y > 1.95 && b.y <= 1.95 && b.x > 8) { goalAt = b; break; }
      }
      if (!goalAt) continue;

      // how high was it as it passed a wall 9.15 m from the ball?
      let wallY = null;
      for (let i = 1; i < f.path.length; i++) {
        if (f.path[i - 1].x < 9.15 && f.path[i].x >= 9.15) { wallY = f.path[i].y; break; }
      }

      // lateral bend, measured at that same distance
      let curl = 0;
      for (let i = 1; i < straight.path.length; i++) {
        if (straight.path[i - 1].x < goalAt.x && straight.path[i].x >= goalAt.x) {
          curl = Math.abs(goalAt.z - straight.path[i].z); break;
        }
      }

      rows.push({
        band, yaw, side,
        speed: d.launch.speed, ang: d.launch.angleDeg, spin: d.launch.spin,
        boot: d.contact.footSpeed,
        gx: goalAt.x, gz: goalAt.z, wallY, curl,
      });
    }
  }
}

// A good shot: a sensible free-kick distance, over the wall, finishing wide in
// the corner, and visibly bent.
function score(r) {
  if (r.wallY === null || r.wallY < 2.15) return -1e6;
  if (r.gx < 14 || r.gx > 30) return -1e5 - Math.abs(r.gx - 20);
  const az = Math.abs(r.gz);
  if (az > SCENE.goalHalfWidth - 0.25) return -1e4 - az;
  return Math.min(r.curl, 4) * 22 + az * 6 + r.speed * 0.8 - Math.abs(r.gx - 21) * 1.2;
}

rows.sort((a, b) => score(b) - score(a));
console.log(`${rows.length} candidates\n`);
console.log('score   band           yaw    side   boot  speed   ang  spin  wallY  goalX  goalZ  curl');
for (const r of rows.slice(0, 15)) {
  console.log(
    `${score(r).toFixed(1).padStart(6)}  [${r.band[0]},${r.band[1]}]  ${r.yaw.toFixed(2).padStart(5)}  ${r.side.toFixed(2).padStart(5)}  ` +
    `${r.boot.toFixed(1).padStart(4)}  ${r.speed.toFixed(1).padStart(5)}  ${r.ang.toFixed(1).padStart(4)}  ` +
    `${r.spin.toFixed(0).padStart(4)}  ${r.wallY.toFixed(2).padStart(5)}  ${r.gx.toFixed(1).padStart(5)}  ` +
    `${r.gz.toFixed(2).padStart(5)}  ${r.curl.toFixed(2)}`
  );
}
if (rows.length) {
  const b = rows[0];
  console.log('\nbest: ' + JSON.stringify({ band: b.band, yaw: b.yaw, side: b.side, goalX: +b.gx.toFixed(1) }));
}
