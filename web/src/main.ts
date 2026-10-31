import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Links shared before the move to plain paths look like /#/slug: turn them into /slug before the router starts.
if (location.hash.startsWith('#/')) history.replaceState(null, '', location.hash.slice(1));

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
