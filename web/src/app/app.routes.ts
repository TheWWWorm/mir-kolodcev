import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { WikiData } from './core/wiki-data';

const randomArticle = () => {
  const all = inject(WikiData).articles();
  return inject(Router).parseUrl('/' + all[Math.floor(Math.random() * all.length)].slug);
};

export const routes: Routes = [
  {
    path: '',
    title: 'Мир колодцев · Вики',
    loadComponent: () => import('./pages/home/home').then((m) => m.HomePage),
  },
  { path: 'random', canActivate: [randomArticle], children: [] },
  {
    path: 'all',
    title: 'Все статьи · Мир колодцев · Вики',
    loadComponent: () => import('./pages/all-articles/all-articles').then((m) => m.AllArticlesPage),
  },
  {
    path: 'map',
    title: 'Карта · Мир колодцев · Вики',
    loadComponent: () => import('./pages/map/map-page').then((m) => m.MapPage),
  },
  {
    path: 'map3d',
    title: '3D-карта · Мир колодцев · Вики',
    loadComponent: () => import('./pages/map3d/map3d-page').then((m) => m.Map3dPage),
  },
  {
    path: 'gallery',
    title: 'Галерея · Мир колодцев · Вики',
    loadComponent: () => import('./pages/gallery/gallery').then((m) => m.GalleryPage),
  },
  {
    path: 'families',
    title: 'Родословные · Мир колодцев · Вики',
    loadComponent: () => import('./pages/families/families').then((m) => m.FamiliesPage),
  },
  {
    path: 'relations',
    title: 'Связи персонажей · Мир колодцев · Вики',
    loadComponent: () => import('./pages/relations/relations').then((m) => m.RelationsPage),
  },
  {
    path: 'ispytaniya',
    title: 'Испытания · Мир колодцев · Вики',
    loadComponent: () => import('./pages/quiz/quiz-page').then((m) => m.QuizPage),
  },
  {
    path: 'chronology',
    data: { type: 'event' },
    loadComponent: () => import('./pages/category/category').then((m) => m.CategoryPage),
  },
  {
    path: 'c/:type',
    loadComponent: () => import('./pages/category/category').then((m) => m.CategoryPage),
  },
  {
    path: 'search/:q',
    title: 'Поиск · Мир колодцев · Вики',
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
