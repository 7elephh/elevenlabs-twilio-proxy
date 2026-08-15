/**
 * Production run: simulate the whole free kick once, with the ball, and write
 * every body transform to out/kick.json for the renderer.
 *
 * The shot parameters come from tools/solve-aim.js. The ragdoll's whole path is
 * translated so that the ball -- placed against the real boot at the strike --
 * ends up at the world origin, which is where the scene wants it.
 */
import fs from 'node:fs';
import path from 'node:path';
import * as CANNON from 'cannon-es';
import { V, applyAerodynamics } from './physics-utils.js';
import { DIM, GROUP, segmentSpecs, bodySpecs } from './skeleton.js';
import {
  DT, REC_HZ, SCENE, STRIKE, scout, ballPlacementFor,
  buildSceneFor, actuateAt, makeBallIn,
} from './kick-sim.js';

/** The shot chosen by the aim solver. */
export const SHOT = {
  band: [0.064, 0.080],  // how deep under the ball's centre the boot passes
  yaw: 0.06,             // how far the hips are opened toward the target
  side: -0.14,           // how far round the ball the inside of the boot brushes
};

const END_T = 3.9;

export function record(shot = SHOT, { endT = END_T } = {}) {
  STRIKE.bandLo = shot.band[0];
  STRIKE.bandHi = shot.band[1];
  const aim = { yaw: shot.yaw };

  // --- pass 1: find the strike, and where the ball has to be -------------
  const s = scout(aim);
  if (!s.best) throw new Error('scout: no strike instant found');
  const place = ballPlacementFor(s.best, { side: shot.side });

  // translate the whole run-up so that ball lands on the world origin
  const shift = { x: SCENE.ball.x - place.pos.x, z: SCENE.ball.z - place.pos.z };

  // --- pass 2: the real thing --------------------------------------------
  const { world, rag, matBall } = buildSceneFor(aim, shift);
  const { bones, order } = rag;
  addGoalBodies(world);
  const ball = makeBallIn(world, matBall, SCENE.ball);

  const specs = segmentSpecs();
  // Audited from 0.15 s on: the first few frames are the harness taking hold of
  // a ragdoll that was assembled at rest, which is not part of the motion.
  const AUDIT_FROM = 0.15;
  const lengths = specs.map((sp) => ({ name: sp.name, max: 0, at: 0 }));

  const frames = [];
  const every = Math.round((1 / REC_HZ) / DT);

  let contact = null;
  let launch = null;
  let vBefore = V(0, 0, 0);
  let spinApplied = false;

  const N = Math.round(endT / DT);
  for (let i = 0; i < N; i++) {
    const t = i * DT;
    actuateAt(bones, t, aim, shift);
    applyAerodynamics(ball, DIM.ballR);
    if (contact === null) vBefore = ball.velocity.clone();

    world.step(DT);

    if (contact === null) {
      for (const eq of world.contacts) {
        const a = eq.bi, b = eq.bj;
        const hit = (a === bones.footL && b === ball) || (a === ball && b === bones.footL);
        if (!hit) continue;
        contact = {
          t: t + DT,
          point: ball.position.vadd(a === ball ? eq.ri : eq.rj),
          r: (a === ball ? eq.ri : eq.rj).clone(),
          footSpeed: bones.footL.velocity.length(),
          footVel: bones.footL.velocity.clone(),
        };
        break;
      }
    }

    // Spin from the strike, computed from the measured impulse and the real
    // lever arm of the contact point. cannon's Coulomb friction resolves far
    // too little shear across a 2 ms boot/ball contact to spin a ball up the
    // way a real inside-foot brush does, so the spin is taken from the
    // geometry instead -- and it is the *engine's* contact point and the
    // *engine's* impulse that go into it.
    if (contact && !spinApplied && t + DT >= contact.t + 0.018) {
      const J = ball.velocity.vsub(vBefore).scale(DIM.ballMass);
      const n = contact.r.unit();
      const Jt = J.vsub(n.scale(J.dot(n)));
      const I = 0.4 * DIM.ballMass * DIM.ballR * DIM.ballR;
      const cross = new CANNON.Vec3();
      contact.r.cross(Jt, cross);
      ball.angularVelocity.copy(cross.scale(1 / I));
      spinApplied = true;
      launch = {
        t: t + DT,
        v: ball.velocity.clone(),
        w: ball.angularVelocity.clone(),
        pos: ball.position.clone(),
      };
    }

    // --- audit: no segment may ever change length ---
    if (t >= AUDIT_FROM) {
      specs.forEach((sp, k) => {
        const pa = bones[sp.a[0]].pointToWorldFrame(sp.a[1]);
        const pb = bones[sp.b[0]].pointToWorldFrame(sp.b[1]);
        const d = pa.distanceTo(pb);
        if (d > lengths[k].max) { lengths[k].max = d; lengths[k].at = t; }
      });
    }

    if (i % every === 0) {
      const row = [];
      for (const n of order) {
        const b = bones[n];
        row.push(
          +b.position.x.toFixed(4), +b.position.y.toFixed(4), +b.position.z.toFixed(4),
          +b.quaternion.x.toFixed(4), +b.quaternion.y.toFixed(4),
          +b.quaternion.z.toFixed(4), +b.quaternion.w.toFixed(4)
        );
      }
      row.push(
        +ball.position.x.toFixed(4), +ball.position.y.toFixed(4), +ball.position.z.toFixed(4),
        +ball.quaternion.x.toFixed(4), +ball.quaternion.y.toFixed(4),
        +ball.quaternion.z.toFixed(4), +ball.quaternion.w.toFixed(4)
      );
      frames.push(row);
    }
  }

  if (!contact) throw new Error('production run: the boot never met the ball');

  // where does the shot actually finish?
  const bi = order.length * 7;
  let cross = null;
  for (let k = 1; k < frames.length; k++) {
    const x0 = frames[k - 1][bi], x1 = frames[k][bi];
    if (x0 < SCENE.goalX && x1 >= SCENE.goalX) {
      const f = (SCENE.goalX - x0) / (x1 - x0 || 1);
      cross = {
        t: k / REC_HZ,
        y: frames[k - 1][bi + 1] + (frames[k][bi + 1] - frames[k - 1][bi + 1]) * f,
        z: frames[k - 1][bi + 2] + (frames[k][bi + 2] - frames[k - 1][bi + 2]) * f,
      };
      break;
    }
  }
  let wallY = null, wallZ = 0;
  for (let k = 1; k < frames.length; k++) {
    if (frames[k - 1][bi] < SCENE.wallX && frames[k][bi] >= SCENE.wallX) {
      wallY = frames[k][bi + 1];
      wallZ = frames[k][bi + 2];
      break;
    }
  }

  const data = {
    fps: REC_HZ,
    dt: 1 / REC_HZ,
    bones: order,
    boneCount: order.length,
    frames,
    contactTime: contact.t,
    contact: {
      point: [contact.point.x, contact.point.y, contact.point.z],
      lever: [contact.r.x, contact.r.y, contact.r.z],
      belowCentre: DIM.ballR - contact.point.y,
      footSpeed: contact.footSpeed,
    },
    launch: launch && {
      t: launch.t,
      speed: launch.v.length(),
      angleDeg: (Math.atan2(launch.v.y, Math.hypot(launch.v.x, launch.v.z)) * 180) / Math.PI,
      spin: launch.w.length(),
      v: [launch.v.x, launch.v.y, launch.v.z],
      w: [launch.w.x, launch.w.y, launch.w.z],
    },
    launchPos: launch ? [launch.pos.x, launch.pos.y, launch.pos.z] : null,
    bodySpecs: bodySpecs(),
    ballRadius: DIM.ballR,
    scene: {
      ball: [SCENE.ball.x, SCENE.ball.y, SCENE.ball.z],
      goalX: SCENE.goalX,
      goalHalfWidth: SCENE.goalHalfWidth,
      goalHeight: SCENE.goalHeight,
      wallX: SCENE.wallX,
      approachYaw: 0.645,
    },
    cross, wallY, wallZ,
    goal: !!cross && Math.abs(cross.z) < SCENE.goalHalfWidth &&
      cross.y > 0 && cross.y < SCENE.goalHeight,
    audit: lengths.map((l) => ({
      name: l.name,
      maxSeparation: +l.max.toFixed(6),
      at: +l.at.toFixed(3),
    })),
  };

  return data;
}

/** Goal frame and net, as static bodies so the ball actually finishes in them. */
function addGoalBodies(world) {
  const netMat = new CANNON.Material('net');
  const add = (shape, pos, quat) => {
    const b = new CANNON.Body({
      mass: 0, shape, position: pos, material: netMat,
      collisionFilterGroup: GROUP.PROP,
      collisionFilterMask: GROUP.BALL,
    });
    if (quat) b.quaternion.copy(quat);
    world.addBody(b);
    return b;
  };
  const X = SCENE.goalX, W = SCENE.goalHalfWidth, H = SCENE.goalHeight;
  // posts and crossbar
  add(new CANNON.Box(V(0.06, H / 2, 0.06)), V(X, H / 2, W));
  add(new CANNON.Box(V(0.06, H / 2, 0.06)), V(X, H / 2, -W));
  add(new CANNON.Box(V(0.06, 0.06, W)), V(X, H, 0));
  // the net: a soft backstop 1.5 m behind the line
  const back = add(new CANNON.Box(V(0.05, H / 2, W)), V(X + 1.5, H / 2, 0));
  world.addContactMaterial(new CANNON.ContactMaterial(netMat, world.bodies[0].material || netMat, {
    friction: 0.9, restitution: 0.02,
  }));
  return back;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const data = record();
  const outDir = path.join(process.cwd(), 'out');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'kick.json'), JSON.stringify(data));

  const worst = data.audit.reduce((a, b) => (b.maxSeparation > a.maxSeparation ? b : a));
  console.log(`frames        ${data.frames.length} @ ${data.fps} Hz  (${(data.frames.length / data.fps).toFixed(2)} s)`);
  console.log(`contact       t=${data.contactTime.toFixed(3)} s, boot at ${data.contact.footSpeed.toFixed(1)} m/s`);
  console.log(`              ${(data.contact.belowCentre * 1000).toFixed(0)} mm below the ball's centre`);
  if (data.launch) {
    console.log(`launch        ${data.launch.speed.toFixed(1)} m/s at ${data.launch.angleDeg.toFixed(1)} deg, spin ${data.launch.spin.toFixed(0)} rad/s`);
  }
  console.log(`wall (x=${data.scene.wallX})  ball at ${data.wallY === null ? 'n/a' : data.wallY.toFixed(2) + ' m'}`);
  console.log(`goal line     ${data.cross ? `y=${data.cross.y.toFixed(2)} z=${data.cross.z.toFixed(2)}  ${data.goal ? 'GOAL' : 'MISS'}` : 'never reached'}`);
  console.log(`joint audit   worst separation ${worst.name} = ${(worst.maxSeparation * 1000).toFixed(2)} mm at t=${worst.at}s`);
}
