import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { BankApi } from '../../core/bank-api';
import { problemMessage } from '../../core/http.interceptors';
import { SystemHealth } from '../../core/models';
import { StatusBadge } from '../../shared/status-badge';

const ABOUT: Record<string, string> = {
  'auth-service': 'Sign in, registration, profiles. Schema NB_AUTH.',
  'account-service': 'Accounts and balances. Schema NB_ACCT.',
  'transaction-service': 'Transfers, deposits, history. Schema NB_TXN.',
};

@Component({
  selector: 'nb-system-status',
  imports: [DatePipe, StatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>System status</h1>
          <p>The gateway checks each service's health endpoint, which also checks its Db2 connection.</p>
        </div>
        <button class="btn btn-secondary" (click)="check()" [disabled]="busy()">{{ busy() ? 'Checking…' : 'Check again' }}</button>
      </div>
      @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
      @if (health(); as h) {
        <div class="overall panel" [class.bad]="h.overall !== 'UP'">
          <nb-status [value]="h.overall" />
          <span>{{ h.overall === 'UP' ? 'All services are healthy.' : 'At least one service is not responding.' }}</span>
          <span class="muted small">Checked {{ h.checkedAt | date: 'mediumTime' }} in the {{ env }} environment</span>
        </div>
        <div class="grid grid-3">
          @for (s of h.services; track s.service) {
            <div class="panel svc">
              <div class="row"><h2>{{ s.service }}</h2><nb-status [value]="s.status" /></div>
              <p class="muted small">{{ about(s.service) }}</p>
              <div class="lat"><span class="serif">{{ s.latencyMs }}</span> ms response</div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .overall { display: flex; align-items: center; gap: 14px; padding: 16px 20px; margin-bottom: 20px; flex-wrap: wrap; border-left: 3px solid var(--credit); }
    .overall.bad { border-left-color: var(--debit); }
    .overall .small { margin-left: auto; }
    .svc { padding: 20px; }
    .row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .lat { margin-top: 18px; color: var(--muted); font-size: 0.88rem; }
    .lat .serif { font-size: 1.6rem; color: var(--ink); font-variant-numeric: tabular-nums; }
  `,
})
export class SystemStatus {
  private readonly api = inject(BankApi);
  protected readonly health = signal<SystemHealth | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly env = environment.envName;

  constructor() {
    this.check();
  }

  protected about(name: string): string {
    return ABOUT[name] ?? '';
  }

  check(): void {
    this.busy.set(true);
    this.api.systemHealth().subscribe({
      next: (h) => { this.health.set(h); this.error.set(null); this.busy.set(false); },
      error: (e) => { this.error.set(problemMessage(e)); this.busy.set(false); },
    });
  }
}
