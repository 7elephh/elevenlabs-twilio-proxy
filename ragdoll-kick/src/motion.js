/**
 * The motion script: what the muscles are *asked* to do.
 *
 * Nothing here moves a body. It only produces target orientations, which
 * controller torques then chase. Whether the ragdoll actually reaches a pose
 * -- and what happens when its foot meets a ball on the way -- is decided by
 * the solver.
 *
 * Timeline (seconds):
 *   0.00 - 1.10  run-up, ~37 deg approach, three strides
 *   1.10 - 1.32  plant: right foot goes down beside the ball, knee flexes
 *   1.32 - 1.50  armé: left hip opens, heel to the glutes, torso leans back
 *   ~1.60        contact
 *   1.60 - 2.00  follow-through: leg swings across, torso turns with the hip
 */
import * as CANNON from 'cannon-es';
import { V } from './physics-utils.js';

export const T = {
  runEnd: 1.10,
  plant: 1.28,
  arme: 1.48,
  strike: 1.70,   // the *target* pose time; contact happens on the way there
  follow: 2.02,
  settle: 2.90,
};

export const APPROACH_YAW = 0.645; // ~37 deg

/**
 * Pelvis height through the strike. This single number decides where the swing
 * arc bottoms out, and therefore whether the boot meets the ball above or below
 * its centre. Swept in tools/sweep-height.js.
 */
export const STRIKE_HIP_Y = Number(process.env.STRIKE_HIP_Y ?? 1.010);

/* ---------------------------------------------------------------- helpers */

function keyed(keys, t) {
  let a = keys[0], b = keys[keys.length - 1];
  if (t <= keys[0].t) return { ...keys[0] };
  for (let i = 0; i < keys.length - 1; i++) {
    if (t >= keys[i].t && t <= keys[i + 1].t) { a = keys[i]; b = keys[i + 1]; break; }
  }
  if (t >= keys[keys.length - 1].t) return { ...keys[keys.length - 1] };
  const u = Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t || 1)));
  const s = u * u * (3 - 2 * u); // smoothstep
  const o = {};
  for (const k of Object.keys(a)) if (k !== 't') o[k] = a[k] + (b[k] - a[k]) * s;
  return o;
}

const qAxis = (ax, ay, az, a) =>
  new CANNON.Quaternion().setFromAxisAngle(V(ax, ay, az), a);

/**
 * Compose a bone target from joint angles, in the frame of its parent.
 *   flex   : + swings the bone forward (about the body's right axis, +Z)
 *   abduct : + swings the bone out to the body's left (about forward, +X)
 *   twist  : + rotates the bone about its own long axis (+Y)
 */
export function jointQ(flex, abduct = 0, twist = 0) {
  return qAxis(1, 0, 0, abduct).mult(qAxis(0, 0, 1, flex)).mult(qAxis(0, 1, 0, twist));
}

/* ---------------------------------------------------------------- pelvis */

/**
 * Pelvis path, expressed relative to the ball, in the world frame.
 * The run-up comes in at APPROACH_YAW from the +Z side of the shooting line.
 */
export function pelvisPath(t) {
  const a = APPROACH_YAW;
  // distance back along the approach line, and the vertical bob
  const keys = [
    { t: 0.00, d: 4.45, y: 0.95 },
    { t: 0.35, d: 3.31, y: 0.98 },
    { t: 0.70, d: 2.10, y: 0.95 },
    { t: 1.00, d: 1.06, y: 0.98 },
    { t: 1.28, d: 0.46, y: 0.905 }, // plant: the body sinks onto the support leg
    { t: 1.48, d: 0.36, y: 0.960 }, // armé
    { t: 1.70, d: 0.24, y: STRIKE_HIP_Y }, // through contact: low enough to get under the ball
    { t: 2.02, d: -0.10, y: 1.055 }, // follow-through, up onto the plant foot
    { t: 2.45, d: -0.52, y: 0.985 },
    { t: 3.20, d: -0.92, y: 0.935 },
  ];
  const k = keyed(keys, t);
  // the approach line: heading a means travelling along (cos a, 0, -sin a)
  return V(-k.d * Math.cos(a), k.y, k.d * Math.sin(a));
}

export function pelvisYaw(t) {
  return keyed([
    { t: 0.00, v: APPROACH_YAW },
    { t: 1.10, v: APPROACH_YAW },
    { t: 1.28, v: 0.560 },
    { t: 1.48, v: 0.430 },
    { t: 1.70, v: 0.140 }, // hips opening through the ball
    { t: 2.02, v: -0.230 }, // turned right through the follow-through
    { t: 3.20, v: -0.330 },
  ], t).v;
}

/** Pelvis lean: + tips the trunk backwards (about the body's right axis). */
export function pelvisLean(t) {
  return keyed([
    { t: 0.00, v: -0.10 },
    { t: 1.10, v: -0.12 },
    { t: 1.28, v: 0.02 },
    { t: 1.48, v: 0.16 }, // leans back over the plant foot during the armé
    { t: 1.70, v: 0.10 },
    { t: 2.02, v: -0.14 },
    { t: 3.20, v: -0.08 },
  ], t).v;
}

/* ---------------------------------------------------------------- gait */

const STRIDE = 0.42; // seconds per full cycle

function runCycle(phase) {
  // phase 0 = leg planted underneath, pi = leg reaching forward
  const hip = 0.62 * Math.sin(phase) - 0.06;
  const knee = 0.32 + 0.95 * Math.max(0, Math.sin(phase + 2.35));
  const ankle = -0.20 + 0.18 * Math.sin(phase + 1.2);
  return { flex: hip, knee, ankle, abduct: 0 };
}

/* ---------------------------------------------------------------- legs */

// Left leg: the striking leg.
const LEFT_KICK = [
  { t: 1.10, flex: -0.30, abduct: 0.06, knee: 0.80, ankle: -0.22, twist: 0.05 },
  { t: 1.34, flex: -0.80, abduct: 0.24, knee: 1.65, ankle: -0.20, twist: 0.18 },
  { t: 1.50, flex: -1.05, abduct: 0.38, knee: 2.00, ankle: -0.18, twist: 0.28 }, // armé
  { t: 1.56, flex: -0.85, abduct: 0.38, knee: 1.90, ankle: -0.16, twist: 0.28 },
  // A deliberate overshoot: the leg must still be accelerating when it meets
  // the ball, so the target is well past the contact pose. Hip and knee open
  // together, and the arc naturally bottoms out at about ball height.
  { t: 1.76, flex: 1.35, abduct: 0.00, knee: 0.10, ankle: -0.02, twist: 0.10 },
  { t: 2.10, flex: 1.35, abduct: -0.30, knee: 0.60, ankle: -0.15, twist: -0.12 }, // across the body
  { t: 2.90, flex: 0.35, abduct: -0.08, knee: 0.75, ankle: -0.12, twist: -0.02 },
];

// Right leg: the support leg. Plants beside the ball and stays there.
const RIGHT_PLANT = [
  { t: 1.10, flex: 0.55, abduct: -0.05, knee: 0.55, ankle: -0.20, twist: 0 },
  { t: 1.28, flex: 0.30, abduct: -0.10, knee: 0.42, ankle: -0.12, twist: 0 }, // planted, knee softly flexed
  { t: 1.48, flex: 0.16, abduct: -0.12, knee: 0.34, ankle: -0.08, twist: 0 },
  { t: 1.70, flex: 0.02, abduct: -0.12, knee: 0.20, ankle: 0.06, twist: 0 }, // extends, driving the hips through
  { t: 2.02, flex: -0.10, abduct: -0.10, knee: 0.12, ankle: 0.30, twist: 0 }, // up on the toes
  { t: 2.90, flex: -0.05, abduct: -0.06, knee: 0.30, ankle: 0.05, twist: 0 },
];

const BLEND = 0.16; // seconds to cross-fade from the run cycle into the kick

function blend(a, b, u) {
  const s = u * u * (3 - 2 * u);
  const o = {};
  for (const k of Object.keys(b)) o[k] = (a[k] ?? 0) + ((b[k] ?? 0) - (a[k] ?? 0)) * s;
  return o;
}

export function legTargets(t) {
  // run cycle: left leg leads by half a stride
  const ph = (t / STRIDE) * 2 * Math.PI;
  const runL = runCycle(ph);
  const runR = runCycle(ph + Math.PI);

  const kickL = keyed(LEFT_KICK, t);
  const kickR = keyed(RIGHT_PLANT, t);

  const u = Math.min(1, Math.max(0, (t - (T.runEnd - BLEND)) / BLEND));
  return { L: blend(runL, kickL, u), R: blend(runR, kickR, u) };
}

/* ---------------------------------------------------------------- arms */

export function armTargets(t) {
  const ph = (t / STRIDE) * 2 * Math.PI;
  // arms counter-swing the legs during the run-up
  const runL = { flex: -0.55 * Math.sin(ph + Math.PI) - 0.1, abduct: 0.22, elbow: 1.15 };
  const runR = { flex: -0.55 * Math.sin(ph) - 0.1, abduct: -0.22, elbow: 1.15 };

  // through the kick both arms come out for balance, the right one high
  const kickL = keyed([
    { t: 1.10, flex: -0.30, abduct: 0.45, elbow: 1.00 },
    { t: 1.48, flex: -0.75, abduct: 0.95, elbow: 0.75 },
    { t: 1.70, flex: -0.60, abduct: 1.15, elbow: 0.60 },
    { t: 2.02, flex: 0.10, abduct: 0.80, elbow: 0.80 },
    { t: 2.90, flex: -0.10, abduct: 0.45, elbow: 0.95 },
  ], t);
  const kickR = keyed([
    { t: 1.10, flex: 0.20, abduct: -0.55, elbow: 1.00 },
    { t: 1.48, flex: 0.55, abduct: -1.15, elbow: 0.65 }, // counterweight to the armé
    { t: 1.70, flex: 0.30, abduct: -1.25, elbow: 0.55 },
    { t: 2.02, flex: -0.35, abduct: -0.85, elbow: 0.80 },
    { t: 2.90, flex: -0.10, abduct: -0.50, elbow: 0.95 },
  ], t);

  const u = Math.min(1, Math.max(0, (t - (T.runEnd - BLEND)) / BLEND));
  return { L: blend(runL, kickL, u), R: blend(runR, kickR, u) };
}

/* ---------------------------------------------------------------- trunk */

export function trunkTargets(t) {
  // the torso separates from the pelvis: it lags in the armé, then whips through
  const yaw = keyed([
    { t: 0.00, v: 0.10 }, { t: 1.10, v: 0.10 },
    { t: 1.48, v: 0.26 },  // shoulders held back against the opening hips
    { t: 1.70, v: -0.02 },
    { t: 2.02, v: -0.26 }, { t: 3.20, v: -0.20 },
  ], t).v;
  const lean = keyed([
    { t: 0.00, v: -0.20 }, { t: 1.10, v: -0.22 },
    { t: 1.48, v: 0.20 },  // chest opens to the sky in the armé
    { t: 1.70, v: 0.10 },
    { t: 2.02, v: -0.26 }, { t: 3.20, v: -0.12 },
  ], t).v;
  const side = keyed([
    { t: 0.00, v: 0.0 }, { t: 1.28, v: -0.10 },
    { t: 1.70, v: -0.24 }, // leans away from the kicking leg
    { t: 2.02, v: -0.12 }, { t: 3.20, v: 0.0 },
  ], t).v;
  return { yaw, lean, side };
}
