import { Injectable, inject } from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';

/**
 * Where each page was scrolled to, so back and forward return the reader to the same spot.
 * Article text arrives after the navigation ends, so the position is re-applied until the page has settled,
 * and given up as soon as the reader scrolls themselves.
 * A new page starts at the top, except a link to a section (/slug/anchor): the article scrolls there
 * itself, and a scroll to the top first would make the page jump up and back down.
 */
@Injectable({ providedIn: 'root' })
export class ScrollMemory {
  private readonly router = inject(Router);
  /** Scroll positions by the router's navigation id, which is kept in each history entry. */
  private readonly saved = new Map<number, number>();
  private last = 0;
  private target: number | undefined;
  private stop: (() => void) | undefined;

  /** True while a back/forward navigation is still bringing the page back to its old position. */
  get restoring(): boolean { return this.stop != null; }

  init(): void {
    history.scrollRestoration = 'manual';
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationStart) {
        this.cancel();
        this.saved.set(this.last, scrollY);
        this.target = e.navigationTrigger === 'popstate' && e.restoredState
          ? this.saved.get(e.restoredState.navigationId) : undefined;
      } else if (e instanceof NavigationEnd) {
        this.last = e.id;
        if (this.target != null) this.restore(this.target);
        else if (!this.hasAnchor()) window.scrollTo(0, 0);
      }
    });
  }

  private hasAnchor(): boolean {
    let r = this.router.routerState.snapshot.root;
    while (r.firstChild) r = r.firstChild;
    return r.paramMap.has('anchor');
  }

  private restore(y: number): void {
    const root = document.documentElement;
    const start = performance.now();
    let frame = 0, height = 0, steady = start;
    const tick = () => {
      window.scrollTo(0, y);
      const now = performance.now();
      if (root.scrollHeight !== height) { height = root.scrollHeight; steady = now; }
      // done once the position is reached and the page has settled: nothing marked as loading
      // (aria-busy, as the article text while it is fetched) and no change in height for a moment
      const settled = Math.abs(scrollY - y) < 2 && !document.querySelector('[aria-busy="true"]') && now - steady > 250;
      if (settled || now - start > 5000) return this.cancel();
      frame = requestAnimationFrame(tick);
    };
    const input = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
    const byReader = () => this.cancel();
    for (const t of input) addEventListener(t, byReader, { passive: true });
    // the browser's scroll anchoring would follow an element on the half-built page as text fills in above it
    root.style.overflowAnchor = 'none';
    this.stop = () => {
      cancelAnimationFrame(frame);
      for (const t of input) removeEventListener(t, byReader);
      root.style.overflowAnchor = '';
    };
    tick();
  }

  private cancel(): void {
    this.stop?.();
    this.stop = undefined;
  }
}
