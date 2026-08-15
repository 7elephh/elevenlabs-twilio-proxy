/**
 * Solve for the shot.
 *
 * The kick itself is fixed physics; what a player actually adjusts is where
 * they aim their body and where on the ball they put the boot. This searches
 * exactly those two things:
 *
 *   yaw   -- how far the hips are opened toward the target through the strike
 *   side  -- how far round the ball the boot passes (the inside-foot brush)
 *   band  -- how deep under the ball's centre the contact patch is taken
 *
 * and scores the resulting flight: clear the wall, finish high in the far
 * corner, and actually curl on the way.
 */
import { scout, probeImpact, flight, SCENE, STRIKE, DT } from '../src/kick-sim.js';
import { DIM } from '../src/skeleton.js';
import { V } from '../src/physics-utils.js';

const WALL_TOP = 2.15;   // a jumping four-man wall
const results = [];

const yaws = [-0.34, -0.24, -0.14, -0.04, 0.06, 0.16, 0.26];
// The swing arc bottoms out at a patch height of about 0.048, so bands below
// that are simply unreachable -- these bracket what the leg can actually do.
const bands = [
  [0.046, 0.058],
  [0.050, 0.064],
  [0.056, 0.070],
  [0.064, 0.082],
];
const sides = [-0.80, -0.66, -0.55, -0.44, -0.34, -0.24, -0.14, -0.04, 0.08, 0.20, 0.32];

for (const band of bands) {
  STRIKE.bandLo = band[0];
  STRIKE.bandHi = band[1];
  for (const yaw of yaws) {
    const aim = { yaw };
    let s;
    try { s = scout(aim); } catch { continue; }
    if (!s.best) continue;

    for (const side of sides) {
      const r = probeImpact(s, { side }, aim);
      if (r.failed) continue;

      const f = flight(r.pos, r.v, r.wGeometric);
      if (!f.crossed) continue;

      // where is it as it passes the wall?
      let atWall = null;
      for (let i = 1; i < f.path.length; i++) {
        if (f.path[i - 1].x < SCENE.wallX && f.path[i].x >= SCENE.wallX) { atWall = f.path[i]; break; }
      }
      if (!atWall) continue;

      // straight-line reference: how much did the aerodynamics actually bend it?
      const straight = flight(r.pos, r.v, V(0, 0, 0));
      const curl = straight.crossed
        ? Math.abs(f.crossed.z - straight.crossed.z) : 0;

      const inGoal = Math.abs(f.crossed.z) < SCENE.goalHalfWidth - 0.2 &&
        f.crossed.y > 0.3 && f.crossed.y < SCENE.goalHeight - 0.12;
      const overWall = atWall.y > WALL_TOP;

      results.push({
        band, yaw, side,
        speed: r.v.length(),
        launchDeg: (Math.atan2(r.v.y, Math.hypot(r.v.x, r.v.z)) * 180) / Math.PI,
        spin: r.wGeometric.length(),
        wallY: atWall.y,
        gy: f.crossed.y, gz: f.crossed.z,
        curl, inGoal, overWall,
        contactBelow: -r.place.strikeAboveCentre,
      });
    }
  }
}

// A good free kick: over the wall, inside the frame, high, wide of the keeper,
// and visibly bent.
function score(r) {
  const cornerY = 1.90, cornerZ = 2.70;
  const miss = Math.hypot(r.gy - cornerY, Math.abs(r.gz) - cornerZ);
  let v = -miss * 12 + Math.min(r.curl, 4) * 9 + Math.min(r.speed, 28) * 0.5;
  if (!r.overWall) v -= 1000 + (WALL_TOP - r.wallY) * 50;
  if (!r.inGoal) v -= 300;
  return v;
}

results.sort((a, b) => score(b) - score(a));

console.log(`${results.length} candidates produced a flight\n`);
console.log('score  band          yaw    side   speed  launch  spin   wallY   goal(y,z)     curl');
for (const r of results.slice(0, 18)) {
  console.log(
    `${score(r).toFixed(1).padStart(6)}  [${r.band[0]},${r.band[1]}]  ` +
    `${r.yaw.toFixed(2).padStart(5)}  ${r.side.toFixed(2).padStart(5)}  ` +
    `${r.speed.toFixed(1).padStart(5)}  ${r.launchDeg.toFixed(1).padStart(6)}  ` +
    `${r.spin.toFixed(0).padStart(4)}  ${r.wallY.toFixed(2).padStart(5)}  ` +
    `(${r.gy.toFixed(2)}, ${r.gz.toFixed(2)})  ${r.curl.toFixed(2)}`
  );
}

if (results.length) {
  const b = results[0];
  console.log('\nbest:', JSON.stringify({
    band: b.band, yaw: b.yaw, side: b.side,
    launchDeg: +b.launchDeg.toFixed(1), speed: +b.speed.toFixed(1),
    spin: +b.spin.toFixed(0), curl: +b.curl.toFixed(2),
    crosses: [+b.gy.toFixed(2), +b.gz.toFixed(2)],
  }));
}
