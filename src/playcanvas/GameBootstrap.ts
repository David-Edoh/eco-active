import {
  Application,
  Entity,
  Color,
  FILLMODE_NONE,
  RESOLUTION_AUTO,
  FOG_LINEAR,
  TONEMAP_ACES,
  CameraFrame,
  SHADOW_PCF3_32F,
} from "playcanvas";
import { createGameWorld } from "./ecs/createGameWorld";
import { AssetLibrary, PLAYER_CHARACTER_MODEL } from "./utils/assetLoader";
import { InputController } from "./controllers/InputController";
import { NetworkController } from "./controllers/NetworkController";
import { ChunkStreamer } from "./streaming/ChunkStreamer";
import { PlayerMovement } from "./scripts/PlayerMovement";
import { CameraFollow } from "./scripts/CameraFollow";
import { CharacterAnimator } from "./systems/CharacterAnimator";
import { ResolutionController } from "./systems/ResolutionController";
import { TrafficSystem } from "./systems/TrafficSystem";
import { PedestrianSystem } from "./systems/PedestrianSystem";
import {
  DISTRICT_VIEW_DISTANCE,
  DISTRICT_FOG_START,
  DISTRICT_FOG_END,
} from "./world/viewSettings";
import { createGround } from "./world/createGround";
import { createLandmark } from "./world/createLandmark";
import type { GameEntity } from "./ecs/components";
import type { District, GameCallbacks, Quality } from "./types";

export class GameBootstrap {
  private app: Application;
  private library: AssetLibrary;
  private world = createGameWorld();
  readonly input: InputController;
  private network?: NetworkController;
  private streamer?: ChunkStreamer;
  private movement?: PlayerMovement;
  private camera?: CameraFollow;
  private cameraFrame?: CameraFrame;
  private animator?: CharacterAnimator;
  private player?: GameEntity;
  private resolution: ResolutionController;
  private resize: ResizeObserver;
  private traffic?: TrafficSystem;
  private pedestrians?: PedestrianSystem;
  private landmark?: ReturnType<typeof createLandmark>;
  private sun?: Entity;
  private ground?: ReturnType<typeof createGround>;
  private remotes = new Map<
    string,
    { entity: GameEntity; animator: CharacterAnimator }
  >();
  private disposed = false;
  private ready = false;
  private active = false;
  private statsElapsed = 0;
  private frames: number[] = [];
  private abort = new AbortController();
  constructor(
    private canvas: HTMLCanvasElement,
    private callbacks: GameCallbacks,
    private pause: () => void,
  ) {
    this.app = new Application(canvas, {
      graphicsDeviceOptions: {
        alpha: false,
        antialias: true,
        powerPreference: "high-performance",
        preserveDrawingBuffer: false,
      },
    });
    this.app.setCanvasFillMode(FILLMODE_NONE);
    this.app.setCanvasResolution(RESOLUTION_AUTO);
    // Sunny coastal daylight: cool, readable shadows beneath warm direct light.
    this.app.scene.ambientLight = new Color(0.46, 0.53, 0.64);
    this.app.scene.exposure = 1.05;
    this.app.scene.fog.type = FOG_LINEAR;
    this.app.scene.fog.color = new Color(0.58, 0.71, 0.84);
    this.app.scene.fog.start = DISTRICT_FOG_START;
    this.app.scene.fog.end = DISTRICT_FOG_END;
    this.library = new AssetLibrary(this.app);
    this.input = new InputController(canvas, pause);
    this.resolution = new ResolutionController(this.app, canvas);
    this.resize = new ResizeObserver(() => this.resolution.resize());
    this.resize.observe(canvas);
    this.app.on("update", this.update, this);
    this.app.start();
  }
  async init() {
    try {
      this.callbacks.onProgress("Locating Lagos Island", 0.05);
      const response = await fetch("/assets/world/district.json", {
        signal: this.abort.signal,
      });
      if (!response.ok) throw Error("District map unavailable");
      const district = (await response.json()) as District;
      await this.library.init(this.callbacks.onProgress);
      if (this.disposed) return;
      this.callbacks.onProgress("Opening Tinubu Square", 0.72);
      const sun = new Entity("Lagos afternoon sun");
      this.sun = sun;
      sun.addComponent("light", {
        type: "directional",
        color: new Color(1, 0.97, 0.91),
        intensity: 1.7,
        castShadows: true,
        shadowDistance: 48,
        shadowResolution: matchMedia("(pointer:coarse)").matches ? 512 : 1024,
        shadowBias: 0.2,
        normalOffsetBias: 0.08,
        shadowType: SHADOW_PCF3_32F,
        numCascades: 1,
      });
      sun.setEulerAngles(48, -32, 0);
      this.app.root.addChild(sun);
      const camera = new Entity("Third-person camera");
      camera.addComponent("camera", {
        clearColor: new Color(0.58, 0.71, 0.84),
        fov: 60,
        nearClip: 0.1,
        farClip: DISTRICT_VIEW_DISTANCE,
        toneMapping: TONEMAP_ACES,
      });
      this.app.root.addChild(camera);
      // Grade the rendered world, leaving the React HUD's colours unchanged.
      // One HDR compose pass; no bloom, depth blur, SSAO or temporal history.
      const frame = new CameraFrame(this.app, camera.camera!);
      this.cameraFrame = frame;
      // Preserve the canvas's existing MSAA when rendering into the HDR target.
      frame.rendering.samples = this.app.graphicsDevice.samples;
      frame.rendering.toneMapping = TONEMAP_ACES;
      frame.grading.enabled = true;
      frame.grading.contrast = 1.025;
      frame.grading.saturation = 1.08;
      frame.grading.tint = new Color(1, 1, 0.995);
      frame.vignette.intensity = 0.12;
      frame.vignette.inner = 0.65;
      frame.update();
      this.movement = new PlayerMovement(district);
      this.camera = new CameraFollow(camera, this.movement);
      this.streamer = new ChunkStreamer(
        this.app,
        this.library,
        district,
        this.world,
      );
      this.ground = createGround(this.app, this.library, district.bounds);
      this.landmark = createLandmark(this.app, this.library, district);
      const model = this.library.instantiate(PLAYER_CHARACTER_MODEL);
      this.app.root.addChild(model);
      this.player = this.world.add({
        id: "local-player",
        player: true,
        position: { x: district.spawn[0], y: 0.16, z: district.spawn[1] },
        yaw: 180,
        moving: false,
        render: model,
      });
      this.animator = new CharacterAnimator(
        model,
        this.library.getAnimations(PLAYER_CHARACTER_MODEL),
      );
      this.traffic = new TrafficSystem(
        this.app,
        this.library,
        this.world,
        district,
      );
      this.pedestrians = new PedestrianSystem(
        this.app,
        this.library,
        this.world,
        this.movement,
        district,
      );
      if (
        typeof window !== "undefined" &&
        new URLSearchParams(location.search).has("diagnostics")
      ) {
        (window as unknown as { __pcApp?: Application }).__pcApp = this.app;
      }
      await this.streamer.warm(
        this.player.position!.x,
        this.player.position!.z,
      );
      if (this.disposed) return;
      this.network = new NetworkController();
      this.ready = true;
      this.callbacks.onProgress("Ready to explore", 1);
      this.callbacks.onReady();
    } catch (error) {
      if (!this.disposed)
        this.callbacks.onError(
          error instanceof Error ? error.message : "The game could not start.",
        );
    }
  }
  setActive(active: boolean) {
    this.active = active;
    if (!active) this.input.clear();
  }
  setQuality(quality: Quality) {
    this.resolution.setQuality(quality);
    if (this.sun?.light) this.sun.light.castShadows = quality !== "low";
    if (this.streamer) this.streamer.radius = quality === "low" ? 85 : 110;
  }
  private update(dt: number) {
    if (!this.ready || this.disposed || !this.player || !this.camera) return;
    dt = Math.min(dt, 0.05);
    const p = this.player.position!;
    if (this.active)
      this.movement!.update(this.player, this.input, this.camera.yaw, dt);
    else this.player.moving = false;
    this.player.render!.setPosition(p.x, p.y, p.z);
    this.player.render!.setEulerAngles(0, this.player.yaw ?? 0, 0);
    this.animator!.update(
      dt,
      !!this.player.moving,
      this.input.running,
      p.y > 0.18,
    );
    this.camera.update(dt, p.x, p.y, p.z, this.input.lookX, this.input.lookY);
    this.input.lookX = 0;
    this.input.lookY = 0;
    this.streamer!.update(dt, p.x, p.z);
    this.traffic!.update(dt, p.x, p.z);
    this.pedestrians!.update(dt, p.x, p.z);
    this.resolution.update(this.app.stats.frame.dt || dt);
    this.network!.update(dt, {
      x: p.x,
      y: p.y,
      z: p.z,
      yaw: this.player.yaw ?? 0,
      moving: !!this.player.moving,
    });
    const peers = this.network!.peers;
    for (const [id, remote] of this.remotes)
      if (!peers.some((peer) => peer.id === id)) {
        remote.entity.render!.destroy();
        this.world.remove(remote.entity);
        this.remotes.delete(id);
      }
    for (const peer of peers) {
      let remote = this.remotes.get(peer.id);
      if (!remote) {
        const render = this.library.instantiate(PLAYER_CHARACTER_MODEL);
        this.app.root.addChild(render);
        const entity = this.world.add({
          id: peer.id,
          remote: true,
          player: true,
          render,
          position: { x: peer.x, y: peer.y, z: peer.z },
        });
        remote = {
          entity,
          animator: new CharacterAnimator(
            render,
            this.library.getAnimations(PLAYER_CHARACTER_MODEL),
          ),
        };
        this.remotes.set(peer.id, remote);
      }
      const pos = remote.entity.position!,
        a = 1 - Math.exp(-14 * dt);
      pos.x += (peer.x - pos.x) * a;
      pos.y += (peer.y - pos.y) * a;
      pos.z += (peer.z - pos.z) * a;
      remote.entity.render!.setPosition(pos.x, pos.y, pos.z);
      remote.entity.render!.setEulerAngles(0, peer.yaw, 0);
      remote.entity.render!.enabled =
        Math.hypot(p.x - pos.x, p.z - pos.z) < 110;
      remote.animator.update(dt, peer.moving, false, peer.y > 0.18);
    }
    this.statsElapsed += dt;
    this.frames.push(this.app.stats.frame.ms || dt * 1000);
    if (this.frames.length > 120) this.frames.shift();
    if (this.statsElapsed > 0.5) {
      this.statsElapsed = 0;
      const ms = this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
      const stats = {
        fps: Math.round(1000 / Math.max(1, ms)),
        frameMs: +ms.toFixed(1),
        drawCalls: this.app.stats.drawCalls.total,
        shadowCalls: this.app.stats.drawCalls.shadow,
        forwardCalls: this.app.stats.drawCalls.forward,
        triangles: this.app.stats.frame.primitives,
        chunks: this.streamer!.count,
        entities: this.world.size,
        resolution: +this.resolution.scale.toFixed(2),
        players: peers.length + 1,
        network: this.network!.status,
        x: p.x,
        z: p.z,
        heading: this.camera.yaw,
      };
      this.callbacks.onStats(stats);
      // Opt-in, read-only telemetry for repeatable browser performance tests.
      if (new URLSearchParams(location.search).has("diagnostics")) {
        this.canvas.dataset.telemetry = JSON.stringify(stats);
        this.canvas.dataset.peers = JSON.stringify(
          [...this.remotes.values()].map((r) => ({
            id: r.entity.id,
            ...r.entity.position,
          })),
        );
        this.canvas.dataset.chunks = JSON.stringify(this.streamer!.ids);
        this.canvas.dataset.traffic = JSON.stringify(
          [...this.world]
            .filter((entity) => entity.traffic)
            .map((entity) => ({
              id: entity.id,
              model: entity.vehicleModel,
              ...entity.position,
              yaw: entity.yaw,
              waypoint: entity.navigation?.waypoint,
            })),
        );
        this.canvas.dataset.parked = JSON.stringify(
          [...this.world]
            .filter((entity) => entity.parked)
            .map((entity) => ({
              id: entity.id,
              model: entity.vehicleModel,
              ...entity.position,
              yaw: entity.yaw,
              chunkId: entity.chunkId,
            })),
        );
        this.canvas.dataset.anim = this.animator?.state ?? "none";
      }
    }
  }
  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    this.abort.abort();
    this.app.off("update", this.update, this);
    this.resize.disconnect();
    this.input.destroy();
    this.network?.destroy();
    this.traffic?.destroy();
    this.pedestrians?.destroy();
    this.streamer?.destroy();
    this.landmark?.destroy();
    this.ground?.destroy();
    for (const remote of this.remotes.values()) remote.entity.render?.destroy();
    this.remotes.clear();
    this.player?.render?.destroy();
    this.cameraFrame?.destroy();
    this.library.destroy();
    this.app.destroy();
    if (
      typeof window !== "undefined" &&
      (window as unknown as { __pcApp?: Application }).__pcApp === this.app
    ) {
      delete (window as unknown as { __pcApp?: Application }).__pcApp;
    }
  }
}
