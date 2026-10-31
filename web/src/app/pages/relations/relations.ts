import { Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Relation } from '../../core/models';
import { norm } from '../../core/search';
import { Spoilers } from '../../core/spoilers';
import { WikiData } from '../../core/wiki-data';
import { layoutGraph, GraphNode } from './graph-layout';

/** Relation type → CSS key (colours live in relations.css, per theme) and dash pattern in screen px. */
export const REL_TYPES: [type: string, key: string, dash: string][] = [
  ['родня', 'kin', ''],
  ['супруги', 'spouse', ''],
  ['любовь', 'love', '1 4'],
  ['союз', 'ally', ''],
  ['служба', 'service', '10 4'],
  ['вражда', 'enemy', '6 4'],
  ['наставник', 'mentor', '2 3 8 3'],
];
/** Most world units per screen px on first open: nodes (≥110 apart) stay ≥ ~35px apart on screen. */
const MAX_START_K = 3.2;
const TYPE = new Map(REL_TYPES.map(([t, key, dash]) => [t, { key, dash }]));

interface Edge { r: Relation; d: string; }
interface Label { x: number; y: number; a: 'middle' | 'start' | 'end'; }
type View = [number, number, number, number];

@Component({
  selector: 'app-relations-page',
  imports: [RouterLink],
  templateUrl: './relations.html',
  styleUrl: './relations.css',
})
export class RelationsPage {
  readonly id = input<string>();
  protected readonly data = inject(WikiData);
  private readonly spoilers = inject(Spoilers);
  protected readonly types = REL_TYPES;
  protected readonly hiddenTypes = signal<Set<string>>(new Set());
  protected readonly selected = signal<string>('');
  protected readonly hover = signal<string>('');
  protected readonly view = signal<View>([0, 0, 1000, 800]);
  /** Rendered width/height of the svg in CSS px, to keep labels and nodes a constant screen size. */
  private readonly px = signal<[number, number]>([1000, 800]);

  /** Edges the reader may see: known by the chosen book, between characters not hidden as spoilers. */
  protected readonly edges = computed<Relation[]>(() =>
    this.data.extra().relations.filter((r) =>
      this.spoilers.bookVisible(r.o) && !this.spoilers.hidden(this.data.get(r.a)) && !this.spoilers.hidden(this.data.get(r.b))),
  );
  private readonly portrait = computed(() => this.px()[1] > this.px()[0]);
  private readonly layout = computed<GraphNode[]>(() => layoutGraph(this.edges()));
  /** The layout turned a quarter so its long side follows the long side of the canvas (portrait phones). */
  protected readonly nodes = computed<GraphNode[]>(() => {
    const ns = this.layout();
    const xs = ns.map((n) => n.x), ys = ns.map((n) => n.y);
    const wide = Math.max(...xs) - Math.min(...xs) > Math.max(...ys) - Math.min(...ys);
    return wide !== this.portrait() ? ns : ns.map((n) => ({ ...n, x: -n.y, y: n.x }));
  });
  protected readonly byId = computed(() => new Map(this.nodes().map((n) => [n.id, n])));
  protected readonly neighbours = computed(() => {
    const s = this.selected();
    const set = new Set<string>(s ? [s] : []);
    for (const r of this.edges()) { if (r.a === s) set.add(r.b); if (r.b === s) set.add(r.a); }
    return set;
  });
  protected readonly details = computed(() => {
    const s = this.selected();
    if (!s) return [];
    const mine = this.edges().filter((r) => r.a === s || r.b === s);
    return REL_TYPES.map(([t, key, dash]) => ({ t, key, dash, items: mine.filter((r) => r.t === t) })).filter((g) => g.items.length);
  });

  /** World units per screen pixel. */
  protected readonly k = computed(() => this.view()[2] / this.px()[0]);

  /** Visible edges as paths; several relations between one pair fan out into gentle arcs instead of overlapping. */
  protected readonly paths = computed<Edge[]>(() => {
    const hidden = this.hiddenTypes(), at = this.byId(), k = this.k();
    const groups = new Map<string, Relation[]>();
    for (const r of this.edges()) {
      if (hidden.has(r.t)) continue;
      const key = r.a < r.b ? r.a + '|' + r.b : r.b + '|' + r.a;
      groups.get(key)?.push(r) ?? groups.set(key, [r]);
    }
    const out: Edge[] = [];
    for (const g of groups.values()) {
      g.forEach((r, i) => {
        const [p, q] = r.a < r.b ? [at.get(r.a)!, at.get(r.b)!] : [at.get(r.b)!, at.get(r.a)!];
        const off = (i - (g.length - 1) / 2) * 7 * k;
        if (!off) { out.push({ r, d: `M${p.x} ${p.y}L${q.x} ${q.y}` }); return; }
        const dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy) || 1;
        const cx = (p.x + q.x) / 2 - (dy / len) * off * 2, cy = (p.y + q.y) / 2 + (dx / len) * off * 2;
        out.push({ r, d: `M${p.x} ${p.y}Q${cx} ${cy} ${q.x} ${q.y}` });
      });
    }
    // Selected edges last, so they are drawn on top.
    const s = this.selected();
    return s ? out.sort((a, b) => +(a.r.a === s || a.r.b === s) - +(b.r.a === s || b.r.b === s)) : out;
  });

  /**
   * Which names to print and where: greedy, by priority (selection, hover, then most connected).
   * Each label tries above, below, right and left of its node and is dropped if all four would
   * overlap a label already placed or another dot, or stick out of the view.
   */
  protected readonly labels = computed(() => {
    const [vx, vy, vw, vh] = this.view(), k = this.k(), sel = this.neighbours(), hov = this.hover(), s = this.selected();
    const prio = (n: GraphNode) => (n.id === s ? 1e6 : n.id === hov ? 1e5 : sel.has(n.id) ? 1e4 : 0) + n.degree;
    // Seeded with the corner under the zoom buttons.
    const placed: [number, number, number, number][] = [[vx + vw - 62 * k, vy + vh - 172 * k, vx + vw, vy + vh]];
    const shown = new Map<string, Label>();
    // Dots a label must not cover: those at least as connected as its own (faded ones don't count while someone is selected).
    const dots = this.nodes().filter((n) => !s || sel.has(n.id)).map((n) => {
      const r = this.radius(n);
      return [n.id, n.degree, n.x - r, n.y - r, n.x + r, n.y + r] as const;
    });
    for (const n of [...this.nodes()].sort((a, b) => prio(b) - prio(a))) {
      if (s && !sel.has(n.id) && n.id !== hov) continue;
      const w = this.name(n.id).length * 7.4 * k + 6 * k, h = 17 * k, r = this.radius(n), gap = 4 * k;
      const spots: [x0: number, y0: number, label: Label][] = [
        [n.x - w / 2, n.y - r - gap - h, { x: 0, y: -r - gap - 4 * k, a: 'middle' }],
        [n.x - w / 2, n.y + r + gap, { x: 0, y: r + gap + 13 * k, a: 'middle' }],
        [n.x + r + gap, n.y - h / 2, { x: r + gap, y: 4.5 * k, a: 'start' }],
        [n.x - r - gap - w, n.y - h / 2, { x: -r - gap, y: 4.5 * k, a: 'end' }],
      ];
      for (const [x0, y0, label] of spots) {
        if (x0 < vx || x0 + w > vx + vw || y0 < vy || y0 + h > vy + vh) continue;
        if (placed.some(([a, b, c, d]) => x0 < c && x0 + w > a && y0 < d && y0 + h > b)) continue;
        if (dots.some(([id, deg, a, b, c, d]) => id !== n.id && deg >= n.degree && x0 < c && x0 + w > a && y0 < d && y0 + h > b)) continue;
        placed.push([x0, y0, x0 + w, y0 + h]);
        shown.set(n.id, label);
        break;
      }
    }
    return shown;
  });

  private readonly svg = viewChild<ElementRef<SVGSVGElement>>('svg');
  private readonly pointers = new Map<number, [number, number]>();
  private drag: { x: number; y: number; v: View; dist?: number } | null = null;
  private moved = false;
  private anim = 0;

  private readonly destroy = inject(DestroyRef);
  private sized = false;
  /** The reader has panned, zoomed or picked someone: stop auto-fitting on resize. */
  private touched = false;

  constructor() {
    effect(() => { this.nodes(); untracked(() => this.sized && this.reframe()); });
    effect(() => { const id = this.id(); if (id) untracked(() => this.select(id)); });
    afterNextRender(() => {
      const el = this.svg()!.nativeElement;
      const ro = new ResizeObserver(() => {
        const [ow, oh] = this.px(), w = el.clientWidth || 1, h = el.clientHeight || 1;
        this.px.set([w, h]);
        if (!this.sized || !this.touched) { this.sized = true; this.reframe(); return; }
        // Keep the centre and scale; just show more or less around it.
        const v = this.view(), cx = v[0] + v[2] / 2, cy = v[1] + v[3] / 2, nw = (v[2] * w) / ow, nh = (v[3] * h) / oh;
        this.view.set([cx - nw / 2, cy - nh / 2, nw, nh]);
      });
      ro.observe(el);
      el.addEventListener('wheel', (ev) => this.wheel(ev), { passive: false });
      this.destroy.onDestroy(() => { ro.disconnect(); cancelAnimationFrame(this.anim); });
    });
  }

  /**
   * Initial framing: the selected character's circle if any, otherwise everything —
   * unless that would squeeze the graph into a tangle (phones), then the busy middle at a readable scale.
   */
  private reframe(): void {
    if (this.selected()) { this.select(this.selected(), false); return; }
    this.fit(false);
    const v = this.view(), f = (MAX_START_K * this.px()[0]) / v[2];
    if (f < 1) this.view.set([v[0] + (v[2] * (1 - f)) / 2, v[1] + (v[3] * (1 - f)) / 2, v[2] * f, v[3] * f]);
  }

  protected viewBox(): string { return this.view().join(' '); }
  protected name(id: string): string { return this.data.title(id); }
  protected key(t: string): string { return TYPE.get(t)?.key ?? 'kin'; }
  protected dash(t: string): string { return TYPE.get(t)?.dash ?? ''; }
  /** Node radius in world units, sized in screen px so zooming in spreads nodes apart instead of inflating them. */
  protected radius(n: GraphNode): number { return (4 + Math.sqrt(n.degree) * 1.7) * this.k(); }
  protected toggleType(t: string): void {
    this.hiddenTypes.update((s) => { const n = new Set(s); if (n.has(t)) n.delete(t); else n.add(t); return n; });
  }
  protected pick(id: string): void { if (!this.moved) this.select(this.selected() === id ? '' : id); }
  protected find(q: string): void {
    const v = norm(q);
    if (!v) { this.select(''); return; }
    const n = this.nodes().find((x) => norm(this.name(x.id)).includes(v));
    if (n) this.select(n.id);
  }

  /** Select a character and bring them with all their relations into view. */
  protected select(id: string, animate = true): void {
    this.selected.set(id);
    if (animate) this.touched = true;
    if (!id || !this.sized) return;
    const ids = this.neighbours();
    const pts = this.nodes().filter((n) => ids.has(n.id));
    if (pts.length) this.frame(pts, animate);
  }

  /** Show the whole graph. */
  protected fit(animate = true): void { this.frame(this.nodes(), animate); }

  protected zoom(f: number): void {
    this.touched = true;
    const v = this.view();
    this.animateTo([v[0] + (v[2] * (1 - f)) / 2, v[1] + (v[3] * (1 - f)) / 2, v[2] * f, v[3] * f]);
  }

  private frame(pts: GraphNode[], animate: boolean): void {
    const xs = pts.map((n) => n.x), ys = pts.map((n) => n.y);
    const [pw, ph] = this.px();
    const padX = 90, padY = 60;
    let w = Math.max(...xs) - Math.min(...xs) + padX * 2, h = Math.max(...ys) - Math.min(...ys) + padY * 2;
    w = Math.max(w, 420); h = Math.max(h, 320);
    // Match the svg aspect ratio so the viewBox maps 1:1 onto the element.
    if (w / h > pw / ph) h = (w * ph) / pw; else w = (h * pw) / ph;
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    const target: View = [cx - w / 2, cy - h / 2, w, h];
    if (animate) this.animateTo(target); else this.view.set(target);
  }

  private animateTo(to: View): void {
    cancelAnimationFrame(this.anim);
    const from = this.view(), t0 = performance.now(), dur = 380;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      this.view.set(from.map((v, i) => v + (to[i] - v) * e) as View);
      if (p < 1) this.anim = requestAnimationFrame(step);
    };
    this.anim = requestAnimationFrame(step);
  }

  protected down(ev: PointerEvent): void {
    cancelAnimationFrame(this.anim);
    this.touched = true;
    this.pointers.set(ev.pointerId, [ev.clientX, ev.clientY]);
    this.startGesture();
    this.moved = false;
  }
  private startGesture(): void {
    const ps = [...this.pointers.values()];
    if (!ps.length) { this.drag = null; return; }
    const x = ps.reduce((s, p) => s + p[0], 0) / ps.length, y = ps.reduce((s, p) => s + p[1], 0) / ps.length;
    this.drag = { x, y, v: this.view(), dist: ps.length > 1 ? Math.hypot(ps[0][0] - ps[1][0], ps[0][1] - ps[1][1]) : undefined };
  }
  protected move(ev: PointerEvent): void {
    if (!this.drag || !this.pointers.has(ev.pointerId)) return;
    this.pointers.set(ev.pointerId, [ev.clientX, ev.clientY]);
    const el = this.svg()!.nativeElement, r = el.getBoundingClientRect();
    const ps = [...this.pointers.values()];
    const x = ps.reduce((s, p) => s + p[0], 0) / ps.length, y = ps.reduce((s, p) => s + p[1], 0) / ps.length;
    const v = this.drag.v, s = v[2] / r.width;
    if (Math.abs(x - this.drag.x) + Math.abs(y - this.drag.y) > 4) this.moved = true;
    // Pinch: scale around the starting midpoint, then pan by how far the midpoint moved.
    const f = this.drag.dist && ps.length > 1 ? Math.min(8, Math.max(0.12, this.drag.dist / (Math.hypot(ps[0][0] - ps[1][0], ps[0][1] - ps[1][1]) || 1))) : 1;
    if (f !== 1) this.moved = true;
    const wx = v[0] + (this.drag.x - r.left) * s, wy = v[1] + (this.drag.y - r.top) * s;
    const nw = v[2] * f, nh = v[3] * f, ns = s * f;
    this.view.set([wx - (x - r.left) * ns, wy - (y - r.top) * ns, nw, nh]);
  }
  protected up(ev: PointerEvent): void {
    this.pointers.delete(ev.pointerId);
    this.startGesture();
    if (!this.pointers.size) setTimeout(() => (this.moved = false));
  }
  private wheel(ev: WheelEvent): void {
    ev.preventDefault();
    cancelAnimationFrame(this.anim);
    this.touched = true;
    const el = this.svg()!.nativeElement, r = el.getBoundingClientRect(), v = this.view();
    const f = Math.exp(Math.max(-0.5, Math.min(0.5, ev.deltaY * (ev.deltaMode ? 0.05 : 0.002))));
    const px = v[0] + ((ev.clientX - r.left) / r.width) * v[2], py = v[1] + ((ev.clientY - r.top) / r.height) * v[3];
    this.view.set([px - (px - v[0]) * f, py - (py - v[1]) * f, v[2] * f, v[3] * f]);
  }
}
