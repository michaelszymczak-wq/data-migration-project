import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell.component';

export const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/home/home.component').then(m => m.HomeComponent),
      },
      {
        path: 'import',
        loadComponent: () =>
          import('./pages/import/import.component').then(m => m.ImportComponent),
      },
      {
        path: 'review',
        loadComponent: () =>
          import('./pages/review/review.component').then(m => m.ReviewComponent),
      },
      {
        path: 'mapping',
        loadComponent: () =>
          import('./pages/mapping/mapping.component').then(m => m.MappingComponent),
      },
      {
        path: 'export',
        loadComponent: () =>
          import('./pages/export/export.component').then(m => m.ExportComponent),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./pages/settings/settings.component').then(m => m.SettingsComponent),
      },
      {
        path: 'inspector',
        loadComponent: () =>
          import('./pages/inspector/inspector.component').then(m => m.InspectorComponent),
      },
      {
        path: 'lot-normalizer',
        loadComponent: () =>
          import('./pages/lot-normalizer/lot-normalizer.component').then(m => m.LotNormalizerComponent),
      },
      {
        path: 'validation',
        loadComponent: () =>
          import('./pages/validation/validation.component').then(m => m.ValidationComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
