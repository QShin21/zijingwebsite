export type Particle = { x: number; y: number; z: number; vx: number; vy: number; phase: number; kind: number; life: number; burst: boolean };

/**
 * What happens to a particle after it moved this frame. Burst sparks are short-lived and are
 * removed when their life runs out or they leave the canvas; they never turn into ambient
 * particles. Ambient particles respawn at an edge when they drift out.
 */
export function particleFate(p: Pick<Particle, "x" | "y" | "life" | "burst">, width: number, height: number): "keep" | "remove" | "respawn" {
  const outside = p.y > height + 8 || p.y < -8 || p.x < -8 || p.x > width + 8;
  if (p.burst) return p.life <= 0 || outside ? "remove" : "keep";
  return outside ? "respawn" : "keep";
}
