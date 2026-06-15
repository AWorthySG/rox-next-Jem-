import * as THREE from "three";

// All game art is generated procedurally at runtime onto <canvas> and wrapped as
// THREE.CanvasTexture — fully original, zero binary assets, zero copyright risk.

function canvas(size: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  return { c, ctx };
}

// Tileable grassy ground with subtle noise, blades and the odd flower.
export function makeGrassTexture(): THREE.Texture {
  const { c, ctx } = canvas(256);
  const base = ctx.createLinearGradient(0, 0, 256, 256);
  base.addColorStop(0, "#4f8a3f");
  base.addColorStop(1, "#3c7233");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);

  // mottled noise
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const g = 90 + Math.floor(Math.random() * 90);
    ctx.fillStyle = `rgba(${Math.floor(g * 0.5)},${g},${Math.floor(g * 0.45)},0.18)`;
    ctx.fillRect(x, y, 2, 2);
  }
  // grass blades
  for (let i = 0; i < 220; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    ctx.strokeStyle = Math.random() > 0.5 ? "#5fa24a" : "#356b2c";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 4, y - 4 - Math.random() * 3);
    ctx.stroke();
  }
  // flowers
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    ctx.fillStyle = ["#f4d35e", "#f48fb1", "#fff"][Math.floor(Math.random() * 3)];
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(40, 40);
  tex.anisotropy = 4;
  return tex;
}

// Richer tileable ground: layered greens with large-scale variation, blades,
// dirt patches and the odd flower. Used as the albedo for the PBR ground.
export function makeGroundTexture(): THREE.Texture {
  const N = 1024;
  const { c, ctx } = canvas(N);
  const base = ctx.createLinearGradient(0, 0, N, N);
  base.addColorStop(0, "#588f44");
  base.addColorStop(1, "#3f7536");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, N, N);

  // large-scale soft blotches of lighter/darker grass
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * N;
    const y = Math.random() * N;
    const r = 70 + Math.random() * 180;
    const light = Math.random() > 0.5;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, light ? "rgba(126,176,84,0.22)" : "rgba(38,78,40,0.22)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // fine mottled noise
  for (let i = 0; i < 26000; i++) {
    const x = Math.random() * N;
    const y = Math.random() * N;
    const g = 90 + Math.floor(Math.random() * 90);
    ctx.fillStyle = `rgba(${Math.floor(g * 0.5)},${g},${Math.floor(g * 0.45)},0.12)`;
    ctx.fillRect(x, y, 2, 2);
  }
  // a few dirt patches
  for (let i = 0; i < 10; i++) {
    const x = Math.random() * N;
    const y = Math.random() * N;
    const r = 24 + Math.random() * 56;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(120,92,54,0.5)");
    grad.addColorStop(0.7, "rgba(120,92,54,0.18)");
    grad.addColorStop(1, "rgba(120,92,54,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // grass blades (denser + longer for crisper turf)
  for (let i = 0; i < 4200; i++) {
    const x = Math.random() * N;
    const y = Math.random() * N;
    const tone = Math.random();
    ctx.strokeStyle = tone > 0.66 ? "#7cc463" : tone > 0.33 ? "#5ca049" : "#356b2c";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 6, y - 7 - Math.random() * 6);
    ctx.stroke();
  }
  // small clover clumps — clusters of tiny dots that read as denser foliage
  for (let i = 0; i < 140; i++) {
    const cx = Math.random() * N;
    const cy = Math.random() * N;
    ctx.fillStyle = Math.random() > 0.5 ? "rgba(96,150,70,0.5)" : "rgba(60,108,50,0.5)";
    for (let j = 0; j < 6; j++) {
      ctx.beginPath();
      ctx.arc(cx + (Math.random() - 0.5) * 12, cy + (Math.random() - 0.5) * 12, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // flowers
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * N;
    const y = Math.random() * N;
    ctx.fillStyle = ["#f4d35e", "#f48fb1", "#fff", "#c79bff"][Math.floor(Math.random() * 4)];
    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(28, 28);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// Grayscale roughness variation so the ground catches light unevenly (matte
// grass, slightly shinier dirt/worn patches).
export function makeGroundRoughness(): THREE.Texture {
  const N = 256;
  const { c, ctx } = canvas(N);
  ctx.fillStyle = "#cfcfcf"; // fairly rough overall
  ctx.fillRect(0, 0, N, N);
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * N;
    const y = Math.random() * N;
    const r = 8 + Math.random() * 30;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    const v = 150 + Math.floor(Math.random() * 80);
    grad.addColorStop(0, `rgba(${v},${v},${v},0.5)`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(32, 32);
  return tex;
}

// A stepped grayscale ramp for MeshToonMaterial — gives characters/monsters the
// banded cel-shaded look of an anime MMO.
let toonGradientCache: THREE.Texture | null = null;
export function makeToonGradient(): THREE.Texture {
  if (toonGradientCache) return toonGradientCache;
  const data = new Uint8Array([90, 90, 90, 255, 160, 160, 160, 255, 215, 215, 215, 255, 255, 255, 255, 255]);
  const tex = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  toonGradientCache = tex;
  return tex;
}

// A soft puffy cloud sprite (lumpy alpha) for the drifting sky layer.
let cloudCache: THREE.Texture | null = null;
export function makeCloud(): THREE.Texture {
  if (cloudCache) return cloudCache;
  const N = 256;
  const { c, ctx } = canvas(N);
  for (let i = 0; i < 22; i++) {
    const x = 40 + Math.random() * (N - 80);
    const y = 70 + Math.random() * (N - 150);
    const r = 28 + Math.random() * 56;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  cloudCache = new THREE.CanvasTexture(c);
  return cloudCache;
}

// A soft round white spark for additive particle VFX (tinted per use).
let sparkCache: THREE.Texture | null = null;
export function makeSpark(): THREE.Texture {
  if (sparkCache) return sparkCache;
  const N = 64;
  const { c, ctx } = canvas(N);
  const g = ctx.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.7)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, N, N);
  sparkCache = new THREE.CanvasTexture(c);
  return sparkCache;
}

// Soft round blob alpha for a fake contact shadow under entities.
let blobCache: THREE.Texture | null = null;
export function makeBlobShadow(): THREE.Texture {
  if (blobCache) return blobCache;
  const N = 128;
  const { c, ctx } = canvas(N);
  const g = ctx.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  g.addColorStop(0, "rgba(0,0,0,0.55)");
  g.addColorStop(0.7, "rgba(0,0,0,0.25)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, N, N);
  blobCache = new THREE.CanvasTexture(c);
  return blobCache;
}

// A large, tileable soft cloud-shadow alpha map for dappled sunlight on the
// ground. Blobs are drawn with wrap-around copies so the texture tiles cleanly.
let cloudShadowCache: THREE.Texture | null = null;
export function makeCloudShadow(): THREE.Texture {
  if (cloudShadowCache) return cloudShadowCache;
  const N = 256;
  const { c, ctx } = canvas(N);
  const offsets = [
    [0, 0], [N, 0], [-N, 0], [0, N], [0, -N], [N, N], [-N, -N], [N, -N], [-N, N],
  ];
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * N;
    const y = Math.random() * N;
    const r = 38 + Math.random() * 64;
    for (const [ox, oy] of offsets) {
      const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      g.addColorStop(0, "rgba(0,0,0,0.5)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  cloudShadowCache = new THREE.CanvasTexture(c);
  cloudShadowCache.wrapS = cloudShadowCache.wrapT = THREE.RepeatWrapping;
  return cloudShadowCache;
}

// Soft radial sun glow sprite (additive). Bloom turns it into a warm halo.
export function makeSunSprite(): THREE.Texture {
  const N = 256;
  const { c, ctx } = canvas(N);
  const g = ctx.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  g.addColorStop(0, "rgba(255,250,230,1)");
  g.addColorStop(0.18, "rgba(255,240,200,0.95)");
  g.addColorStop(0.5, "rgba(255,221,150,0.35)");
  g.addColorStop(1, "rgba(255,221,150,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, N, N);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Vertical sky gradient with a few soft clouds, used on a backside sky dome.
export function makeSkyTexture(): THREE.Texture {
  const { c, ctx } = canvas(512);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, "#3a6fb0");
  g.addColorStop(0.5, "#7fb2e0");
  g.addColorStop(1, "#dfeefc");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 16; i++) {
    const x = Math.random() * 512;
    const y = 30 + Math.random() * 200;
    const r = 18 + Math.random() * 40;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(255,255,255,0.85)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// The Poring-family face, applied to the front of a squashed sphere body. The
// jelly colour is parameterised so the same art makes Drops, Fabre, Lunatic, etc.
export function makePoringTexture(inner = "#ffd1e6", outer = "#ff9ec4"): THREE.Texture {
  const { c, ctx } = canvas(256);
  // jelly base
  const g = ctx.createRadialGradient(128, 100, 20, 128, 128, 150);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  // eyes
  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.ellipse(98, 120, 12, 16, 0, 0, Math.PI * 2);
  ctx.ellipse(158, 120, 12, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  // eye shines
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(102, 114, 4, 0, Math.PI * 2);
  ctx.arc(162, 114, 4, 0, Math.PI * 2);
  ctx.fill();
  // big grin
  ctx.strokeStyle = "#a83b63";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(128, 150, 34, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  // cheeks
  ctx.fillStyle = "rgba(255,120,160,0.5)";
  ctx.beginPath();
  ctx.arc(74, 150, 12, 0, Math.PI * 2);
  ctx.arc(182, 150, 12, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
