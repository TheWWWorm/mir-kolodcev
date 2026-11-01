import { Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';

/**
 * Index of the image shown full-screen, or null.
 * An open image takes its own history entry, so the back gesture closes it instead of leaving the page
 * underneath; leaving the page in any other way closes it too.
 */
@Injectable({ providedIn: 'root' })
export class Lightbox {
  readonly current = signal<number | null>(null);
  /** The router's id of the page on screen: a lightbox entry left from an earlier visit is not reopened. */
  private page: number | undefined;

  constructor() {
    inject(Router).events.subscribe((e) => {
      if (e instanceof NavigationStart) this.current.set(null);
      if (e instanceof NavigationEnd) this.page = history.state?.navigationId;
    });
    // back from the image closes it; forward onto it shows it again
    addEventListener('popstate', (e) => {
      const st = e.state;
      this.current.set(st?.lightbox != null && st.navigationId === this.page ? st.lightbox : null);
    });
  }

  open(i: number): void {
    const st = { ...history.state, lightbox: i };
    if (history.state?.lightbox != null) history.replaceState(st, '');
    else history.pushState(st, '');
    this.current.set(i);
  }

  close(): void {
    if (this.current() == null) return;
    // drop the image's history entry; the popstate above then hides it
    if (history.state?.lightbox != null) history.back();
    else this.current.set(null);
  }
}
