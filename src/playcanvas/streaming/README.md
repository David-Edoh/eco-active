# World streaming

ChunkStreamer fetches 64 m placement chunks near the player with at most two
requests in flight. It groups repeated geometry by model/material, creates GPU
instance buffers, assigns transformed bounds, and evicts distant chunks with
hysteresis. Destruction aborts requests and rejects late creation. Shared source
models/textures remain in the session library; per-chunk entities and buffers are
released. See docs/architecture.md for distance budgets and ownership.
