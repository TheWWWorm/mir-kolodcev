import { inject } from '@angular/core';
import { CanActivateFn, RedirectCommand, Router, Routes } from '@angular/router';
import { WikiData } from './core/wiki-data';
import { SITE, pageTitle, sectionTitle } from './core/site';
import { t } from './core/locale';
import { SITE_ROUTES } from './site-routes';

const randomArticle = () => {
  const all = inject(WikiData).articles();
  return inject(Router).parseUrl('/' + all[Math.floor(Math.random() * all.length)].slug);
};

const articleAlias: CanActivateFn = (route, state) => {
  const aliases = inject(WikiData).aliases();
  const slug = route.paramMap.get('slug')!;
  if (!Object.hasOwn(aliases, slug)) return true;
  const target = state.url.replace(/^\/[^/?#]+/, '/' + aliases[slug]);
  return new RedirectCommand(inject(Router).parseUrl(target), { replaceUrl: true });
};

export const routes: Routes = [
  {
    path: '',
    title: SITE.name,
    loadComponent: () => import('./pages/home/home').then((m) => m.HomePage),
  },
  { path: 'random', canActivate: [randomArticle], children: [] },
  {
    path: 'all',
    title: sectionTitle('all'),
    loadComponent: () => import('./pages/all-articles/all-articles').then((m) => m.AllArticlesPage),
  },
  {
    path: 'map',
    title: sectionTitle('map'),
    loadComponent: () => import('./pages/map/map-page').then((m) => m.MapPage),
  },
  {
    path: 'map3d',
    title: sectionTitle('map3d'),
    loadComponent: () => import('./pages/map3d/map3d-page').then((m) => m.Map3dPage),
  },
  {
    path: 'gallery',
    title: sectionTitle('gallery'),
    loadComponent: () => import('./pages/gallery/gallery').then((m) => m.GalleryPage),
  },
  ...(SITE.features.families
    ? [
        {
          path: 'families',
          title: sectionTitle('families'),
          loadComponent: () => import('./pages/families/families').then((m) => m.FamiliesPage),
        },
      ]
    : []),
  {
    path: 'relations',
    title: sectionTitle('relations'),
    loadComponent: () => import('./pages/relations/relations').then((m) => m.RelationsPage),
  },
  {
    path: 'ispytaniya',
    title: sectionTitle('ispytaniya'),
    loadComponent: () => import('./pages/quiz/quiz-page').then((m) => m.QuizPage),
  },
  {
    path: 'kto-ty',
    title: sectionTitle('kto-ty'),
    loadComponent: () => import('./pages/persona/persona-page').then((m) => m.PersonaPage),
  },
  {
    path: 'chronology',
    data: { type: 'event' },
    loadComponent: () => import('./pages/category/category').then((m) => m.CategoryPage),
  },
  {
    path: 'novoe',
    title: sectionTitle('novoe'),
    loadComponent: () => import('./pages/changes/changes').then((m) => m.ChangesPage),
  },
  {
    path: 'c/:type',
    loadComponent: () => import('./pages/category/category').then((m) => m.CategoryPage),
  },
  // pages only one wiki has (src/app/site-routes.ts of the site)
  ...SITE_ROUTES,
  {
    path: 'search/:q',
    title: pageTitle(t('Поиск', 'Search')),
    loadComponent: () => import('./pages/search/search-page').then((m) => m.SearchPage),
  },
  {
    path: ':slug',
    canActivate: [articleAlias],
    loadComponent: () => import('./pages/article/article').then((m) => m.ArticlePage),
  },
  {
    path: ':slug/:anchor',
    canActivate: [articleAlias],
    loadComponent: () => import('./pages/article/article').then((m) => m.ArticlePage),
  },
];
