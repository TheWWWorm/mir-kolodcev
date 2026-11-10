import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { ENTRY } from './app/core/locale';

// Normalize legacy addresses before Angular starts. Assets still resolve from the site's root.
if (ENTRY.path !== location.pathname + location.search + location.hash) {
  history.replaceState(history.state, '', ENTRY.path);
}
document.documentElement.lang = ENTRY.locale;

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
