import { Injectable, inject } from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';

/** Key of the scroll position in the state of each history entry. */
const KEY = 'scrollY';
/** Wait after scrolling stops before recording the position (browsers limit how often history may be rewritten). */
const SETTLE = 150;

/**
 * Where each page was scrolled to, so back, forward and a reload return the reader to the same spot.
 * The position lives in the page's own history entry, which the browser keeps across a reload and
 * which knows nothing of the router's navigation ids (those start again after a reload).
 * Article text arrives after the navigation ends, so the position is re-applied until the page has settled,
 * and given up as soon as the reader scrolls themselves.
 * A new page starts at the top, except a link to a section (/slug/anchor): the article scrolls there
 * itself, and a scroll to the top first would make the page jump up and back down.
 */
@Injectable({ providedIn: 'root' })
export class ScrollMemory {
  private readonly router = inject(Router);
  private target: number | undefined;
  private stop: (() => void) | undefined;
  private pending: ReturnType<typeof setTimeout> | undefined;

  /** True while a back/forward navigation or a reload is still bringing the page back to its old position. */
  get restoring(): boolean { return this.stop != null; }

  init(): void {
    history.scrollRestoration = 'manual';
    let first = true;
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationStart) {
        this.cancel();
        // a popstate has already switched history to the destination entry: its state holds the position;
        // a link click still sits on the page being left: record where it was before the router moves on
        if (e.navigationTrigger === 'popstate' || first) {
          const y = history.state?.[KEY];
          this.target = typeof y === 'number' ? y : undefined;
        } else {
          this.record();
          this.target = undefined;
        }
        first = false;
      } else if (e instanceof NavigationEnd) {
        if (this.target != null) this.restore(this.target);
        else if (!this.hasAnchor()) window.scrollTo(0, 0);
      }
    });
    addEventListener('scroll', () => {
      if (this.restoring) return;
      clearTimeout(this.pending);
      this.pending = setTimeout(() => this.record(), SETTLE);
    }, { passive: true });
    // a reload or a closed tab straight after scrolling
    addEventListener('pagehide', () => this.record());
  }

  /** Writes the current position into the current history entry, keeping the router's own state. */
  private record(): void {
    clearTimeout(this.pending);
    if (this.restoring || history.state?.[KEY] === scrollY) return;
    try {
      history.replaceState({ ...history.state, [KEY]: scrollY }, '');
    } catch { /* too many history updates: the next scroll tries again */ }
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
    const was = this.stop;
    this.stop?.();
    this.stop = undefined;
    // the page now sits where the restore left it (or where the reader took it): keep that
    if (was) this.record();
  }
}
