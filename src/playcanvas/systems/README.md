# Systems

CharacterAnimator poses the imported rig. TrafficSystem updates nearby cars each
frame and distant cars at 5 Hz, drawing visible traffic with instancing.
trafficRoutes builds closed walks through connected road segments with lane offsets
and rounded junction/dead-end turns. ECS navigation progress consumes waypoint
overshoot without resetting position. Vehicles retain state outside rendering range.
PedestrianSystem creates/simulates characters only within 45 m.
ResolutionController adjusts render scale from measured frame time.
GameBootstrap schedules these systems outside React. ECS entities own gameplay
positions; render transforms are projections. The current kinematic movement is
not a rigid-body physics simulation. See docs/architecture.md for limits.
