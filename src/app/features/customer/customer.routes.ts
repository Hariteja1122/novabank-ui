import { Routes } from '@angular/router';
import { NavItem, Shell } from '../../layout/shell';

const NAV: NavItem[] = [
  { label: 'Overview', path: '/app', icon: 'home', exact: true },
  { label: 'Accounts', path: '/app/accounts', icon: 'accounts' },
  { label: 'Move money', path: '/app/transfer', icon: 'transfer' },
  { label: 'Transactions', path: '/app/transactions', icon: 'list' },
  { label: 'Profile', path: '/app/profile', icon: 'user' },
];

/** User module: lazy loaded, only reachable with role CUSTOMER. */
export const CUSTOMER_ROUTES: Routes = [
  {
    path: '',
    component: Shell,
    data: { variant: 'customer', nav: NAV },
    children: [
      { path: '', title: 'Overview | NovaBank', loadComponent: () => import('./dashboard').then((m) => m.CustomerDashboard) },
      { path: 'accounts', title: 'Accounts | NovaBank', loadComponent: () => import('./accounts').then((m) => m.Accounts) },
      { path: 'accounts/:accountNumber', title: 'Account | NovaBank', loadComponent: () => import('./account-detail').then((m) => m.AccountDetail) },
      { path: 'transfer', title: 'Move money | NovaBank', loadComponent: () => import('./transfer').then((m) => m.Transfer) },
      { path: 'transactions', title: 'Transactions | NovaBank', loadComponent: () => import('./transactions').then((m) => m.Transactions) },
      { path: 'profile', title: 'Profile | NovaBank', loadComponent: () => import('./profile').then((m) => m.Profile) },
    ],
  },
];
