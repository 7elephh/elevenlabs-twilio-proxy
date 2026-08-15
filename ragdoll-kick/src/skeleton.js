/**
 * The ragdoll: 15 rigid bodies wired together with real joint constraints.
 *
 * Deliberately Toribash-plain -- capsules and spheres, no face, no clothing.
 * Every bone is a compound of spheres along its axis, which gives cheap, stable
 * contacts and (for the foot) an exact analytic contact with the ball.
 *
 * Bone frame convention, before any joint rotation is applied:
 *   bone points along -Y (down), body forward is +X, body right is +Z.
 */
import * as CANNON from 'cannon-es';
import { V, stiffen } from './physics-utils.js';

export const GROUP = { GROUND: 1, LIMB: 2, BALL: 4, PROP: 8 };

/** Where on the boot the inside-foot strike happens, in foot-local space. */
export const BOOT_PATCH = { x: 0.018, y: -0.020, z: 0 };

/** Body proportions of a ~1.80 m, ~75 kg player. */
export const DIM = {
  hipY: 0.92,
  pelvisHalf: 0.10,
  torsoLen: 0.46,
  neckY: 1.50,
  headR: 0.115,

  shoulderY: 1.42,
  shoulderZ: 0.19,
  upperArm: 0.29,
  foreArm: 0.27,

  hipZ: 0.105,
  thigh: 0.44,
  shin: 0.43,

  footLen: 0.135,
  footR: 0.038,      // contact-sphere radius of the boot
  footDrop: 0.020,   // contact spheres sit below the ankle axis, like a sole
  ankleDrop: 0.05,

  ballR: 0.11,
  ballMass: 0.43,
};

const MASS = {
  pelvis: 12, torso: 22, head: 5,
  upperArm: 2.2, foreArm: 1.5,
  thigh: 8.5, shin: 3.8, foot: 1.4,
};

const RAD = {
  pelvis: 0.125, torso: 0.135, upperArm: 0.052, foreArm: 0.045,
  thigh: 0.078, shin: 0.060,
};

/** A capsule approximated by n spheres along the local -Y axis. */
function capsuleBody(mass, len, rad, pos, material, nSpheres = 4) {
  const b = new CANNON.Body({
    mass, material,
    position: pos.clone(),
    collisionFilterGroup: GROUP.LIMB,
    collisionFilterMask: GROUP.GROUND | GROUP.BALL,
  });
  for (let i = 0; i < nSpheres; i++) {
    const t = nSpheres === 1 ? 0 : -len / 2 + (len * i) / (nSpheres - 1);
    b.addShape(new CANNON.Sphere(rad), V(0, t, 0));
  }
  b.allowSleep = false;
  b.angularDamping = 0.05;
  b.linearDamping = 0.01;
  return b;
}

/**
 * Build the ragdoll standing at `origin` with heading `yaw` (radians about +Y).
 * Returns { bones, joints, order } where bones is a name -> CANNON.Body map.
 *
 * Joints are PointToPointConstraints: they pin an anchor point of the child to
 * an anchor point of the parent, which is exactly what makes every segment
 * length constant for the whole simulation. Pose is produced by torques
 * (see controller.js), never by writing positions.
 */
export function buildRagdoll(world, { origin = V(0, 0, 0), yaw = 0, material, dt }) {
  const D = DIM;
  const bones = {};
  const joints = [];

  const qYaw = new CANNON.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw);
  // place a bone whose *top* anchor sits at local point `top`, hanging down
  const at = (localX, localY, localZ) => {
    const p = qYaw.vmult(V(localX, 0, localZ));
    return V(origin.x + p.x, localY, origin.z + p.z);
  };

  // ---- trunk -------------------------------------------------------------
  bones.pelvis = capsuleBody(MASS.pelvis, 0.16, RAD.pelvis, at(0, D.hipY + 0.03, 0), material, 2);
  bones.torso = capsuleBody(MASS.torso, D.torsoLen, RAD.torso,
    at(0, D.hipY + 0.11 + D.torsoLen / 2, 0), material, 3);
  bones.head = capsuleBody(MASS.head, 0.02, D.headR,
    at(0, D.neckY + D.headR + 0.03, 0), material, 1);

  // ---- arms --------------------------------------------------------------
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? -1 : 1; // -Z is the player's left
    bones['upperArm' + side] = capsuleBody(MASS.upperArm, D.upperArm, RAD.upperArm,
      at(0, D.shoulderY - D.upperArm / 2, s * D.shoulderZ), material, 3);
    bones['foreArm' + side] = capsuleBody(MASS.foreArm, D.foreArm, RAD.foreArm,
      at(0, D.shoulderY - D.upperArm - D.foreArm / 2, s * D.shoulderZ), material, 3);
  }

  // ---- legs --------------------------------------------------------------
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? -1 : 1;
    bones['thigh' + side] = capsuleBody(MASS.thigh, D.thigh, RAD.thigh,
      at(0, D.hipY - D.thigh / 2, s * D.hipZ), material, 4);
    bones['shin' + side] = capsuleBody(MASS.shin, D.shin, RAD.shin,
      at(0, D.hipY - D.thigh - D.shin / 2, s * D.hipZ), material, 4);

    // foot: heel + toe spheres, offset forward of the ankle
    const ankleY = D.hipY - D.thigh - D.shin;
    const foot = new CANNON.Body({
      mass: MASS.foot, material,
      position: at(D.footLen * 0.18, ankleY - D.ankleDrop, s * D.hipZ),
      collisionFilterGroup: GROUP.LIMB,
      collisionFilterMask: GROUP.GROUND | GROUP.BALL,
    });
    // Heel, instep and toe, set below the ankle axis so the boot is a low
    // wedge rather than a ball. This matters: the launch angle of the shot is
    // set by how far the contact patch gets *under* the ball's centre, and a
    // fat sphere centred on the ankle simply cannot get under it.
    foot.addShape(new CANNON.Sphere(D.footR), V(-D.footLen * 0.42, -D.footDrop, 0));
    foot.addShape(new CANNON.Sphere(D.footR), V(0, -D.footDrop, 0));
    foot.addShape(new CANNON.Sphere(D.footR), V(D.footLen * 0.42, -D.footDrop, 0));
    foot.allowSleep = false;
    foot.angularDamping = 0.1;
    bones['foot' + side] = foot;
  }

  for (const b of Object.values(bones)) world.addBody(b);

  // ---- joints ------------------------------------------------------------
  // Each entry pins `childAnchor` (in child local space) to `parentAnchor`.
  const link = (parent, child, pa, ca) => {
    const c = new CANNON.PointToPointConstraint(
      bones[parent], pa, bones[child], ca, 1e7
    );
    world.addConstraint(c);
    stiffen(c, 1e10, 2, dt);
    joints.push({ parent, child, pa, ca, c });
    return c;
  };

  const hp = 0.08; // pelvis half length
  link('pelvis', 'torso', V(0, hp, 0), V(0, -D.torsoLen / 2, 0));
  link('torso', 'head', V(0, D.torsoLen / 2, 0), V(0, -(D.headR + 0.03), 0));

  for (const side of ['L', 'R']) {
    const s = side === 'L' ? -1 : 1;
    link('torso', 'upperArm' + side,
      V(0, D.torsoLen / 2 - 0.08, s * D.shoulderZ), V(0, D.upperArm / 2, 0));
    link('upperArm' + side, 'foreArm' + side,
      V(0, -D.upperArm / 2, 0), V(0, D.foreArm / 2, 0));

    link('pelvis', 'thigh' + side,
      V(0, -hp - 0.01, s * D.hipZ), V(0, D.thigh / 2, 0));
    link('thigh' + side, 'shin' + side,
      V(0, -D.thigh / 2, 0), V(0, D.shin / 2, 0));
    link('shin' + side, 'foot' + side,
      V(0, -D.shin / 2, 0), V(-D.footLen * 0.18, D.ankleDrop, 0));
  }

  // Give every bone the ragdoll's initial heading.
  for (const b of Object.values(bones)) b.quaternion.copy(qYaw);

  const order = Object.keys(bones);
  return { bones, joints, order };
}

/**
 * Visual description of each bone, for the renderer. Kept here so the drawing
 * can never drift from the physics: these are the same numbers the collision
 * shapes are built from.
 */
export function bodySpecs() {
  const D = DIM;
  const cap = (len, radius) => ({ shape: 'capsuleY', len, radius });
  const specs = {
    pelvis: cap(0.16, RAD.pelvis),
    torso: cap(D.torsoLen, RAD.torso),
    head: { shape: 'sphere', radius: D.headR },
  };
  for (const side of ['L', 'R']) {
    specs['upperArm' + side] = cap(D.upperArm, RAD.upperArm);
    specs['foreArm' + side] = cap(D.foreArm, RAD.foreArm);
    specs['thigh' + side] = cap(D.thigh, RAD.thigh);
    specs['shin' + side] = cap(D.shin, RAD.shin);
    specs['foot' + side] = {
      shape: 'capsuleX',
      len: D.footLen * 0.84,
      radius: D.footR,
      offset: [0, -D.footDrop, 0],
    };
  }
  return specs;
}

/** Anchor pairs used by the length audit -- the joints that must never stretch. */
export function segmentSpecs() {
  const D = DIM;
  const hp = 0.08;
  const specs = [];
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? -1 : 1;
    specs.push({ name: 'thigh' + side, a: ['pelvis', V(0, -hp - 0.01, s * D.hipZ)], b: ['thigh' + side, V(0, D.thigh / 2, 0)] });
    specs.push({ name: 'knee' + side, a: ['thigh' + side, V(0, -D.thigh / 2, 0)], b: ['shin' + side, V(0, D.shin / 2, 0)] });
    specs.push({ name: 'ankle' + side, a: ['shin' + side, V(0, -D.shin / 2, 0)], b: ['foot' + side, V(-D.footLen * 0.18, D.ankleDrop, 0)] });
    specs.push({ name: 'elbow' + side, a: ['upperArm' + side, V(0, -D.upperArm / 2, 0)], b: ['foreArm' + side, V(0, D.foreArm / 2, 0)] });
  }
  specs.push({ name: 'spine', a: ['pelvis', V(0, hp, 0)], b: ['torso', V(0, -D.torsoLen / 2, 0)] });
  return specs;
}
