# World streaming

Implement chunk loading, activation, and unloading here. The session bootstrap
owns streaming lifecycle. Streaming creates/removes Miniplex entities and manages
associated PlayCanvas resources. Unloading must release entities, physics bodies,
scene objects, subscriptions, and unreferenced assets; cancel pending loads during
teardown. No streaming runtime is implemented yet.
