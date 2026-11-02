import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService } from '../core/auth.service';
import { Icon } from '../shared/icon';

export interface NavItem {
  label: string;
  path: string;
  icon: string;
  exact?: boolean;
}

/** App frame shared by the customer app and the operations console. */
@Component({
  selector: 'nb-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="frame" [class.admin]="variant() === 'admin'">
      <aside class="side">
        <a class="brand" [routerLink]="home()">
          <span class="mark">N</span>
          <span>
            <strong>NovaBank</strong>
            <small>{{ variant() === 'admin' ? 'Operations console' : 'Personal banking' }}</small>
          </span>
        </a>
        <nav aria-label="Main">
          @for (item of nav(); track item.path) {
            <a [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: !!item.exact }">
              <nb-icon [name]="item.icon" />
              <span>{{ item.label }}</span>
            </a>
          }
        </nav>
        <div class="who">
          <span class="avatar">{{ initials() }}</span>
          <span class="who-text">
            <strong>{{ auth.user()?.fullName }}</strong>
            <small>{{ auth.user()?.email }}</small>
          </span>
          <button class="out" type="button" (click)="auth.logout()" aria-label="Sign out" title="Sign out">
            <nb-icon name="logout" />
          </button>
        </div>
      </aside>
      <main>
        @if (envBanner) {
          <div class="env">{{ envBanner }}</div>
        }
        <router-outlet />
      </main>
    </div>
  `,
  styles: `
    .frame { display: grid; grid-template-columns: 252px minmax(0, 1fr); min-height: 100vh; background: linear-gradient(to right, var(--ledger-deep) 252px, transparent 252px); }
    .frame.admin { background: linear-gradient(to right, var(--slate) 252px, transparent 252px); }
    .side { position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column; background: var(--ledger-deep); color: #d5e3df; padding: 22px 14px 16px; }
    .admin .side { background: var(--slate); }
    .brand { display: flex; align-items: center; gap: 12px; padding: 0 8px 26px; color: #fff; text-decoration: none; }
    .brand strong { display: block; font-size: 1.05rem; letter-spacing: -0.01em; }
    .brand small { display: block; font-size: 0.78rem; color: #9fb5ae; }
    .mark { width: 34px; height: 34px; border-radius: 8px; display: grid; place-items: center; background: var(--brass); color: var(--ledger-deep); font-family: var(--serif); font-size: 1.15rem; font-weight: 500; }
    nav { display: grid; gap: 2px; }
    nav a { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 7px; color: #c3d3ce; text-decoration: none; font-size: 0.93rem; position: relative; }
    nav a:hover { background: rgba(255, 255, 255, 0.06); color: #fff; }
    nav a.active { background: rgba(255, 255, 255, 0.09); color: #fff; }
    nav a.active::before { content: ''; position: absolute; left: -14px; top: 9px; bottom: 9px; width: 3px; border-radius: 0 3px 3px 0; background: var(--brass); }
    .who { margin-top: auto; display: flex; align-items: center; gap: 10px; padding: 14px 8px 0; border-top: 1px solid rgba(255, 255, 255, 0.1); }
    .avatar { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: rgba(255, 255, 255, 0.12); color: #fff; font-size: 0.8rem; font-weight: 600; flex: none; }
    .who-text { min-width: 0; flex: 1; }
    .who-text strong { display: block; color: #fff; font-size: 0.86rem; font-weight: 500; }
    .who-text small { display: block; color: #93aaa3; font-size: 0.75rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .out { background: none; border: 0; color: #b5c8c2; cursor: pointer; padding: 6px; border-radius: 6px; }
    .out:hover { color: #fff; background: rgba(255, 255, 255, 0.08); }
    main { min-width: 0; }
    .env { background: var(--brass-tint); color: var(--warn); font-size: 0.82rem; padding: 7px 36px; border-bottom: 1px solid #ecdcb5; }
    @media (max-width: 960px) {
      .frame, .frame.admin { grid-template-columns: 1fr; background: none; }
      .side { position: static; height: auto; padding: 14px 16px 8px; }
      .brand { padding: 0 0 12px; }
      nav { display: flex; overflow-x: auto; gap: 4px; padding-bottom: 6px; }
      nav a { flex: none; padding: 8px 12px; }
      nav a.active::before { display: none; }
      .who { display: none; }
      .env { padding: 7px 16px; }
    }
  `,
})
export class Shell {
  protected readonly auth = inject(AuthService);
  readonly variant = input<'customer' | 'admin'>('customer');
  readonly nav = input.required<NavItem[]>();
  protected readonly home = computed(() => (this.variant() === 'admin' ? '/admin' : '/app'));
  protected readonly initials = computed(() =>
    (this.auth.user()?.fullName ?? '').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase(),
  );
  protected readonly envBanner = environment.mock
    ? 'Demo mode: sample data in your browser. Changes reset when you reload.'
    : null;
}
