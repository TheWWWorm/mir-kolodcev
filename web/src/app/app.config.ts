import { ApplicationConfig, inject, isDevMode, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { APP_BASE_HREF } from '@angular/common';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, withNavigationErrorHandler } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { WikiData } from './core/wiki-data';
import { ScrollMemory } from './core/scroll-memory';
import { AppUpdate } from './core/app-update';
import { LOCALE } from './core/locale';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch()),
    // The router uses the language prefix; the HTML base remains / for shared static assets.
    { provide: APP_BASE_HREF, useValue: '/' + LOCALE },
    provideRouter(routes, withComponentInputBinding(),
      // after a redeploy an open tab may ask for page chunks that no longer exist: reload into the new build
      withNavigationErrorHandler((e) => { if (/dynamically imported module|Loading chunk/.test(String(e.error))) location.reload(); })),
    provideAppInitializer(() => inject(WikiData).load()),
    // offline reading and installing as an app
    provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode(), registrationStrategy: 'registerWhenStable:30000' }),
    // a new deploy replaces the cached build in open tabs without a forced refresh
    provideAppInitializer(() => inject(AppUpdate).init()),
    // back/forward return to the old scroll position; a new page starts at the top
    provideAppInitializer(() => inject(ScrollMemory).init()),
  ],
};
