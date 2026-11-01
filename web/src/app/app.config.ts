import { ApplicationConfig, inject, isDevMode, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, withNavigationErrorHandler } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { WikiData } from './core/wiki-data';
import { ScrollMemory } from './core/scroll-memory';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch()),
    // Plain paths (/slug): every article has its own prerendered page for search engines and link previews.
    provideRouter(routes, withComponentInputBinding(),
      // after a redeploy an open tab may ask for page chunks that no longer exist: reload into the new build
      withNavigationErrorHandler((e) => { if (/dynamically imported module|Loading chunk/.test(String(e.error))) location.reload(); })),
    provideAppInitializer(() => inject(WikiData).load()),
    // offline reading and installing as an app; a new deploy is picked up on the next visit
    provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode(), registrationStrategy: 'registerWhenStable:30000' }),
    // back/forward return to the old scroll position; a new page starts at the top
    provideAppInitializer(() => inject(ScrollMemory).init()),
  ],
};
