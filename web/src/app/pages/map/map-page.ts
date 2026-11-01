import { Component, ElementRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MapPlace } from '../../core/models';
import { WikiData } from '../../core/wiki-data';
import { Stop } from './timeline';
import { RouteStep, TimelinePanel } from './timeline-panel';
import { SITE } from '../../core/site';

/** Logical size of the map image: it is always drawn at this size, whatever the resolution of the file. */
const W0 = SITE.map.w, H0 = SITE.map.h;

interface View { z: number; x: number; y: number; base: number; }

@Component({
  selector: 'app-map-page',
  imports: [RouterLink, TimelinePanel],
  templateUrl: './map-page.html',
  styleUrl: './map-page.css',
  host: { '(window:resize)': 'fit()' },
})
export class MapPage {
  protected readonly site = SITE;
  /** ?p=<place key> opens the map centred on that place. */
  readonly p = input<string>();
  protected readonly data = inject(WikiData);
  private readonly router = inject(Router);

  protected readonly places = computed(() => this.data.extra().map.places);
  protected readonly placeList = computed(() => Object.entries(this.places()).map(([k, p]) => ({ k, p, title: this.data.title(k), linked: !!this.data.get(k) })));

  protected readonly showLands = signal(true);
  protected readonly showCities = signal(true);

  protected readonly popup = signal<string>('');
  protected readonly view = signal<View>({ z: 1, x: 0, y: 0, base: 0.2 });

  private readonly viewEl = viewChild.required<ElementRef<HTMLDivElement>>('view');
  private drag: [number, number] | null = null;
  private moved = false;
  private pending = '';

  constructor() {
    effect(() => { const p = this.p(); if (p) untracked(() => (this.pending = p)); });
  }

  /* ---------- view ---------- */
  protected imageLoaded(): void { this.fit(); }

  fit(): void {
    const el = this.viewEl().nativeElement;
    if (!el.clientWidth) return;
    const base = Math.min(el.clientWidth / W0, el.clientHeight / H0);
    let v: View = { z: 1, base, x: (el.clientWidth - W0 * base) / 2, y: (el.clientHeight - H0 * base) / 2 };
    if (el.clientWidth < 640) v = zoomAt(v, el.clientHeight / (H0 * base), el.clientWidth / 2, el.clientHeight / 2);
    this.view.set(v);
    if (this.pending && this.places()[this.pending]) { const k = this.pending; this.pending = ''; this.centre(this.places()[k], 3); this.popup.set(k); }
  }

  protected px(p: MapPlace): number { const v = this.view(); return v.x + (p.x / 100) * W0 * v.z * v.base; }
  protected py(p: MapPlace): number { const v = this.view(); return v.y + (p.y / 100) * H0 * v.z * v.base; }
  protected readonly w0 = W0;
  protected readonly h0 = H0;
  protected imgTransform(): string { const v = this.view(); return `translate(${v.x}px, ${v.y}px) scale(${v.z * v.base})`; }
  protected labelsOn(): boolean { const v = this.view(); return v.z * v.base * W0 > 2600; }

  protected zoom(f: number, cx?: number, cy?: number): void {
    const el = this.viewEl().nativeElement;
    this.view.set(zoomAt(this.view(), f, cx ?? el.clientWidth / 2, cy ?? el.clientHeight / 2));
  }

  private centre(p: MapPlace, minZ = 0): void {
    const el = this.viewEl().nativeElement;
    const v = { ...this.view() };
    if (minZ && v.z < minZ) v.z = minZ;
    v.x = el.clientWidth / 2 - (p.x / 100) * W0 * v.z * v.base;
    v.y = el.clientHeight / 2 - (p.y / 100) * H0 * v.z * v.base;
    this.view.set(v);
  }

  protected wheel(ev: WheelEvent): void {
    ev.preventDefault();
    const r = this.viewEl().nativeElement.getBoundingClientRect();
    this.zoom(ev.deltaY < 0 ? 1.2 : 1 / 1.2, ev.clientX - r.left, ev.clientY - r.top);
  }
  protected down(ev: PointerEvent): void {
    if ((ev.target as HTMLElement).closest('.pop')) return;
    const v = this.view(); this.drag = [ev.clientX - v.x, ev.clientY - v.y]; this.moved = false;
  }
  protected move(ev: PointerEvent): void {
    if (!this.drag) return;
    const v = this.view(), nx = ev.clientX - this.drag[0], ny = ev.clientY - this.drag[1];
    if (Math.abs(nx - v.x) + Math.abs(ny - v.y) > 3) this.moved = true;
    if (this.moved) this.view.set({ ...v, x: nx, y: ny });
  }
  protected up(): void { this.drag = null; }

  /* ---------- interactions ---------- */
  protected openPlace(k: string): void { if (!this.moved) this.popup.set(this.popup() === k ? '' : k); }
  protected placeTitle(k: string): string { return this.data.title(k); }
  protected summary(k: string): string { return this.data.get(k)?.summary ?? ''; }
  protected linked(k: string): boolean { return !!this.data.get(k); }
  protected goPlace(k: string): void { this.router.navigateByUrl('/' + k); }

  /** Key events of the timeline that happen at the place shown in the popup. */
  protected popupEvents(tl: TimelinePanel): { s: Stop; i: number }[] {
    return tl.stops().map((s, i) => ({ s, i })).filter(({ s }) => s.p === this.popup() && s.key).slice(0, 8);
  }
  /** The timeline moved: close the popup and bring the place back into view if it drifted to the edge. */
  protected onFocus(k: string): void {
    this.popup.set('');
    const p = this.places()[k];
    if (!p || this.view().z <= 1.2) return;
    const el = this.viewEl().nativeElement, x = this.px(p), y = this.py(p);
    if (x < 40 || y < 40 || x > el.clientWidth - 40 || y > el.clientHeight - 40) this.centre(p);
  }
  protected journeyPoints(j: RouteStep[]): string { return j.map((s) => `${this.px(this.places()[s.key])},${this.py(this.places()[s.key])}`).join(' '); }
}

function zoomAt(v: View, f: number, cx: number, cy: number): View {
  const z = Math.min(Math.max(v.z * f, 1), 12);
  return { ...v, z, x: cx - (cx - v.x) * (z / v.z), y: cy - (cy - v.y) * (z / v.z) };
}
