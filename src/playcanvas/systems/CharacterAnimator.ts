import { Entity, Asset, AnimStateGraph, AnimTrack } from "playcanvas";

export class CharacterAnimator {
  private activeState: "Idle" | "Walk" | "Run" | "Jump" = "Idle";
  private root: Entity;

  constructor(root: Entity, animAssets?: Asset[]) {
    this.root = root;
    if (animAssets && animAssets.length > 0) {
      this.setupAnimComponent(animAssets);
    }
  }

  private setupAnimComponent(animAssets: Asset[]) {
    if (!this.root.anim) {
      this.root.addComponent("anim", { activate: true });
    }

    const graphData = {
      layers: [
        {
          name: "Base",
          states: [
            { name: "START", speed: 1 },
            { name: "Idle", speed: 1, loop: true, defaultState: true },
            { name: "Walk", speed: 1, loop: true },
            { name: "Run", speed: 1.05, loop: true },
            { name: "Jump", speed: 1, loop: false },
          ],
          // Runtime movement owns transitions. Unconditional locomotion edges
          // auto-fire every frame, overriding explicit transition() calls.
          transitions: [{ from: "START", to: "Idle" }],
        },
      ],
      parameters: {},
    };

    this.root.anim!.loadStateGraph(new AnimStateGraph(graphData));

    for (const asset of animAssets) {
      const track = asset.resource as AnimTrack | undefined;
      if (track?.name) {
        this.root.anim!.assignAnimation(track.name, track);
      }
    }
  }

  get state(): "Idle" | "Walk" | "Run" | "Jump" {
    return this.activeState;
  }

  update(dt: number, moving: boolean, running = false, jumping = false) {
    if (this.root.anim?.baseLayer) {
      let target: "Idle" | "Walk" | "Run" | "Jump" = "Idle";
      if (jumping) {
        target = "Jump";
      } else if (moving) {
        target = running ? "Run" : "Walk";
      } else {
        target = "Idle";
      }

      if (target !== this.activeState) {
        this.activeState = target;
        const blendTime = target === "Idle" ? 0.2 : 0.15;
        this.root.anim.baseLayer.transition(target, blendTime);
      }
    }
  }
}
