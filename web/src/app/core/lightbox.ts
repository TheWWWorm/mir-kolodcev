import { Injectable, signal } from '@angular/core';

/** Index of the image shown full-screen, or null. */
@Injectable({ providedIn: 'root' })
export class Lightbox {
  readonly current = signal<number | null>(null);
  open(i: number): void { this.current.set(i); }
  close(): void { this.current.set(null); }
}
