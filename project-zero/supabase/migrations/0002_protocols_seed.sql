-- PROJECT ZERO — protocol catalogue (reference data, V0.1)
-- Kept in sync with src/lib/domain/protocols.ts.
-- Re-runnable: upserts on slug.

insert into public.test_protocols
  (id, slug, name, description, category, position_relevance, instructions, equipment,
   attempts, rest_seconds, unit, measurement_type, improvement_direction,
   default_reliability, protocol_version, active)
values
  ('b1a1f6d0-0000-4000-8000-000000000001', 'juggling', 'Juggling',
   'Maximum number of consecutive touches without the ball hitting the ground.',
   'TECHNICAL',
   '{"GK":"LOW","CB":"LOW","RB":"LOW","LB":"LOW","RWB":"LOW","LWB":"LOW","DM":"MEDIUM","CM":"MEDIUM","AM":"MEDIUM","RW":"MEDIUM","LW":"MEDIUM","ST":"MEDIUM"}',
   '["Flat surface, properly inflated match ball.","Start with the ball in hand, drop it and begin.","Any body part except the hands and arms is allowed.","The attempt ends when the ball touches the ground.","3 attempts, 60 s rest between attempts. Best attempt is kept."]',
   '["1 ball"]', 3, 60, 'touches', 'OBJECTIVE', 'HIGHER_IS_BETTER', 'HIGH', 1, true),

  ('b1a1f6d0-0000-4000-8000-000000000002', 'slalom-ball-control', 'Slalom Ball Control',
   'Standard 6-cone slalom with the ball, timed. Touched or skipped cones add a time penalty.',
   'TECHNICAL',
   '{"GK":"NONE","CB":"LOW","RB":"MEDIUM","LB":"MEDIUM","RWB":"HIGH","LWB":"HIGH","DM":"MEDIUM","CM":"MEDIUM","AM":"HIGH","RW":"HIGH","LW":"HIGH","ST":"MEDIUM"}',
   '["6 cones in a straight line, 2 m apart (10 m from first to last cone).","Start line 2 m before the first cone, finish line 2 m after the last cone: 14 m total.","Start on your own signal, ball at the start line, timer starts on first touch.","Slalom through every cone with the ball, then dribble across the finish line.","Timer stops when the ball crosses the finish line.","Penalty: +0.5 s per cone touched or skipped (configurable).","3 attempts, 90 s rest. Best corrected time is kept."]',
   '["6 cones","1 ball","Phone video or stopwatch"]', 3, 90, 's', 'OBJECTIVE', 'LOWER_IS_BETTER', 'MEDIUM', 1, true),

  ('b1a1f6d0-0000-4000-8000-000000000003', 'passing-accuracy-strong-foot', 'Passing Accuracy — Strong Foot',
   '20 passes with the strong foot onto a standardised target.',
   'TECHNICAL',
   '{"GK":"MEDIUM","CB":"HIGH","RB":"HIGH","LB":"HIGH","RWB":"HIGH","LWB":"HIGH","DM":"HIGH","CM":"HIGH","AM":"HIGH","RW":"MEDIUM","LW":"MEDIUM","ST":"MEDIUM"}',
   '["Target: 1 m wide gate made of 2 cones, placed 15 m away.","Ball starts stationary, one preparation touch allowed.","20 passes with the strong foot, ground passes only.","A pass counts if the ball goes through the gate without touching a cone.","Record the number of successful passes out of 20."]',
   '["4 cones","1 ball","Tape measure or 15 counted steps"]', 1, 0, '/20', 'OBJECTIVE', 'HIGHER_IS_BETTER', 'HIGH', 1, true),

  ('b1a1f6d0-0000-4000-8000-000000000004', 'passing-accuracy-weak-foot', 'Passing Accuracy — Weak Foot',
   'Same protocol as the strong foot test, played with the weak foot.',
   'TECHNICAL',
   '{"GK":"MEDIUM","CB":"MEDIUM","RB":"MEDIUM","LB":"MEDIUM","RWB":"MEDIUM","LWB":"MEDIUM","DM":"HIGH","CM":"HIGH","AM":"MEDIUM","RW":"MEDIUM","LW":"MEDIUM","ST":"MEDIUM"}',
   '["Identical setup to the strong foot test: 1 m gate at 15 m.","20 passes with the weak foot only, ground passes.","A pass counts if the ball goes through the gate without touching a cone.","Record the number of successful passes out of 20."]',
   '["4 cones","1 ball"]', 1, 0, '/20', 'OBJECTIVE', 'HIGHER_IS_BETTER', 'HIGH', 1, true),

  ('b1a1f6d0-0000-4000-8000-000000000005', 'crossing-accuracy', 'Crossing Accuracy',
   '12 crosses scored 0/1/2 across three target zones. Designed for full-backs and wingers.',
   'POSITIONAL',
   '{"GK":"NONE","CB":"NONE","RB":"HIGH","LB":"HIGH","RWB":"HIGH","LWB":"HIGH","DM":"LOW","CM":"MEDIUM","AM":"MEDIUM","RW":"HIGH","LW":"HIGH","ST":"LOW"}',
   '["Crossing spot: on the flank, level with the edge of the box.","Mark three target zones in the box: near post, central, far post (each ~4 m wide).","12 crosses: 4 near post, 4 central, 4 far post, in that order.","Score each cross: 0 = missed, 1 = acceptable zone, 2 = precise target.","Ball delivered from a stationary or rolling start, same for every session.","Maximum score: 24. Zone scores are stored separately."]',
   '["12 balls (or a retriever)","6 cones to mark the zones"]', 1, 0, '/24', 'SEMI_OBJECTIVE', 'HIGHER_IS_BETTER', 'MEDIUM', 1, true),

  ('b1a1f6d0-0000-4000-8000-000000000006', 'finishing-accuracy', 'Finishing Accuracy',
   '20 strikes from the edge of the box. Goals, shots on target and misses are stored.',
   'TECHNICAL',
   '{"GK":"NONE","CB":"LOW","RB":"LOW","LB":"LOW","RWB":"LOW","LWB":"LOW","DM":"LOW","CM":"MEDIUM","AM":"HIGH","RW":"HIGH","LW":"HIGH","ST":"HIGH"}',
   '["20 strikes from the edge of the box, one preparation touch allowed.","Same sequence every session: 10 strong foot, 10 weak foot.","Goal = ball inside the goal frame. On target = on frame but saved.","Miss = off frame.","goals + shots_on_target + misses must equal 20."]',
   '["20 balls (or a retriever)","1 goal"]', 1, 0, 'goals /20', 'OBJECTIVE', 'HIGHER_IS_BETTER', 'HIGH', 1, true),

  ('b1a1f6d0-0000-4000-8000-000000000007', 'sprint-10m', 'Sprint 10 m',
   'Standing-start 10 m sprint, timed manually from video or stopwatch.',
   'PHYSICAL',
   '{"GK":"MEDIUM","CB":"MEDIUM","RB":"HIGH","LB":"HIGH","RWB":"HIGH","LWB":"HIGH","DM":"MEDIUM","CM":"MEDIUM","AM":"HIGH","RW":"HIGH","LW":"HIGH","ST":"HIGH"}',
   '["Mark start and finish with cones, 10 m apart.","Standing start, front foot on the line, no rocking step.","Film side-on at the highest frame rate your phone allows, or use a stopwatch.","3 attempts, 3 min rest. Best and mean times are both kept.","Always warm up the same way — cold sprints are not comparable."]',
   '["2 cones","Phone video or stopwatch"]', 3, 180, 's', 'OBJECTIVE', 'LOWER_IS_BETTER', 'MEDIUM', 1, true),

  ('b1a1f6d0-0000-4000-8000-000000000008', 'sprint-20m', 'Sprint 20 m',
   'Standing-start 20 m sprint, timed manually from video or stopwatch.',
   'PHYSICAL',
   '{"GK":"MEDIUM","CB":"MEDIUM","RB":"HIGH","LB":"HIGH","RWB":"HIGH","LWB":"HIGH","DM":"MEDIUM","CM":"MEDIUM","AM":"HIGH","RW":"HIGH","LW":"HIGH","ST":"HIGH"}',
   '["Mark start and finish with cones, 20 m apart.","Standing start, front foot on the line, no rocking step.","Film side-on at the highest frame rate your phone allows, or use a stopwatch.","3 attempts, 3 min rest. Best and mean times are both kept."]',
   '["2 cones","Phone video or stopwatch"]', 3, 180, 's', 'OBJECTIVE', 'LOWER_IS_BETTER', 'MEDIUM', 1, true),

  ('b1a1f6d0-0000-4000-8000-000000000009', 'sprint-30m', 'Sprint 30 m',
   'Standing-start 30 m sprint, timed manually from video or stopwatch.',
   'PHYSICAL',
   '{"GK":"LOW","CB":"MEDIUM","RB":"HIGH","LB":"HIGH","RWB":"HIGH","LWB":"HIGH","DM":"MEDIUM","CM":"MEDIUM","AM":"MEDIUM","RW":"HIGH","LW":"HIGH","ST":"HIGH"}',
   '["Mark start and finish with cones, 30 m apart.","Standing start, front foot on the line, no rocking step.","Film side-on at the highest frame rate your phone allows, or use a stopwatch.","3 attempts, 4 min rest. Best and mean times are both kept."]',
   '["2 cones","Phone video or stopwatch"]', 3, 240, 's', 'OBJECTIVE', 'LOWER_IS_BETTER', 'MEDIUM', 1, true),

  ('b1a1f6d0-0000-4000-8000-000000000010', 'timed-run', 'Timed Run',
   'Generic endurance protocol: run a standardised distance as fast as possible. Pace is derived.',
   'PHYSICAL',
   '{"GK":"LOW","CB":"MEDIUM","RB":"HIGH","LB":"HIGH","RWB":"HIGH","LWB":"HIGH","DM":"HIGH","CM":"HIGH","AM":"MEDIUM","RW":"MEDIUM","LW":"MEDIUM","ST":"MEDIUM"}',
   '["Pick a standardised distance and keep it identical across sessions.","Flat course, same route every time (track preferred).","Same warm-up, ideally similar weather and time of day.","Record total time. Pace per kilometre is computed automatically.","Results are only comparable within the same distance."]',
   '["Measured course or track","Stopwatch or phone"]', 1, 0, 's', 'OBJECTIVE', 'LOWER_IS_BETTER', 'MEDIUM', 1, true)

on conflict (slug) do update set
  name                  = excluded.name,
  description           = excluded.description,
  category              = excluded.category,
  position_relevance    = excluded.position_relevance,
  instructions          = excluded.instructions,
  equipment             = excluded.equipment,
  attempts              = excluded.attempts,
  rest_seconds          = excluded.rest_seconds,
  unit                  = excluded.unit,
  measurement_type      = excluded.measurement_type,
  improvement_direction = excluded.improvement_direction,
  default_reliability   = excluded.default_reliability,
  protocol_version      = excluded.protocol_version,
  active                = excluded.active;
