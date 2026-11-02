import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { SITE } from '../core/site';
import { Theme } from '../core/theme';
import { WikiData } from '../core/wiki-data';
import { SearchBox } from './search-box';
import { SpoilerSelect } from './spoiler-select';
import { LightboxView } from '../shared/lightbox-view';
import { ReadingDialog } from './reading-dialog';
import { LinkPreview } from './link-preview';
import { OfflineSave } from './offline-save';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SearchBox, SpoilerSelect, LightboxView, ReadingDialog, LinkPreview, OfflineSave],
  host: { '(document:keydown.escape)': 'closeNavigation()' },
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell {
  protected readonly theme = inject(Theme);
  protected readonly navOpen = signal(false);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly menuButton = viewChild<ElementRef<HTMLButtonElement>>('menuButton');

  protected skipToContent(event: Event): void {
    event.preventDefault();
    this.element.nativeElement.querySelector<HTMLElement>('main')?.focus();
  }

  protected closeNavigation(): void {
    if (!this.navOpen()) return;
    this.navOpen.set(false);
    this.menuButton()?.nativeElement.focus();
  }

  protected readonly site = SITE;
  protected readonly nav = SITE.nav;
  protected navIcon(path: string): string {
    if (path.startsWith('http'))
      return 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20';
    if (path.includes('book'))
      return 'M12 5C8 2 3 3 2 4v16c4-2 7-1 10 1 3-2 6-3 10-1V4c-4-2-7-1-10 1Zm0 0v16';
    if (path.includes('character'))
      return 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-3a8 8 0 0 1 16 0v3';
    if (path.includes('house')) return 'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6Z';
    if (path.includes('map') || path.includes('place'))
      return 'M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 1 1 14 0Zm-5 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z';
    if (path.includes('famil'))
      return 'M12 3v7M4 14v-4h16v4M12 10v4M1 14h6v7H1Zm8 0h6v7H9Zm8 0h6v7h-6Z';
    if (path.includes('event') || path.includes('khron') || path.includes('chronology'))
      return 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM12 6v6l4 3';
    if (path.includes('ispytaniya')) return 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01';
    if (path.includes('kto-ty')) return 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-3a8 8 0 0 1 11-7.4M19 14v4M19 22h.01';
    if (path.includes('stratemy')) return 'M3 3h18v18H3ZM3 9h18M3 15h18M9 3v18M15 3v18';
    if (path.includes('novoe')) return 'M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.5 2.5M16.5 16.5 19 19M5 19l2.5-2.5M16.5 7.5 19 5';
    if (path === '/') return 'M3 10 12 3l9 7v11h-6v-7H9v7H3Z';
    return 'M4 4h16v16H4ZM8 8h8M8 12h8M8 16h5';
  }

  constructor() {
    // The first click on blurred spoiler text only reveals it — links inside must not fire until then.
    document.addEventListener('click', (ev) => {
      const blur = (ev.target as Element | null)?.closest?.('.spoil-blur');
      if (!blur) return;
      ev.preventDefault();
      ev.stopPropagation();
      blur.classList.remove('spoil-blur');
    }, true);
    // Plain links in generated HTML (article text, search suggestions, 3D labels) go through the router
    // instead of reloading the page; routerLink handles its own clicks and marks them defaultPrevented.
    const router = inject(Router);
    document.addEventListener('click', (ev) => {
      const a = (ev.target as Element | null)?.closest?.('a');
      const href = a?.getAttribute('href');
      if (ev.defaultPrevented || ev.button || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      if (!href?.startsWith('/') || href.startsWith('//') || a!.target || a!.hasAttribute('download')) return;
      ev.preventDefault();
      router.navigateByUrl(href);
    });
    // keep the description and canonical address in step with the page, as the prerendered copy has them
    const meta = inject(Meta), data = inject(WikiData);
    const about = meta.getTag('name="description"')?.content ?? '';
    const canonical = document.head.querySelector<HTMLLinkElement>('link[rel=canonical]');
    router.events.subscribe((e) => {
      if (!(e instanceof NavigationEnd)) return;
      this.navOpen.set(false);
      const path = e.urlAfterRedirects.split(/[?#]/)[0];
      // an article section (/slug/anchor) belongs to the article's page
      const article = data.get(path.split('/')[1]);
      meta.updateTag({ name: 'description', content: article?.summary || about });
      if (canonical) canonical.href = location.origin + (article ? '/' + article.slug : path);
    });
  }
}
