# Game systems

Implement movement, AI, physics synchronization, and rendering synchronization
here as they are introduced. Systems operate on the session's Miniplex world
and are scheduled by GameBootstrap. No React or Zustand imports are allowed.
PlayCanvas owns scene objects and physical simulation; Miniplex owns gameplay
components. Define explicit synchronization ownership to avoid competing writes.
No systems are implemented yet.
