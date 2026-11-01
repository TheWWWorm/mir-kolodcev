import { Injectable, signal } from '@angular/core';
import { SITE } from './site';

const KEY = `${SITE.key}.theme`;

@Injectable({ providedIn: 'root' })
export class Theme {
  readonly theme = signal<'light' | 'dark' | ''>(read());

  constructor() {
    this.apply();
  }

  toggle(): void {
    const dark = this.theme() ? this.theme() === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    this.theme.set(dark ? 'light' : 'dark');
    try { localStorage.setItem(KEY, this.theme()); } catch { /* ignore */ }
    this.apply();
  }

  private apply(): void {
    const t = this.theme();
    if (t) document.documentElement.dataset['theme'] = t;
    else delete document.documentElement.dataset['theme'];
  }
}

function read(): 'light' | 'dark' | '' {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : ''; } catch { return ''; }
}
