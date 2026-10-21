# Character animation

Runtime asset: `public/assets/models/character.glb`. This contains the supplied
muscular stylized man, its skin, and four baked animation tracks. Textures and
original notices remain in `public/assets/textures/` and `public/assets/licenses/`.
No source assets are duplicated into `src/assets/`.

Source paths relative to the user-provided Advanced Multiplayer Template:

- Model: `Models/Character/muscular stylized man/Rigged/muscular stylized man.fbx`
- Avatar reference: `ThirdParty/StarterAssets/ThirdPersonController/Character/Models/Armature.fbx`
  and its `.meta` humanoid skeleton calibration.
- Clips under `ThirdParty/StarterAssets/ThirdPersonController/Character/Animations/`:
  `Stand--Idle.anim.fbx`, `Locomotion--Walk_N.anim.fbx`,
  `Locomotion--Run_N.anim.fbx`, and `Jump--Jump.anim.fbx`.
- Unity's `StarterAssetsThirdPerson.controller` in that same folder demonstrates
  locomotion and jump state control. Unity Humanoid retargeting is not exported
  automatically by an FBX-to-glTF conversion; the converter must adapt the rigs.

The converter reconstructs the source reference pose from Unity importer metadata,
converts handedness/units, then samples each clip at 30 Hz, applying world rotation
deltas to the target rig and reconstructing target local rotations. Each clip
starts from the reference pose with an independent mixer; final frames use
non-looping sampling. Horizontal hip translation is removed; jump hip translation
is also removed because the gameplay controller already supplies the jump arc.
This is offline retargeting, not a full reimplementation of Unity Mecanim's muscle
limits, IK, foot locking, or its layered controller.

Rebuild without touching city assets:

```sh
node scripts/convert-assets.mjs '<Unity-template-directory>' --character-only
```

Validate against a running development server:

```sh
node scripts/test-animations.mjs
```

The focused browser test checks stable Idle/Walk/Run/Jump states, changing bone
rotations, finite transforms, and landing back in Idle. It captures close views
and hardware/viewport/quality/frame-time/draw-call telemetry in
`docs/performance/animation-results.json`. Chrome may use software rendering;
consult the recorded GPU before interpreting performance numbers.

## Active roster: Presido

The runtime now loads `character-ratel.glb`, `character-peter-obi.glb`,
`character-indaboski.glb`, and `character-bola-tinubu.glb`, with original Presido
albedo textures in `public/assets/textures/character-*.webp`. The legacy character
above remains only as the offline animation reference for
`node scripts/convert-presido-characters.mjs <presido-project>`.
Each target bone receives the source world-space animation delta relative to its
bind pose, reconstructed in its target parent space. Separate accessory skeletons
are retargeted independently and receive unique exported names. Grounding and
height normalization are applied to a shared model wrapper, preserving skin binds.
This retains the same limitations around IK and foot locking described above.

The supplied `Assets/EndlessRunner_Third-PartyNotice.txt` is preserved as
`public/assets/licenses/presido-third-party-notice.txt`. The four model/material
folders contain no separate character-specific license file. Source paths and
conversion outputs are recorded in `presido-characters.json`; no ownership or
additional distribution rights are inferred by the converter.

## Player-only Adebayo and NPC Jarvis

Current player asset: `public/assets/models/character-adebayo.glb`. NPC assets are
the four Presido models plus `character-jarvis.glb`; Adebayo is excluded from the
NPC roster. All use the four baked locomotion clips described above.

Rebuild the two Hide and Seek assets with:

```sh
node scripts/convert-presido-characters.mjs '<hide-and-seek-project>' --hide-and-seek
```

Both models come from `Assets/PLAYER TWO/Platformer Project/Examples/Models/`.
Albedo inputs are recorded in `public/assets/licenses/hide-and-seek-characters.json`.
Adebayo's `mixamorig4` bone prefix is stripped before name matching; 46 bones are
animated, while Jarvis uses 22. Original body/hair material groups are preserved;
the hair alpha uses cutout rendering. The FBX loader drops influences beyond four;
remaining weights are normalized. Identical vertices are indexed without mesh
decimation. Normals/specular/gloss maps are not used by this diffuse-focused runtime
material, and no complete Unity shader equivalence is claimed.

The source Platformer Project README is copied into public/assets/licenses.
No extra scripts, weapons or Unity prefab behavior are imported.
