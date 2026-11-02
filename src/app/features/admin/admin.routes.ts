import { Routes } from '@angular/router';
import { NavItem, Shell } from '../../layout/shell';

const NAV: NavItem[] = [
  { label: 'Overview', path: '/admin', icon: 'chart', exact: true },
  { label: 'Customers', path: '/admin/customers', icon: 'users' },
  { label: 'Accounts', path: '/admin/accounts', icon: 'accounts' },
  { label: 'Transactions', path: '/admin/transactions', icon: 'list' },
  { label: 'System status', path: '/admin/system', icon: 'pulse' },
  { label: 'My profile', path: '/admin/profile', icon: 'user' },
];

/** Admin module: lazy loaded, only reachable with role ADMIN. */
export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: Shell,
    data: { variant: 'admin', nav: NAV },
    children: [
      { path: '', title: 'Operations | NovaBank', loadComponent: () => import('./admin-dashboard').then((m) => m.AdminDashboard) },
      { path: 'customers', title: 'Customers | NovaBank', loadComponent: () => import('./customers').then((m) => m.Customers) },
      { path: 'accounts', title: 'Accounts | NovaBank', loadComponent: () => import('./admin-accounts').then((m) => m.AdminAccounts) },
      { path: 'transactions', title: 'Transactions | NovaBank', loadComponent: () => import('./admin-transactions').then((m) => m.AdminTransactions) },
      { path: 'system', title: 'System status | NovaBank', loadComponent: () => import('./system-status').then((m) => m.SystemStatus) },
      { path: 'profile', title: 'Profile | NovaBank', loadComponent: () => import('../customer/profile').then((m) => m.Profile) },
    ],
  },
];
