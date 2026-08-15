/**
 * STAGE 2 -- the full 3D simulation.
 *
 * Runs the ragdoll free kick and records every bone's transform to JSON for the
 * renderer. The pipeline is:
 *
 *   pass 1  simulate the whole kick with NO ball, recording the full state of
 *           every body at every step. Find the instant the left foot is
 *           fastest, low, and in front -- the strike instant.
 *   aim     rewind to just before that instant, drop a ball at a candidate
 *           offset from the foot, and simulate the impact. Integrate the
 *           resulting flight. Search the contact offset + body aim for the
 *           shot that finishes in the far top corner.
 *   pass 2  re-run the whole kick with the winning ball placement and record
 *           everything for rendering.
 *
 * The contact offset is a *geometric* placement of the ball relative to the
 * real foot position; the impulse, the spin and the flight all come out of the
 * solver and the aerodynamic model.
 */
import * as CANNON from 'cannon-es';
import fs from 'node:fs';
import path from 'node:path';
import {
  V, driveOrientation, driveBodyToPoint, applyAerodynamics, stiffen, AIR,
} from './physics-utils.js';
import { buildRagdoll, segmentSpecs, DIM, GROUP, BOOT_PATCH } from './skeleton.js';
import * as M from './motion.js';

export const DT = 1 / 480;
export const REC_HZ = 240;

/** Where the ball sits for the shot, and where the goal is. */
export const SCENE = {
  ball: V(0, DIM.ballR, 0),
  goalX: 18.3,   // solved: the distance at which this kick arrives under the bar
  goalHalfWidth: 3.66,
  goalHeight: 2.44,
  wallX: 9.15,
  target: { y: 2.02, z: 2.70 }, // aim point in the goal plane (set after the curl sign is known)
};

AIR.Cl = 0.30; // lift coefficient tuned to give a realistic few-metre curl

/**
 * How deep under the ball's centre the strike is taken, as a height band for
 * the boot's contact patch. Mutated by tools/solve-aim.js -- keep it an object
 * so the search can change it after import.
 */
export const STRIKE = { bandLo: 0.030, bandHi: 0.048 };

/* ------------------------------------------------------------------ world */

function makeWorld() {
  const world = new CANNON.World({ gravity: V(0, -9.81, 0) });
  world.solver.iterations = 90;
  world.solver.tolerance = 1e-10;
  world.allowSleep = false;
  world.defaultContactMaterial.friction = 0.7;
  world.defaultContactMaterial.restitution = 0.0;

  const matLimb = new CANNON.Material('limb');
  const matBall = new CANNON.Material('ball');
  const matTurf = new CANNON.Material('turf');

  world.addContactMaterial(new CANNON.ContactMaterial(matLimb, matBall, {
    friction: 0.9, restitution: 0.62,
    contactEquationStiffness: 5e8, contactEquationRelaxation: 2,
  }));
  // Soft and slippery: a boot grazing the grass at 15 m/s slides, it does not
  // catch. A stiff contact here turns a graze into a swing-killing impulse.
  world.addContactMaterial(new CANNON.ContactMaterial(matLimb, matTurf, {
    friction: 0.35, restitution: 0.0,
    contactEquationStiffness: 6e7, contactEquationRelaxation: 5,
  }));
  world.addContactMaterial(new CANNON.ContactMaterial(matBall, matTurf, {
    friction: 0.5, restitution: 0.45,
  }));

  const ground = new CANNON.Body({
    mass: 0, shape: new CANNON.Plane(), material: matTurf,
    collisionFilterGroup: GROUP.GROUND,
    collisionFilterMask: GROUP.LIMB | GROUP.BALL,
  });
  ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(ground);

  return { world, matLimb, matBall, matTurf };
}

/* ------------------------------------------------------------- controller */

const GAINS = {
  // The pelvis harness is deliberately stiff: it stands in for the balance and
  // locomotion muscles this simulation does not model, so the root follows its
  // path closely and all the interesting dynamics live in the limbs.
  pelvisPos: { kp: 150000, kd: 6000, maxForce: 20000 },
  pelvisRot: { kp: 9000, kd: 620, maxTorque: 4000 },
  torso: { kp: 2600, kd: 170, maxTorque: 1000 },
  head: { kp: 260, kd: 14, maxTorque: 90 },
  upperArm: { kp: 260, kd: 13, maxTorque: 130 },
  foreArm: { kp: 120, kd: 5, maxTorque: 60 },
  thighL: { kp: 3800, kd: 86, maxTorque: 1550 },
  shinL: { kp: 2600, kd: 24, maxTorque: 980 },
  footL: { kp: 520, kd: 9.0, maxTorque: 210 },   // ankle locked through the strike
  thighR: { kp: 1700, kd: 70, maxTorque: 700 },
  shinR: { kp: 900, kd: 26, maxTorque: 400 },
  footR: { kp: 300, kd: 7.0, maxTorque: 150 },
};

const qy = (a) => new CANNON.Quaternion().setFromAxisAngle(V(0, 1, 0), a);

/** Compute every bone's target orientation at time t, plus the pelvis target. */
export function targetsAt(t, aim) {
  const yaw = M.pelvisYaw(t) + (t > 1.20 ? aim.yaw : 0);
  const qPelvis = qy(yaw).mult(M.jointQ(M.pelvisLean(t), 0, 0));

  const tr = M.trunkTargets(t);
  const qTorso = qy(yaw + tr.yaw).mult(M.jointQ(tr.lean, tr.side, 0));
  const qHead = qy(yaw + tr.yaw * 0.6).mult(M.jointQ(tr.lean * 0.4, tr.side * 0.3, 0));

  const legs = M.legTargets(t);
  const arms = M.armTargets(t);

  const q = { pelvis: qPelvis, torso: qTorso, head: qHead };

  for (const side of ['L', 'R']) {
    const l = legs[side];
    const qThigh = qPelvis.mult(M.jointQ(l.flex, l.abduct ?? 0, l.twist ?? 0));
    const qShin = qThigh.mult(M.jointQ(-(l.knee ?? 0), 0, 0));
    const qFoot = qShin.mult(M.jointQ(l.ankle ?? 0, 0, 0));
    q['thigh' + side] = qThigh;
    q['shin' + side] = qShin;
    q['foot' + side] = qFoot;

    const a = arms[side];
    const qUA = qTorso.mult(M.jointQ(a.flex, a.abduct ?? 0, 0));
    q['upperArm' + side] = qUA;
    q['foreArm' + side] = qUA.mult(M.jointQ(a.elbow ?? 0, 0, 0));
  }

  return { q, pelvisPos: M.pelvisPath(t) };
}

/**
 * Muscle "effort" over time. A run-up is loose and springy; the strike is
 * explosive. Driving the whole clip at kick gains makes the run-up flail.
 */
function power(t, bone) {
  const kicking = bone === 'thighL' || bone === 'shinL' || bone === 'footL';
  if (t < 1.02) return kicking ? 0.16 : 0.22;      // run-up: loose
  if (t < 1.24) {
    const u = (t - 1.02) / 0.22;
    return (kicking ? 0.16 : 0.22) + (1 - (kicking ? 0.16 : 0.22)) * u * u * (3 - 2 * u);
  }
  return 1;
}

const scaled = (g, s) => ({ kp: g.kp * s, kd: g.kd * Math.sqrt(s), maxTorque: g.maxTorque * s });

export function actuateAt(bones, t, aim, shift) {
  const { q, pelvisPos } = targetsAt(t, aim);

  // pelvis: a force/torque "harness" standing in for the balance and
  // locomotion muscles that are not simulated.
  const target = V(pelvisPos.x + shift.x + SCENE.ball.x, pelvisPos.y, pelvisPos.z + shift.z + SCENE.ball.z);
  const dt = 1 / 240;
  const nxt = M.pelvisPath(t + dt);
  const vel = V((nxt.x - pelvisPos.x) / dt, (nxt.y - pelvisPos.y) / dt, (nxt.z - pelvisPos.z) / dt);
  driveBodyToPoint(bones.pelvis, target, vel, GAINS.pelvisPos);
  driveOrientation(bones.pelvis, q.pelvis, GAINS.pelvisRot);

  driveOrientation(bones.torso, q.torso, scaled(GAINS.torso, power(t, 'torso')));
  driveOrientation(bones.head, q.head, GAINS.head);
  for (const side of ['L', 'R']) {
    for (const [bone, gain] of [
      ['upperArm' + side, GAINS.upperArm], ['foreArm' + side, GAINS.foreArm],
      ['thigh' + side, GAINS['thigh' + side]], ['shin' + side, GAINS['shin' + side]],
      ['foot' + side, GAINS['foot' + side]],
    ]) {
      driveOrientation(bones[bone], q[bone], scaled(gain, power(t, bone)));
    }
  }
}

/* ------------------------------------------------------------------ state */

function snapshot(bones, order) {
  return order.map((n) => {
    const b = bones[n];
    return [
      b.position.x, b.position.y, b.position.z,
      b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w,
      b.velocity.x, b.velocity.y, b.velocity.z,
      b.angularVelocity.x, b.angularVelocity.y, b.angularVelocity.z,
    ];
  });
}

function restore(bones, order, snap) {
  order.forEach((n, i) => {
    const s = snap[i];
    const b = bones[n];
    b.position.set(s[0], s[1], s[2]);
    b.quaternion.set(s[3], s[4], s[5], s[6]);
    b.velocity.set(s[7], s[8], s[9]);
    b.angularVelocity.set(s[10], s[11], s[12]);
    b.previousPosition.copy(b.position);
    b.previousQuaternion.copy(b.quaternion);
    b.initPosition.copy(b.position);
    b.force.set(0, 0, 0);
    b.torque.set(0, 0, 0);
  });
}

export function makeBallIn(world, material, pos) {
  const b = new CANNON.Body({
    mass: DIM.ballMass, material,
    shape: new CANNON.Sphere(DIM.ballR),
    position: pos.clone(),
    collisionFilterGroup: GROUP.BALL,
    collisionFilterMask: GROUP.GROUND | GROUP.LIMB,
  });
  b.allowSleep = false;
  b.linearDamping = 0;
  b.angularDamping = 0;
  world.addBody(b);
  return b;
}

export function buildSceneFor(aim, shift) {
  const { world, matLimb, matBall } = makeWorld();
  const start = M.pelvisPath(0);
  const rag = buildRagdoll(world, {
    origin: V(start.x + shift.x + SCENE.ball.x, 0, start.z + shift.z + SCENE.ball.z),
    yaw: M.APPROACH_YAW + aim.yaw * 0,
    material: matLimb,
    dt: DT,
  });
  return { world, rag, matBall };
}

/* ----------------------------------------------------------- pass 1: scout */

const ZERO = { x: 0, z: 0 };

export function scout(aim) {
  const { world, rag } = buildSceneFor(aim, ZERO);
  const { bones, order } = rag;

  const states = [];   // states[i] is the world AFTER step i, i.e. at t=(i+1)*DT
  let best = null;

  const N = Math.round(2.4 / DT);
  for (let i = 0; i < N; i++) {
    const t = i * DT;
    actuateAt(bones, t, aim, ZERO);
    world.step(DT);
    states.push(snapshot(bones, order));

    const tAfter = t + DT;
    const foot = bones.footL;
    const v = foot.velocity;
    // Score by *forward* speed: that is what a strike is, and it rejects the
    // fast but useless downswing where the boot is mostly falling.
    // Restrict to the part of the arc that passes *under* the ball's centre.
    // The launch angle comes almost entirely from how far the boot gets under
    // the ball, so a slightly slower but lower pass beats a fast high one.
    const patch = foot.pointToWorldFrame(V(BOOT_PATCH.x, BOOT_PATCH.y, BOOT_PATCH.z));
    const inWindow = tAfter > 1.45 && tAfter < 2.00 &&
      patch.y > STRIKE.bandLo && patch.y < STRIKE.bandHi;
    if (inWindow && (!best || v.x > best.forward)) {
      best = {
        i, t: tAfter, speed: v.length(), forward: v.x,
        patch: patch.clone(),
        footPos: foot.position.clone(),
        footQ: foot.quaternion.clone(),
        vel: v.clone(),
        omega: foot.angularVelocity.clone(),
      };
    }
  }
  return { states, best, order };
}

/* --------------------------------------------------- impact + flight probe */

/**
 * Ball placement for a candidate strike.
 * The ball centre is put exactly one contact-distance from the mid-foot sphere,
 * along a direction expressed in the *foot's* own frame: forward, plus `side`
 * around the ball's side (the inside-foot brush) and `rise` above its equator.
 */
export function ballPlacementFor(best, cand) {
  // The ball is a ball: it rests on the turf, so its centre is fixed at ballR.
  // That means the *vertical* strike offset is not a free parameter -- it is
  // whatever height the swing carries the boot through. `side` only chooses
  // which way round the ball the boot passes.
  const dy = DIM.ballR - best.patch.y;
  const d = DIM.ballR + DIM.footR - 0.003;
  const h = Math.sqrt(Math.max(1e-6, d * d - dy * dy));

  // horizontal direction: the boot's own forward, yawed by `side`
  const fwd = best.footQ.vmult(V(1, 0, 0));
  fwd.y = 0;
  fwd.normalize();
  const c = Math.cos(cand.side), sn = Math.sin(cand.side);
  const dir = V(fwd.x * c + fwd.z * sn, 0, -fwd.x * sn + fwd.z * c);

  const pos = V(
    best.patch.x + dir.x * h,
    DIM.ballR,
    best.patch.z + dir.z * h
  );
  return {
    pos, dir, dy,
    strikeAboveCentre: best.patch.y - DIM.ballR,
    normalElevationDeg: (Math.asin(Math.min(1, dy / d)) * 180) / Math.PI,
  };
}

/** Rewind to just before the strike, drop the ball in, and simulate the impact. */
export function probeImpact(scoutData, cand, aim) {
  const { states, best, order } = scoutData;
  const back = Math.round(0.06 / DT);
  const rewind = Math.max(0, best.i - back);

  const { world, rag, matBall } = buildSceneFor(aim, ZERO);
  restore(rag.bones, order, states[rewind]);

  const place = ballPlacementFor(best, cand);
  const ball = makeBallIn(world, matBall, place.pos);

  let contact = null;
  let launch = null;
  let vBefore = V(0, 0, 0);
  let minDist = Infinity;
  const N = Math.round(0.28 / DT);
  for (let i = 0; i < N; i++) {
    const t = (rewind + 1) * DT + i * DT;
    actuateAt(rag.bones, t, aim, ZERO);
    applyAerodynamics(ball, DIM.ballR);
    if (contact === null) vBefore = ball.velocity.clone();
    world.step(DT);

    minDist = Math.min(minDist, rag.bones.footL.position.distanceTo(ball.position));

    // Capture the launch state a few milliseconds after the impulse: any later
    // and the ball has already bounced off the turf, which destroys the launch
    // angle we are trying to measure.
    if (contact !== null && launch === null && t >= contact.t + 0.018) {
      launch = {
        v: ball.velocity.clone(),
        w: ball.angularVelocity.clone(),
        pos: ball.position.clone(),
      };
    }

    if (contact === null) {
      for (const eq of world.contacts) {
        const a = eq.bi, b = eq.bj;
        const hit = (a === rag.bones.footL && b === ball) || (a === ball && b === rag.bones.footL);
        if (!hit) continue;
        contact = {
          t,
          point: ball.position.vadd(a === ball ? eq.ri : eq.rj),
          r: (a === ball ? eq.ri : eq.rj).clone(),
          footSpeed: rag.bones.footL.velocity.length(),
          footVel: rag.bones.footL.velocity.clone(),
        };
        break;
      }
    }
  }
  if (!contact) return { failed: 'no contact', minDist, place };
  if (!launch) return { failed: 'no launch sample', minDist, place };

  // Spin from the strike: the measured impulse crossed with the real lever arm
  // of the contact point. cannon's Coulomb friction under-predicts the shear a
  // soft boot puts through a ball, so this is computed from the geometry.
  const dv = launch.v.vsub(vBefore);
  const J = dv.scale(DIM.ballMass);
  const n = contact.r.unit();
  const Jt = J.vsub(n.scale(J.dot(n)));
  const I = 0.4 * DIM.ballMass * DIM.ballR * DIM.ballR;
  const cross = new CANNON.Vec3();
  contact.r.cross(Jt, cross);
  const spinFromContact = cross.scale(1 / I);

  return {
    contact, place, minDist,
    v: launch.v,
    wSolver: launch.w,
    wGeometric: spinFromContact,
    pos: launch.pos,
  };
}

/** Integrate a free flight and report where it crosses the goal plane. */
export function flight(pos, v, w, { until = SCENE.goalX, maxT = 4 } = {}) {
  const world = new CANNON.World({ gravity: V(0, -9.81, 0) });
  const b = new CANNON.Body({ mass: DIM.ballMass, shape: new CANNON.Sphere(DIM.ballR), position: pos.clone() });
  b.velocity.copy(v);
  b.angularVelocity.copy(w);
  world.addBody(b);

  const path = [];
  let crossed = null;
  for (let t = 0; t < maxT; t += DT) {
    const prev = b.position.clone();
    applyAerodynamics(b, DIM.ballR);
    world.step(DT);
    path.push(b.position.clone());
    if (!crossed && prev.x < until && b.position.x >= until) {
      const f = (until - prev.x) / (b.position.x - prev.x || 1);
      crossed = {
        t,
        y: prev.y + (b.position.y - prev.y) * f,
        z: prev.z + (b.position.z - prev.z) * f,
      };
    }
    if (b.position.y < -0.5) break;
  }
  return { crossed, path };
}
