/**
 * STAGE 1 PROTOTYPE -- validate the physics before building the full 3D scene.
 *
 * A single kicking leg (thigh / shin / foot) hanging from a fixed hip by real
 * hinge constraints, actuated only by PD torques, striking a ball.
 *
 * Checks the four things the final scene depends on:
 *   1. segment lengths stay constant (constraint solver, not keyframes)
 *   2. PD torque actuation reaches a realistic foot speed
 *   3. the foot/ball contact is found by the collision narrowphase
 *   4. the Magnus force bends the flight into a real curve
 *
 * The ball is placed by a first, ball-free pass that finds where the swinging
 * foot is fastest at ball height -- the same "solve for the contact, don't
 * eyeball it" idea used by the full 3D sim.
 *
 * Run: node src/proto2d.js       (TRACE=1 for a per-frame dump)
 */
import * as CANNON from 'cannon-es';
import { V, driveOrientation, applyAerodynamics, stiffen } from './physics-utils.js';

const DT = 1 / 480;
const G_GROUND = 1, G_LIMB = 2, G_BALL = 4;

const THIGH = 0.44, SHIN = 0.43, BALL_R = 0.11;
const HIP_POS = V(0, 0.92, 0);
const TOE_LOCAL = V(0.075, 0, 0);
const TOE_R = 0.055;

const qz = (a) => new CANNON.Quaternion().setFromAxisAngle(V(0, 0, 1), a);

/** Key poses of the kick. hip: 0 = straight down, + = forward. knee: + = flexed. */
const KEYS = [
  { t: 0.00, hip: -0.10, knee: 0.35, ankle: -0.25 },
  { t: 0.30, hip: -1.05, knee: 2.15, ankle: -0.40 }, // armé: heel cocked to the glutes
  { t: 0.42, hip: -0.30, knee: 1.60, ankle: -0.40 }, // thigh leads, knee still shut
  { t: 0.55, hip: 0.55, knee: -0.05, ankle: -0.35 }, // driving through the bottom
  { t: 0.85, hip: 1.10, knee: 0.50, ankle: -0.20 }, // follow-through, foot rises
  { t: 2.00, hip: 1.05, knee: 0.55, ankle: -0.20 },
];

function pose(t) {
  let a = KEYS[0], b = KEYS[KEYS.length - 1];
  for (let i = 0; i < KEYS.length - 1; i++) {
    if (t >= KEYS[i].t && t <= KEYS[i + 1].t) { a = KEYS[i]; b = KEYS[i + 1]; break; }
  }
  const u = Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t || 1)));
  const s = u * u * (3 - 2 * u);
  const mix = (k) => a[k] + (b[k] - a[k]) * s;
  return { hip: mix('hip'), knee: mix('knee'), ankle: mix('ankle') };
}

const THIGH_G = { kp: 1800, kd: 60, maxTorque: 700 };
const SHIN_G = { kp: 1200, kd: 18, maxTorque: 420 };
const FOOT_G = { kp: 70, kd: 1.8, maxTorque: 45 };

function build(ballPos) {
  const world = new CANNON.World({ gravity: V(0, -9.81, 0) });
  world.solver.iterations = 120;
  world.solver.tolerance = 1e-10;
  world.allowSleep = false;
  world.defaultContactMaterial.friction = 0.5;
  world.defaultContactMaterial.restitution = 0.3;

  // A boot striking an inflated ball: bouncy, and grippy enough to shear the
  // ball's surface into spin on an off-centre hit.
  const matLimb = new CANNON.Material('limb');
  const matBall = new CANNON.Material('ball');
  world.addContactMaterial(new CANNON.ContactMaterial(matLimb, matBall, {
    friction: 0.85, restitution: 0.55,
    contactEquationStiffness: 5e8, contactEquationRelaxation: 2,
  }));

  const anchor = new CANNON.Body({ mass: 0, position: HIP_POS.clone() });
  world.addBody(anchor);

  const limb = (mass, len, rad, pos) => {
    const b = new CANNON.Body({
      mass, position: pos, material: matLimb,
      collisionFilterGroup: G_LIMB, collisionFilterMask: G_GROUND | G_BALL,
    });
    for (let i = 0; i < 4; i++) {
      b.addShape(new CANNON.Sphere(rad), V(0, -len / 2 + (len * i) / 3, 0));
    }
    b.allowSleep = false;
    b.angularDamping = 0.02;
    return b;
  };

  const thigh = limb(9.0, THIGH, 0.075, HIP_POS.vadd(V(0, -THIGH / 2, 0)));
  const kneePos = HIP_POS.vadd(V(0, -THIGH, 0));
  const shin = limb(4.0, SHIN, 0.058, kneePos.vadd(V(0, -SHIN / 2, 0)));
  const anklePos = kneePos.vadd(V(0, -SHIN, 0));

  const foot = new CANNON.Body({
    mass: 1.6, position: anklePos.vadd(V(0.04, -0.05, 0)), material: matLimb,
    collisionFilterGroup: G_LIMB, collisionFilterMask: G_GROUND | G_BALL,
  });
  foot.addShape(new CANNON.Sphere(TOE_R), V(-0.045, 0, 0));
  foot.addShape(new CANNON.Sphere(TOE_R), TOE_LOCAL);
  foot.allowSleep = false;
  foot.angularDamping = 0.05;

  world.addBody(thigh); world.addBody(shin); world.addBody(foot);

  const AXIS = V(0, 0, 1);
  const joints = [
    new CANNON.HingeConstraint(anchor, thigh, {
      pivotA: V(0, 0, 0), pivotB: V(0, THIGH / 2, 0), axisA: AXIS, axisB: AXIS, maxForce: 1e7,
    }),
    new CANNON.HingeConstraint(thigh, shin, {
      pivotA: V(0, -THIGH / 2, 0), pivotB: V(0, SHIN / 2, 0), axisA: AXIS, axisB: AXIS, maxForce: 1e7,
    }),
    new CANNON.HingeConstraint(shin, foot, {
      pivotA: V(0, -SHIN / 2, 0), pivotB: V(-0.04, 0.05, 0), axisA: AXIS, axisB: AXIS, maxForce: 1e7,
    }),
  ];
  for (const c of joints) { world.addConstraint(c); stiffen(c, 1e10, 2, DT); }

  const ground = new CANNON.Body({
    mass: 0, shape: new CANNON.Plane(),
    collisionFilterGroup: G_GROUND, collisionFilterMask: G_LIMB | G_BALL,
  });
  ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(ground);

  let ball = null;
  if (ballPos) {
    ball = new CANNON.Body({
      mass: 0.43, shape: new CANNON.Sphere(BALL_R), position: ballPos.clone(),
      material: matBall,
      collisionFilterGroup: G_BALL, collisionFilterMask: G_GROUND | G_LIMB,
    });
    ball.allowSleep = false;
    world.addBody(ball);
  }

  return { world, anchor, thigh, shin, foot, ball };
}

function step(sim, t) {
  const p = pose(t);
  driveOrientation(sim.thigh, qz(p.hip), THIGH_G);
  driveOrientation(sim.shin, qz(p.hip - p.knee), SHIN_G);
  driveOrientation(sim.foot, qz(p.hip - p.knee + p.ankle), FOOT_G);
  if (sim.ball) applyAerodynamics(sim.ball, BALL_R);
  sim.world.step(DT);
}

/* -------- pass 1: where is the foot fastest, at ball height? ------------- */
const scout = build(null);
let best = null;
for (let i = 0, t = 0; t < 1.2; i++, t += DT) {
  step(scout, t);
  const toe = scout.foot.pointToWorldFrame(TOE_LOCAL);
  const vToe = scout.foot.velocity.length();
  // want the strike phase: moving forward, near ball height
  const forward = scout.foot.velocity.x > 0;
  // strike window only: after the armé, foot low (at ball height), moving forward
  const inStrike = t > 0.42 && t < 0.95;
  // ...and in FRONT of the hip: that is where a planted-foot strike happens
  if (inStrike && forward && toe.x > 0.15 && toe.y > 0.03 && toe.y < 0.22 && (!best || vToe > best.v)) {
    best = { t: t + DT, v: vToe, toe: toe.clone(), vel: scout.foot.velocity.clone() };
  }
}

if (!best) { console.error('pass 1: foot never swung forward near the ground'); process.exit(1); }

// Place the ball so its surface meets the toe sphere exactly at that instant,
// struck slightly above centre (lift) -- geometry, not eyeballing.
const dir = best.vel.clone();
dir.y = 0;
dir.normalize();
const RISE = 0.018; // strike this far above the ball's equator
const ballPos = V(
  best.toe.x + dir.x * (BALL_R + TOE_R - 0.005),
  BALL_R,
  0
);

/* -------- pass 2: the real strike ---------------------------------------- */
const sim = build(ballPos);
const { thigh, shin, foot, ball, anchor } = sim;

let contactTime = null, contactPoint = null, footSpeedAtContact = 0, ballLaunch = null;
const lenErr = { thigh: 0, shin: 0, joint: 0 };
let peakFootSpeed = 0;

for (let i = 0, t = 0; t < 2.4; i++, t += DT) {
  step(sim, t);
  peakFootSpeed = Math.max(peakFootSpeed, foot.velocity.length());

  if (t > 0.05) {
  const hipW = anchor.pointToWorldFrame(V(0, 0, 0));
  const kneeA = thigh.pointToWorldFrame(V(0, -THIGH / 2, 0));
  const kneeB = shin.pointToWorldFrame(V(0, SHIN / 2, 0));
  const ankA = shin.pointToWorldFrame(V(0, -SHIN / 2, 0));
  const ankB = foot.pointToWorldFrame(V(-0.04, 0.05, 0));
  lenErr.thigh = Math.max(lenErr.thigh, Math.abs(hipW.distanceTo(kneeA) - THIGH));
  lenErr.shin = Math.max(lenErr.shin, Math.abs(kneeA.distanceTo(ankA) - SHIN));
  lenErr.joint = Math.max(lenErr.joint, kneeA.distanceTo(kneeB), ankA.distanceTo(ankB));
  }

  if (contactTime === null) {
    for (const eq of sim.world.contacts) {
      const hit = (eq.bi === foot && eq.bj === ball) || (eq.bi === ball && eq.bj === foot);
      if (!hit) continue;
      contactTime = t;
      contactPoint = ball.position.vadd(eq.bi === ball ? eq.ri : eq.rj);
      footSpeedAtContact = foot.velocity.length();
      break;
    }
  }
  if (contactTime !== null && ballLaunch === null && t > contactTime + 0.03) {
    ballLaunch = { v: ball.velocity.clone(), w: ball.angularVelocity.clone() };
  }

  if (process.env.TRACE && i % 24 === 0 && t < 1.2) {
    const toe = foot.pointToWorldFrame(TOE_LOCAL);
    console.log(`t=${t.toFixed(3)} toe=(${toe.x.toFixed(3)},${toe.y.toFixed(3)}) |v|=${foot.velocity.length().toFixed(2)}`);
  }
}

/* -------- 4. Magnus, checked on its own (a planar leg has no sidespin) ---- */
function flight(spinY) {
  const w2 = new CANNON.World({ gravity: V(0, -9.81, 0) });
  const b = new CANNON.Body({ mass: 0.43, shape: new CANNON.Sphere(BALL_R), position: V(0, 0.11, 0) });
  b.velocity.set(24, 7.5, 0);
  b.angularVelocity.set(0, spinY, 0);
  w2.addBody(b);
  while (b.position.y > 0.11 || b.velocity.y > 0) {
    applyAerodynamics(b, BALL_R);
    w2.step(DT);
    if (b.position.x > 80) break;
  }
  return { x: b.position.x, z: b.position.z };
}

/* -------- report --------------------------------------------------------- */
const out = (k, v) => console.log('  ' + k.padEnd(36), v);
console.log('\n=== STAGE 1 PROTOTYPE: kicking-leg ragdoll ===\n');

console.log('-- ball placement solved from the swing --');
out('peak-speed instant (s)', best.t.toFixed(3));
out('toe at that instant', `${best.toe.x.toFixed(3)} ${best.toe.y.toFixed(3)}`);
out('ball centre placed at', `${ballPos.x.toFixed(3)} ${ballPos.y.toFixed(3)}`);

console.log('\n-- 1. segment length stability --');
out('max thigh length error (m)', lenErr.thigh.toExponential(2));
out('max shin length error (m)', lenErr.shin.toExponential(2));
out('max joint separation (m)', lenErr.joint.toExponential(2));

console.log('\n-- 2/3. swing and contact --');
out('peak foot speed (m/s)', peakFootSpeed.toFixed(2));
out('contact time (s)', contactTime === null ? 'NO CONTACT' : contactTime.toFixed(4));
out('foot speed at contact (m/s)', footSpeedAtContact.toFixed(2));
if (contactPoint) {
  out('contact point (world)', `${contactPoint.x.toFixed(3)} ${contactPoint.y.toFixed(3)}`);
  out('contact height vs ball centre (m)', (contactPoint.y - BALL_R).toFixed(4));
}
if (ballLaunch) {
  out('ball launch speed (m/s)', ballLaunch.v.length().toFixed(2));
  out('launch angle (deg)', ((Math.atan2(ballLaunch.v.y, ballLaunch.v.x) * 180) / Math.PI).toFixed(1));
  out('ball spin (rad/s)', ballLaunch.w.length().toFixed(1));
}

const straight = flight(0), curled = flight(-95);
console.log('\n-- 4. Magnus model --');
out('no spin  : range / lateral (m)', `${straight.x.toFixed(2)} / ${straight.z.toFixed(2)}`);
out('95 rad/s : range / lateral (m)', `${curled.x.toFixed(2)} / ${curled.z.toFixed(2)}`);

const checks = [
  ['segment lengths fixed (<2mm)', lenErr.thigh < 2e-3 && lenErr.shin < 5e-3 && lenErr.joint < 7e-3],
  ['foot reaches strike speed (>15 m/s)', peakFootSpeed > 15],
  ['narrowphase found foot/ball contact', contactTime !== null],
  ['ball launched hard (>18 m/s)', !!ballLaunch && ballLaunch.v.length() > 18],
  ['Magnus curves the flight (>1 m)', Math.abs(curled.z - straight.z) > 1],
];
console.log('');
let ok = true;
for (const [name, pass] of checks) { console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${name}`); ok = ok && pass; }
console.log('\nRESULT:', ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
