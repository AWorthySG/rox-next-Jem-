interface Sample {
  t: number; // client receive time (ms)
  x: number;
  z: number;
  facing: number;
}

// Buffers timestamped position samples and reconstructs a smooth position in the
// past (render time = now - INTERP_DELAY) by linear interpolation.
export class Interpolator {
  private buf: Sample[] = [];

  push(x: number, z: number, facing: number, t: number): void {
    this.buf.push({ t, x, z, facing });
    // keep ~1s of history
    while (this.buf.length > 2 && this.buf[1].t < t - 1000) this.buf.shift();
  }

  sample(renderTime: number): { x: number; z: number; facing: number } | null {
    if (this.buf.length === 0) return null;
    if (this.buf.length === 1 || renderTime <= this.buf[0].t) {
      const s = this.buf[0];
      return { x: s.x, z: s.z, facing: s.facing };
    }
    const last = this.buf[this.buf.length - 1];
    if (renderTime >= last.t) return { x: last.x, z: last.z, facing: last.facing };

    for (let i = 0; i < this.buf.length - 1; i++) {
      const a = this.buf[i];
      const b = this.buf[i + 1];
      if (renderTime >= a.t && renderTime <= b.t) {
        const f = (renderTime - a.t) / (b.t - a.t || 1);
        return {
          x: a.x + (b.x - a.x) * f,
          z: a.z + (b.z - a.z) * f,
          facing: lerpAngle(a.facing, b.facing, f),
        };
      }
    }
    return { x: last.x, z: last.z, facing: last.facing };
  }
}

function lerpAngle(a: number, b: number, f: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * f;
}
