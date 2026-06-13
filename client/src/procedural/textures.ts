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

// Vertical sky gradient with a few soft clouds, used on a backside sky dome.
export function makeSkyTexture(): THREE.Texture {
  const { c, ctx } = canvas(512);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, "#3a6fb0");
  g.addColorStop(0.5, "#7fb2e0");
  g.addColorStop(1, "#dfeefc");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  // clouds in the upper band
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

// The Poring's face: applied to the front of its squashed sphere body.
export function makePoringTexture(): THREE.Texture {
  const { c, ctx } = canvas(256);
  // pink jelly base
  const g = ctx.createRadialGradient(128, 100, 20, 128, 128, 150);
  g.addColorStop(0, "#ffd1e6");
  g.addColorStop(1, "#ff9ec4");
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
