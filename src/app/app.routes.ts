import { Routes } from '@angular/router';
import { guestGuard, roleGuard } from './core/guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', title: 'Sign in | NovaBank', canActivate: [guestGuard], loadComponent: () => import('./pages/login').then((m) => m.Login) },
  { path: 'register', title: 'Open an account | NovaBank', canActivate: [guestGuard], loadComponent: () => import('./pages/register').then((m) => m.Register) },
  { path: 'app', canActivate: [roleGuard('CUSTOMER')], loadChildren: () => import('./features/customer/customer.routes').then((m) => m.CUSTOMER_ROUTES) },
  { path: 'admin', canActivate: [roleGuard('ADMIN')], loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES) },
  { path: '**', redirectTo: 'login' },
];
