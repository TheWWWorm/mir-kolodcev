import { Injectable, inject } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';

/** A new build that arrives this soon after the page opened replaces it at once: the reader has barely started. */
const FRESH = 10_000;
/** How often an open tab asks whether a new build is out. */
const EVERY = 30 * 60_000;

/**
 * Brings an open or reopened tab to the newest deploy without a forced refresh.
 * The service worker answers from its cache first and only then notices the new build, so on its own
 * the reader sees the old site until the next visit. Here, once the new build is downloaded:
 * right after opening the page is simply reloaded; later the switch waits for the next move to another
 * page (that page is loaded from the new build) or for the tab to come back from the background.
 * A reload keeps the scroll position (ScrollMemory).
 */
@Injectable({ providedIn: 'root' })
export class AppUpdate {
  private readonly sw = inject(SwUpdate);
  private readonly router = inject(Router);
  private readonly opened = Date.now();
  private ready = false;

  init(): void {
    if (!this.sw.isEnabled) return;
    this.sw.versionUpdates.subscribe((e) => {
      if (e.type !== 'VERSION_READY') return;
      this.ready = true;
      if (Date.now() - this.opened < FRESH && scrollY < 80) location.reload();
    });
    // the cached build is broken (files of it are gone from the server): only a reload helps
    this.sw.unrecoverable.subscribe(() => location.reload());

    this.router.events.subscribe((e) => {
      if (!this.ready || !(e instanceof NavigationStart)) return;
      // a back/forward has already put the destination in the address bar; a link click has not yet
      if (e.navigationTrigger === 'popstate') location.reload();
      else location.assign(e.url);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      if (this.ready) location.reload();
      else this.check();
    });
    setInterval(() => { if (document.visibilityState === 'visible') this.check(); }, EVERY);
    this.check();
  }

  private check(): void {
    this.sw.checkForUpdate().catch(() => { /* offline or the worker is not registered yet */ });
  }
}
