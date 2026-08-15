/**
 * Shared physics helpers: hinge-angle measurement, PD joint actuation,
 * aerodynamics (drag + Magnus).
 *
 * Everything here works on real cannon-es bodies/constraints. Nothing in the
 * pipeline ever writes a body position directly during the simulation: limbs
 * are moved exclusively by torques/forces, and their geometry is held together
 * by constraints, which is what guarantees fixed segment lengths.
 */
import * as CANNON from 'cannon-es';

export const V = (x = 0, y = 0, z = 0) => new CANNON.Vec3(x, y, z);

/** Rotate a local vector into world space by a body's orientation. */
export function toWorldDir(body, localVec, out = new CANNON.Vec3()) {
  body.quaternion.vmult(localVec, out);
  return out;
}

/**
 * Raise the SPOOK stiffness of a constraint's equations so joints do not
 * visibly separate under the large torques of a kick. This is what keeps
 * segment lengths fixed: the solver, not authored positions.
 */
export function stiffen(constraint, stiffness = 1e9, relaxation = 2, dt = 1 / 480) {
  for (const eq of constraint.equations) {
    eq.setSpookParams(stiffness, relaxation, dt);
  }
  return constraint;
}

/**
 * Signed angle of a hinge, measured between two reference vectors that are
 * fixed in each body and perpendicular to the hinge axis.
 * Returns radians in (-pi, pi].
 */
export function hingeAngle(bodyA, bodyB, axisLocalA, refLocalA, refLocalB) {
  const axis = toWorldDir(bodyA, axisLocalA).unit();
  const a = toWorldDir(bodyA, refLocalA);
  const b = toWorldDir(bodyB, refLocalB);

  // Project both refs onto the plane perpendicular to the axis.
  const pa = a.vsub(axis.scale(a.dot(axis)));
  const pb = b.vsub(axis.scale(b.dot(axis)));
  const na = pa.length();
  const nb = pb.length();
  if (na < 1e-9 || nb < 1e-9) return 0;
  pa.scale(1 / na, pa);
  pb.scale(1 / nb, pb);

  const cos = Math.max(-1, Math.min(1, pa.dot(pb)));
  const cross = new CANNON.Vec3();
  pa.cross(pb, cross);
  const sin = cross.dot(axis);
  return Math.atan2(sin, cos);
}

/**
 * Velocity-motor PD on a cannon-es HingeConstraint.
 * cannon's hinge motor is a *velocity* motor, so position control is done by
 * feeding it a velocity proportional to the angular error (P term) damped by
 * the measured relative angular velocity (D term).
 */
export function driveHinge(constraint, meta, targetAngle, gains) {
  const { bodyA, bodyB, axisLocalA, refLocalA, refLocalB } = meta;
  const angle = hingeAngle(bodyA, bodyB, axisLocalA, refLocalA, refLocalB);
  const axis = toWorldDir(bodyA, axisLocalA).unit();
  const relW = bodyB.angularVelocity.vsub(bodyA.angularVelocity).dot(axis);

  let err = targetAngle - angle;
  // wrap to (-pi, pi]
  while (err > Math.PI) err -= 2 * Math.PI;
  while (err < -Math.PI) err += 2 * Math.PI;

  const speed = gains.kp * err - gains.kd * relW;
  const max = gains.maxSpeed ?? 40;
  constraint.enableMotor();
  constraint.setMotorMaxForce(gains.maxForce);
  constraint.setMotorSpeed(Math.max(-max, Math.min(max, speed)));
  return angle;
}

/**
 * PD controller on the *relative orientation* of a child body with respect to
 * its parent. Produces a torque pair (equal and opposite), so it conserves
 * angular momentum like a real muscle acting across a joint.
 *
 * targetRelQuat: desired quaternion of child expressed in the parent frame.
 */
const _qp = new CANNON.Quaternion();
const _qerr = new CANNON.Quaternion();
const _tw = new CANNON.Vec3();
export function driveBallJoint(parent, child, targetRelQuat, gains) {
  // current relative rotation: q_rel = inverse(q_parent) * q_child
  parent.quaternion.conjugate(_qp);
  _qp.mult(child.quaternion, _qerr);

  // error rotation, expressed in parent frame: q_e = q_target * inverse(q_rel)
  const inv = new CANNON.Quaternion();
  _qerr.conjugate(inv);
  const qe = targetRelQuat.mult(inv);
  qe.normalize();

  // shortest path
  let { x, y, z, w } = qe;
  if (w < 0) { x = -x; y = -y; z = -z; w = -w; }
  const sin = Math.sqrt(x * x + y * y + z * z);
  let axisParent;
  let angle;
  if (sin < 1e-8) {
    axisParent = V(0, 0, 0);
    angle = 0;
  } else {
    angle = 2 * Math.atan2(sin, w);
    axisParent = V(x / sin, y / sin, z / sin);
  }

  // rotate error axis into world space
  parent.quaternion.vmult(axisParent, _tw);

  const relW = child.angularVelocity.vsub(parent.angularVelocity);
  const torque = _tw.scale(gains.kp * angle).vsub(relW.scale(gains.kd));

  // clamp
  const mag = torque.length();
  if (mag > gains.maxTorque) torque.scale(gains.maxTorque / mag, torque);

  child.torque.vadd(torque, child.torque);
  parent.torque.vsub(torque, parent.torque);
  return angle;
}

/**
 * World-space orientation PD ("muscle") on a single bone.
 *
 * torque = kp * axis*angle(q_target * q_current^-1) - kd * omega
 *
 * The bone is still bolted to its parent by a constraint, so the constraint
 * transmits the reaction: bones swing with real inertia, collide for real, and
 * can never change length. Only the *actuation* is authored, never a position.
 */
const _qc = new CANNON.Quaternion();
export function driveOrientation(body, qTarget, gains) {
  body.quaternion.conjugate(_qc);
  const qe = qTarget.mult(_qc);
  qe.normalize();

  let { x, y, z, w } = qe;
  if (w < 0) { x = -x; y = -y; z = -z; w = -w; }
  const sin = Math.sqrt(x * x + y * y + z * z);
  if (sin < 1e-9) {
    const t0 = body.angularVelocity.scale(-gains.kd);
    body.torque.vadd(t0, body.torque);
    return 0;
  }
  const angle = 2 * Math.atan2(sin, w);
  const axis = V(x / sin, y / sin, z / sin);

  const torque = axis.scale(gains.kp * angle).vsub(body.angularVelocity.scale(gains.kd));
  const mag = torque.length();
  if (mag > gains.maxTorque) torque.scale(gains.maxTorque / mag, torque);
  body.torque.vadd(torque, body.torque);
  return angle;
}

/**
 * PD "harness" that drives a body toward a target world position with forces
 * (not by writing the position). Used for the pelvis root, which stands in for
 * the balance/locomotion muscles we are not simulating.
 */
export function driveBodyToPoint(body, targetPos, targetVel, gains) {
  const err = targetPos.vsub(body.position);
  const dv = (targetVel ?? V()).vsub(body.velocity);
  const f = err.scale(gains.kp).vadd(dv.scale(gains.kd));
  const mag = f.length();
  if (mag > gains.maxForce) f.scale(gains.maxForce / mag, f);
  // NB: applyForce's second argument is relative to the centre of mass.
  // Omitting it applies a pure force with no parasitic torque.
  body.applyForce(f);
  return f;
}

/* ------------------------------------------------------------------ */
/* Aerodynamics                                                        */
/* ------------------------------------------------------------------ */

export const AIR = {
  rho: 1.225,      // kg/m^3
  Cd: 0.25,        // drag coefficient of a football at match speed
  Cl: 1.0,         // lift coefficient scale for the Magnus term
};

/**
 * Simplified Magnus + quadratic drag on a spinning sphere.
 *
 *   F_drag   = -0.5 * rho * Cd * A * |v| * v
 *   F_magnus =  0.5 * rho * Cl * A * r * (omega x v)
 *
 * The Magnus term is a real force perpendicular to velocity and proportional
 * to spin -- the curve emerges from integration, it is not an authored path.
 */
export function applyAerodynamics(body, radius) {
  const v = body.velocity;
  const speed = v.length();
  if (speed < 1e-4) return;

  const A = Math.PI * radius * radius;

  const drag = v.scale(-0.5 * AIR.rho * AIR.Cd * A * speed);

  const w = body.angularVelocity;
  const cross = new CANNON.Vec3();
  w.cross(v, cross);
  const magnus = cross.scale(0.5 * AIR.rho * AIR.Cl * A * radius);

  // Applied at the centre of mass: aerodynamic force must not spin the ball up.
  body.applyForce(drag.vadd(magnus));
}
