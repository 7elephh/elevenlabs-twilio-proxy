# Ragdoll free kick

A low-poly, Toribash-flavoured ragdoll runs up at ~37°, plants, and curls a
free kick over a wall into the top corner. Rendered to `out/ragdoll-freekick.mp4`.

```
npm install
node src/proto2d.js      # stage 1: physics prototype, prints a PASS/FAIL report
node build.js            # simulate -> capture -> encode
```

Output: **1920×806, 5.50 s, 60 fps, H.264** — `out/ragdoll-freekick.mp4`.

## What the simulation actually produces

Measured from the production run, not authored:

| | |
|---|---|
| contact | t = 1.725 s, **39 mm below the ball's centre** |
| boot at contact | 12.7 m/s (body centre; the contact patch is faster) |
| ball launch | **20.1 m/s at 18.7°**, 77 rad/s of spin |
| over the wall | **2.28 m** at x = 9.15 m |
| goal line (x = 18.3 m) | **y = 1.98 m, z = 1.85 m — goal**, upper corner |
| worst joint separation | **3.77 mm**, at the impact spike |

## Pipeline

1. **`src/proto2d.js`** — stage 1 prototype. A single leg on hinge constraints,
   actuated only by PD torques, striking a ball. It exists to prove four things
   before any 3D work: segment lengths hold, the actuation reaches a real swing
   speed, the narrowphase finds the contact, and the Magnus force bends a
   flight. Run it; it prints PASS/FAIL per check.
2. **`src/skeleton.js`** — 15 rigid bodies wired with `PointToPointConstraint`s.
3. **`src/motion.js`** — the motion script: target joint angles over time. It
   moves nothing; it only says what the muscles are asked to do.
4. **`src/kick-sim.js`** — the world, the PD controllers, and the three-stage
   solver (scout → probe → search).
5. **`tools/solve-aim.js`, `tools/refine.js`** — search body aim, contact offset
   and undercut depth for a shot that clears the wall and finishes in the corner.
6. **`src/record.js`** — the production run, writing `out/kick.json`.
7. **`src/capture.js`** — Playwright drives `render/scene.html` frame by frame.
8. **`build.js`** — ties it together and calls ffmpeg.

## How the realism requirements are met

**Fixed segment lengths.** Every joint is a real constraint pinning an anchor
point on the child to one on the parent. Nothing in the simulation ever writes
a body position. `record()` audits, every step, the world distance between each
pinned pair; the worst case over the whole clip is 3.77 mm, at the moment of
impact. Getting there needed the constraint equations stiffened well past
cannon-es's defaults (`stiffen()` in `physics-utils.js`).

**A geometric contact point.** The ball is not placed by eye. A first pass runs
the whole kick with no ball at all and records where the boot's contact patch
is, and how fast, at every step; the ball is then placed exactly one
contact-distance from the real patch position, and the entire run-up is
translated so the ball lands on the world origin. The contact itself is found by
the collision narrowphase.

**Magnus.** `applyAerodynamics()` applies quadratic drag and
`F = ½ρ·C_l·A·r·(ω × v)` — a real force perpendicular to velocity, proportional
to spin. The curve is what integrating that produces; there is no authored path.
`proto2d.js` checks it independently: same launch, spin on and off.

## Where the model is an abstraction, and why

Worth being explicit about, since it is the difference between "a ragdoll that
kicks" and "a ragdoll that walks":

- **The pelvis is driven by a stiff force/torque harness along a scripted path.**
  A self-balancing biped controller is a research problem, not a step in a
  render pipeline. Everything hanging off the pelvis — both legs, both arms, the
  torso, the head — is fully dynamic, connected by constraints and moved only by
  torques. The strike, the impact and the flight are untouched by this.
- **Limbs are actuated by PD torques toward a scripted pose**, not by simulated
  muscles. The torques are bounded at physiological magnitudes and the limbs
  carry real inertia, so the swing lags, overshoots and whips as a real leg does
  — but the pose it aims at is authored.
- **Spin is computed from the impulse and the lever arm** rather than taken from
  the solver's friction. cannon-es resolves far too little shear across a ~2 ms
  boot/ball contact to spin a ball up the way an inside-foot brush does. The
  substitute is `ω = (r × J_t)/I` using the engine's own contact point and the
  engine's own measured impulse — a physical model, not a dialled-in number.
- **Limbs do not self-collide.** Overlapping capsules at the joints would
  generate enormous spurious contact forces. The boot still collides with the
  ball and the turf.

## One place the brief and the physics disagree

The brief asks for contact *above* the ball's centre to produce an "effet
lifté". Striking above the centre of a ball resting on the ground gives a
downward impulse and the ball never leaves the turf — that was measured, at a
0.3° launch angle. This kick strikes 39 mm *below* the centre, which is what
gets it airborne at 18.7°, and takes the curl from the lateral offset of the
same contact. If "lifté" was meant as topspin, note the spin axis here is
predominantly vertical (curl) with a backspin component; a genuine topspin
dipper off the ground is a different, harder technique.

## Notes

- Physics runs at 480 Hz, states are recorded at 240 Hz, and the renderer
  interpolates. That is what makes the slow-motion section real resampling
  rather than duplicated frames.
- The time warp lives in `capture.js`: full speed through the run-up, 0.20×
  from sim t≈1.51 to 1.94 (contact at 1.725), then back to full speed for the
  flight.
- `tools/preview.js <t> <t> ...` renders single moments so framing can be
  judged without a full build.
- Playwright is pointed at this environment's pre-installed Chromium because
  the bundled revision does not match.
