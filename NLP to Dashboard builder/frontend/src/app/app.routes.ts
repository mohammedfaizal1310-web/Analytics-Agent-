import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'chat',
    loadComponent: () => import('./features/chat/chat.component').then(m => m.ChatComponent)
  },
  {
    path: 'upload',
    loadComponent: () => import('./features/upload/upload.component').then(m => m.UploadComponent)
  },
  {
    path: 'builder',
    loadComponent: () => import('./features/dashboard-builder/dashboard-builder.component').then(m => m.DashboardBuilderComponent)
  },
  {
    path: 'datasets',
    loadComponent: () => import('./features/datasets/datasets.component').then(m => m.DatasetsComponent)
  },
  { path: '**', redirectTo: '' }
];
