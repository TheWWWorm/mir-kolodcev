import { Relation } from '../../core/models';

export interface GraphNode { id: string; x: number; y: number; degree: number; }

/**
 * Deterministic force-directed layout (repulsion between all nodes, stronger for well-connected ones
 * so hubs spread apart instead of piling up in the middle; springs along edges),
 * followed by a collision pass so that no two nodes end up closer than MIN_GAP.
 */
export function layoutGraph(edges: Relation[], iterations = 600): GraphNode[] {
  const ids = [...new Set(edges.flatMap((r) => [r.a, r.b]))];
  const degree = new Map<string, number>();
  for (const r of edges) { degree.set(r.a, (degree.get(r.a) ?? 0) + 1); degree.set(r.b, (degree.get(r.b) ?? 0) + 1); }
  // Several relations between the same pair pull as one spring.
  const pairs = [...new Map(edges.map((r) => [r.a < r.b ? r.a + '|' + r.b : r.b + '|' + r.a, r])).values()];
  ids.sort((a, b) => (degree.get(b) ?? 0) - (degree.get(a) ?? 0));
  const nodes = ids.map((id, i) => ({ id, x: Math.cos(i * 2.4) * (80 + i * 12), y: Math.sin(i * 2.4) * (80 + i * 12), vx: 0, vy: 0, degree: degree.get(id) ?? 0, mass: Math.sqrt(1 + (degree.get(id) ?? 0)) / 2 }));
  const at = new Map(nodes.map((n) => [n.id, n]));
  const SPRING = 260, REPULSE = 140000, GRAVITY = 0.002, MIN_GAP = 110;
  for (let it = 0; it < iterations; it++) {
    const cool = 1 - it / iterations;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy + 0.01, d = Math.sqrt(d2), f = (REPULSE * a.mass * b.mass) / d2;
        dx /= d; dy /= d;
        a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
      }
    }
    for (const r of pairs) {
      const a = at.get(r.a)!, b = at.get(r.b)!;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1, f = (d - SPRING) * 0.05;
      a.vx += (dx / d) * f; a.vy += (dy / d) * f;
      b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
    }
    for (const n of nodes) {
      n.vx -= n.x * GRAVITY; n.vy -= n.y * GRAVITY;
      n.x += Math.max(-40, Math.min(40, n.vx)) * cool;
      n.y += Math.max(-40, Math.min(40, n.vy)) * cool;
      n.vx *= 0.5; n.vy *= 0.5;
    }
  }
  for (let it = 0; it < 30; it++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (d >= MIN_GAP) continue;
        const push = (MIN_GAP - d) / 2;
        a.x += (dx / d) * push; a.y += (dy / d) * push; b.x -= (dx / d) * push; b.y -= (dy / d) * push;
      }
    }
  }
  return nodes.map(({ id, x, y, degree }) => ({ id, x, y, degree }));
}
