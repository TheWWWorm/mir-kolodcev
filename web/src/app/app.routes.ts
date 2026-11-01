import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { WikiData } from './core/wiki-data';
import { SITE, pageTitle } from './core/site';
import { SITE_ROUTES } from './site-routes';

const randomArticle = () => {
  const all = inject(WikiData).articles();
  return inject(Router).parseUrl('/' + all[Math.floor(Math.random() * all.length)].slug);
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
    title: pageTitle('Все статьи'),
    loadComponent: () => import('./pages/all-articles/all-articles').then((m) => m.AllArticlesPage),
  },
  {
    path: 'map',
    title: pageTitle('Карта'),
    loadComponent: () => import('./pages/map/map-page').then((m) => m.MapPage),
  },
  {
    path: 'map3d',
    title: pageTitle('3D-карта'),
    loadComponent: () => import('./pages/map3d/map3d-page').then((m) => m.Map3dPage),
  },
  {
    path: 'gallery',
    title: pageTitle('Галерея'),
    loadComponent: () => import('./pages/gallery/gallery').then((m) => m.GalleryPage),
  },
  ...(SITE.features.families
    ? [
        {
          path: 'families',
          title: pageTitle('Родословные'),
          loadComponent: () => import('./pages/families/families').then((m) => m.FamiliesPage),
        },
      ]
    : []),
  {
    path: 'relations',
    title: pageTitle('Связи персонажей'),
    loadComponent: () => import('./pages/relations/relations').then((m) => m.RelationsPage),
  },
  {
    path: 'ispytaniya',
    title: pageTitle('Испытания'),
    loadComponent: () => import('./pages/quiz/quiz-page').then((m) => m.QuizPage),
  },
  {
    path: 'chronology',
    data: { type: 'event' },
    loadComponent: () => import('./pages/category/category').then((m) => m.CategoryPage),
  },
  {
    path: 'novoe',
    title: pageTitle('Что нового'),
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
    title: pageTitle('Поиск'),
    loadComponent: () => import('./pages/search/search-page').then((m) => m.SearchPage),
  },
  {
    path: ':slug',
    loadComponent: () => import('./pages/article/article').then((m) => m.ArticlePage),
  },
  {
    path: ':slug/:anchor',
    loadComponent: () => import('./pages/article/article').then((m) => m.ArticlePage),
  },
];
