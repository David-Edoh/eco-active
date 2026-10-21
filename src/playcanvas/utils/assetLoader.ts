import {
  Asset,
  EnvLighting,
  TEXTUREPROJECTION_EQUIRECT,
  Application,
  ContainerResource,
  StandardMaterial,
  Color,
  Texture,
  ADDRESS_REPEAT,
  FILTER_LINEAR_MIPMAP_LINEAR,
  CULLFACE_NONE,
} from "playcanvas";

export const PLAYER_CHARACTER_MODEL = "character-adebayo";

export const NPC_CHARACTER_MODELS = [
  "character-ratel",
  "character-peter-obi",
  "character-indaboski",
  "character-bola-tinubu",
  "character-jarvis",
] as const;

const TRANSPORT_MODELS = ["bus", "keke"];

const VENDOR_MODELS = [
  "vendor-pos-umbrella",
  "vendor-shop-1",
  "vendor-shop-2",
  "vendor-shop-3",
  "vendor-shop-4",
  "vendor-food-vendor",
];

const CHARACTER_MODELS = [...NPC_CHARACTER_MODELS, PLAYER_CHARACTER_MODEL];

interface BuildingPalette {
  wall: string;
  brick: string;
  trim: string;
  glass: string;
}

export class AssetLibrary {
  private assets: Asset[] = [];
  readonly containers = new Map<string, ContainerResource>();
  readonly materials = new Map<string, StandardMaterial>();
  private disposed = false;
  private sky?: Texture;
  private abort = new AbortController();
  private buildingProfiles: Record<
    string,
    { wall: string; brick: string; trim: string; glass: string }
  > = {};

  constructor(private app: Application) {}
  private load(url: string, type: string): Promise<Asset> {
    return new Promise((resolve, reject) => {
      const asset = new Asset(url, type, { url });
      this.assets.push(asset);
      this.app.assets.add(asset);
      asset.once("load", () => {
        if (this.disposed) {
          asset.unload();
          reject(new Error("Loading cancelled"));
        } else resolve(asset);
      });
      asset.once("error", (error: string) =>
        reject(new Error(`Could not load ${url}: ${error}`)),
      );
      this.app.assets.load(asset);
    });
  }
  async init(progress: (message: string, value: number) => void) {
    const catalogResponse = await fetch("/assets/world/building-catalog.json", {
      signal: this.abort.signal,
    });
    if (!catalogResponse.ok) throw new Error("Building catalog unavailable");
    const catalog = (await catalogResponse.json()) as {
      profiles: Record<string, BuildingPalette>;
    };
    if (this.disposed) throw new Error("Loading cancelled");
    this.buildingProfiles = catalog.profiles;
    const names = [
      "building-1",
      "building-2",
      "building-3",
      "building-low-1",
      "building-low-2",
      "building-low-3",
      "building-low-4",
      "tinubu-trinity",
      "tinubu-monument",
      "cbn-lagos",
      "street-slab",
      "sedan",
      "wagon",
      "sports",
      ...CHARACTER_MODELS,
      ...VENDOR_MODELS,
      ...TRANSPORT_MODELS,
      "fern",
    ];
    let done = 0;
    await Promise.all(
      names.map(async (name) => {
        const asset = await this.load(
          `/assets/models/${name}.glb`,
          "container",
        );
        this.containers.set(name, asset.resource as ContainerResource);
        progress(
          "Preparing streets & characters",
          0.15 + (++done / names.length) * 0.45,
        );
      }),
    );
    const skyAsset = await this.load(
      "/assets/textures/afternoon-sky.hdr",
      "texture",
    );
    const panorama = skyAsset.resource as Texture;
    panorama.projection = TEXTUREPROJECTION_EQUIRECT;
    this.sky = EnvLighting.generateSkyboxCubemap(panorama, 256);
    this.app.scene.skybox = this.sky;
    this.app.scene.skyboxIntensity = 0.85;
    const textures = new Map<string, Texture>();
    await Promise.all(
      [
        "stone",
        "asphalt",
        "concrete",
        "paving",
        "windows",
        "window",
        "car-bottom",
        "car-wheel",
        "car-lights",
        ...CHARACTER_MODELS,
        ...VENDOR_MODELS,
        ...TRANSPORT_MODELS,
        "fern",
      ].map(async (name) => {
        const asset = await this.load(
          `/assets/textures/${name}.webp`,
          "texture",
        );
        const t = asset.resource as Texture;
        t.addressU = ADDRESS_REPEAT;
        t.addressV = ADDRESS_REPEAT;
        t.minFilter = FILTER_LINEAR_MIPMAP_LINEAR;
        t.anisotropy = 4;
        t.flipY = false;
        textures.set(name, t);
      }),
    );
    const defs: Record<string, [string | null, string, number]> = {
      fern: ["fern", "#6c874d", 0.05],
      wall: ["stone", "#d7dce2", 0.06],
      default: ["stone", "#d2d9e0", 0.08],
      bricks_red_2: ["stone", "#d9dce1", 0.05],
      concrete_grey: ["concrete", "#cbd3df", 0.05],
      WindowAtlas: ["windows", "#98b0ad", 0.3],
      window_sashcase_flat_3: ["window", "#cad4cf", 0.25],
      SideWalks: ["paving", "#bac6d4", 0.05],
      road: ["asphalt", "#777a77", 0.02],
      ground: ["concrete", "#adbcc9", 0.02],
      pavement: ["paving", "#becbd8", 0.03],
      "wagon-paint": [null, "#b9d2df", 0.3],
      "sports-paint": [null, "#9d343c", 0.35],
      bodycolour: [null, "#e8b52b", 0.3],
      UCB_BOTTOM: ["car-bottom", "#ffffff", 0.2],
      RIMSTOCK_07: ["car-wheel", "#ffffff", 0.25],
      Riverside88_lights_glass: ["car-lights", "#ffffff", 0.2],
      UCB_GLASS_CLEAN: [null, "#203b43", 0.55],
      GENERIC_BADGES: [null, "#aaa9a0", 0.4],
      Numberplates: [null, "#ddddcc", 0.1],
      "landmark-bronze": [null, "#5b594c", 0.1],
      glasss: [null, "#242821", 0.2],
    };
    for (const [name, [texture, color, gloss]] of Object.entries(defs)) {
      const m = new StandardMaterial();
      m.name = name;
      m.diffuse = new Color().fromString(color);
      m.gloss = gloss;
      m.useMetalness = true;
      m.metalness = name.includes("GLASS") ? 0.25 : 0.02;
      // The unfiltered display sky must never act as a mirror on dry ground.
      if (
        ["road", "ground", "pavement", "SideWalks", "concrete_grey"].includes(
          name,
        )
      ) {
        m.useSkybox = false;
        m.metalness = 0;
        m.gloss = 0;
        m.specularityFactor = 0;
        m.specular.set(0, 0, 0);
      }
      if (texture) m.diffuseMap = textures.get(texture) ?? null;
      if (name === "WindowAtlas" || name === "window_sashcase_flat_3") {
        // Match Unity BuildingWindows: the supplied atlas is also its emission map.
        // Emission stays independent of facade/profile diffuse tints.
        m.emissiveMap = textures.get(texture!) ?? null;
        m.emissive.set(1, 1, 1);
        m.emissiveIntensity = 1;
      }
      if (name === "fern") {
        m.opacityMap = textures.get("fern")!;
        m.opacityMapChannel = "a";
        m.alphaTest = 0.45;
        m.cull = CULLFACE_NONE;
      }
      if (["wall", "default", "bricks_red_2", "concrete_grey"].includes(name))
        m.diffuseVertexColor = true;
      if (["road", "pavement", "ground"].includes(name)) {
        // Metre-scaled world UVs keep stretched, instanced source meshes crisp.
        m.getShaderChunks("glsl").set(
          "diffusePS",
          `
          uniform vec3 material_diffuse;
          void getAlbedo() {
            dAlbedo = material_diffuse.rgb;
            #ifdef STD_DIFFUSE_TEXTURE
              dAlbedo *= {STD_DIFFUSE_TEXTURE_DECODE}(texture2DBias({STD_DIFFUSE_TEXTURE_NAME}, vPositionW.xz * ${name === "road" ? ".25" : ".5"}, {STD_TEXTURE_BIAS})).{STD_DIFFUSE_TEXTURE_CHANNEL};
            #endif
          }
        `,
        );
      }
      m.update();
      this.materials.set(name, m);
    }
    for (const name of CHARACTER_MODELS) {
      const material = new StandardMaterial();
      const id = name.slice("character-".length);
      material.name = `${id === "adebayo" || id === "jarvis" ? "hide-and-seek" : "presido"}-${id}`;
      material.diffuseMap = textures.get(name)!;
      // Unity FBX UVs use the opposite vertical origin to these PNG atlases.
      material.diffuseMapTiling.set(1, -1);
      material.diffuseMapOffset.set(0, 1);
      material.gloss = 0.1;
      material.useMetalness = true;
      material.metalness = 0;
      material.update();
      this.materials.set(material.name, material);
      if (name === PLAYER_CHARACTER_MODEL) {
        const hair = material.clone();
        hair.name = "hide-and-seek-adebayo-hair";
        hair.opacityMap = textures.get(name)!;
        hair.opacityMapChannel = "a";
        hair.opacityMapTiling.set(1, -1);
        hair.opacityMapOffset.set(0, 1);
        hair.alphaTest = 0.5;
        hair.cull = CULLFACE_NONE;
        hair.update();
        this.materials.set(hair.name, hair);
      }
    }
    for (const name of [...VENDOR_MODELS, ...TRANSPORT_MODELS]) {
      const material = new StandardMaterial();
      material.name = name;
      material.diffuseMap = textures.get(name)!;
      material.diffuseMapTiling.set(1, -1);
      material.diffuseMapOffset.set(0, 1);
      material.diffuseVertexColor = true;
      material.useSkybox = false;
      material.gloss = 0;
      material.specularityFactor = 0;
      material.update();
      this.materials.set(name, material);
    }
    for (const resource of this.containers.values())
      for (const asset of resource.materials) {
        const material = asset.resource as StandardMaterial;
        if (material.name.startsWith("tinubu-")) {
          material.useSkybox = false;
          material.specularityFactor = 0.08;
          material.diffuseVertexColor = material.name === "tinubu-stone";
          if (material.name === "tinubu-stone")
            material.diffuse.fromString("#a88c65");
          material.update();
        }
        const replacement = this.materials.get(material.name);
        if (replacement) material.copy(replacement);
      }
  }
  instantiate(name: string) {
    const resource = this.containers.get(name);
    if (!resource) throw new Error(`Missing model: ${name}`);
    return resource.instantiateRenderEntity();
  }
  buildingMaterial(source: StandardMaterial, profile?: string) {
    const palette = profile ? this.buildingProfiles[profile] : undefined;
    if (!palette) return source;
    const key = `building:${profile}:${source.name}`;
    let material = this.materials.get(key);
    if (!material) {
      material = source.clone();
      material.name = key;
      const slot =
        source.name === "bricks_red_2"
          ? "brick"
          : source.name === "concrete_grey"
            ? "trim"
            : /window/i.test(source.name)
              ? "glass"
              : "wall";
      if (source.name !== "landmark-bronze")
        material.diffuse.fromString(palette[slot]);
      if (profile === "trinity" || profile === "cbn-glass")
        material.diffuseVertexColor = false;
      // The church reference is smooth rendered plaster, not exposed brick.
      if (profile === "trinity" && slot !== "glass") material.diffuseMap = null;
      material.useSkybox = false;
      material.update();
      this.materials.set(key, material);
    }
    return material;
  }
  pedestrianModel(variant: number) {
    return NPC_CHARACTER_MODELS[
      Number.isInteger(variant) &&
      variant >= 0 &&
      variant < NPC_CHARACTER_MODELS.length
        ? variant
        : 0
    ];
  }
  instantiatePedestrian(variant: number) {
    return this.instantiate(this.pedestrianModel(variant));
  }
  getAnimations(name: string): Asset[] {
    const resource = this.containers.get(name);
    return (resource?.animations as Asset[]) ?? [];
  }
  destroy() {
    this.disposed = true;
    this.abort.abort();
    this.app.scene.skybox = null;
    this.sky?.destroy();
    for (const a of this.assets) {
      a.unload();
      this.app.assets.remove(a);
    }
    for (const m of this.materials.values()) m.destroy();
    this.assets = [];
  }
}
