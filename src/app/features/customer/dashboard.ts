import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { BankApi } from '../../core/bank-api';
import { problemMessage } from '../../core/http.interceptors';
import { Account, Transaction } from '../../core/models';
import { AccountSlab } from '../../shared/account-slab';
import { Icon } from '../../shared/icon';
import { TxnTable } from '../../shared/txn-table';

const SHADES = ['#0f4c43', '#b8892f', '#3f7d70', '#d9b56a'];

@Component({
  selector: 'nb-customer-dashboard',
  imports: [CurrencyPipe, DecimalPipe, RouterLink, AccountSlab, Icon, TxnTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ greeting() }}, {{ firstName() }}</h1>
          <p>Here is where your money stands today.</p>
        </div>
        <div class="actions">
          <a class="btn btn-secondary" routerLink="/app/accounts"><nb-icon name="plus" /> Open account</a>
          <a class="btn btn-primary" routerLink="/app/transfer"><nb-icon name="transfer" /> Move money</a>
        </div>
      </div>

      @if (error()) { <div class="alert alert-error">{{ error() }}</div> }

      <section class="hero panel">
        <div class="hero-main">
          <span class="muted">Total balance across {{ accounts().length }} {{ accounts().length === 1 ? 'account' : 'accounts' }}</span>
          @if (loading()) {
            <div class="skeleton" style="height: 64px; width: 320px; margin-top: 10px"></div>
          } @else {
            <div class="total serif">
              <span class="cur">$</span>{{ whole() }}<span class="cents">.{{ cents() }}</span>
            </div>
          }
          <div class="flow">
            <span><span class="credit">+{{ moneyIn() | currency }}</span> in</span>
            <span><span>−{{ moneyOut() | currency }}</span> out</span>
            <span class="muted">last 30 days</span>
          </div>
        </div>
        @if (accounts().length > 1) {
          <div class="split">
            <div class="bar" role="img" aria-label="How your balance is split between accounts">
              @for (s of split(); track s.no) {
                <span [style.width.%]="s.pct" [style.background]="s.color"></span>
              }
            </div>
            <ul>
              @for (s of split(); track s.no) {
                <li><i [style.background]="s.color"></i>{{ s.label }} <b class="num">{{ s.pct | number: '1.0-0' }}%</b></li>
              }
            </ul>
          </div>
        }
      </section>

      <div class="slabs">
        @for (a of accounts(); track a.id) { <nb-account-slab [account]="a" /> }
      </div>

      <section class="panel">
        <div class="panel-head">
          <h2>Recent activity</h2>
          <a class="btn btn-link" routerLink="/app/transactions">All transactions</a>
        </div>
        <nb-txn-table [rows]="recent()" [compact]="true" />
      </section>
    </div>
  `,
  styles: `
    .actions { display: flex; gap: 10px; }
    .hero { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 32px; padding: 28px 30px; margin-bottom: 20px; align-items: end; }
    .total { font-size: clamp(2.6rem, 5vw, 3.9rem); line-height: 1.05; margin: 8px 0 14px; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
    .cur { font-size: 0.5em; vertical-align: 0.75em; margin-right: 4px; color: var(--muted); }
    .cents { font-size: 0.5em; color: var(--muted); }
    .flow { display: flex; gap: 20px; flex-wrap: wrap; font-size: 0.9rem; }
    .flow b, .flow span span { font-weight: 500; font-variant-numeric: tabular-nums; }
    .bar { display: flex; height: 12px; border-radius: 6px; overflow: hidden; gap: 2px; background: var(--paper); }
    ul { list-style: none; padding: 0; margin: 14px 0 0; display: grid; gap: 8px; font-size: 0.88rem; }
    li { display: flex; align-items: center; gap: 8px; }
    li i { width: 9px; height: 9px; border-radius: 2px; }
    li b { margin-left: auto; font-weight: 500; }
    .slabs { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; margin-bottom: 20px; }
    @media (max-width: 960px) { .hero { grid-template-columns: 1fr; padding: 22px; } .actions { width: 100%; } .actions .btn { flex: 1; } }
  `,
})
export class CustomerDashboard {
  private readonly api = inject(BankApi);
  private readonly auth = inject(AuthService);

  protected readonly accounts = signal<Account[]>([]);
  protected readonly txns = signal<Transaction[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly firstName = computed(() => this.auth.user()?.fullName.split(' ')[0] ?? '');
  protected readonly greeting = computed(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  });
  private readonly total = computed(() => this.accounts().filter((a) => a.status !== 'CLOSED').reduce((s, a) => s + a.balance, 0));
  protected readonly whole = computed(() => Math.floor(this.total()).toLocaleString('en-US'));
  protected readonly cents = computed(() => Math.round((this.total() % 1) * 100).toString().padStart(2, '0'));
  protected readonly recent = computed(() => this.txns().slice(0, 7));

  private readonly last30 = computed(() => {
    const since = Date.now() - 30 * 86_400_000;
    return this.txns().filter((t) => t.status === 'COMPLETED' && Date.parse(t.createdAt) >= since);
  });
  protected readonly moneyIn = computed(() => this.last30().filter((t) => t.direction === 'CREDIT').reduce((s, t) => s + t.amount, 0));
  protected readonly moneyOut = computed(() => this.last30().filter((t) => t.direction === 'DEBIT').reduce((s, t) => s + t.amount, 0));

  protected readonly split = computed(() => {
    const total = this.total() || 1;
    return this.accounts().filter((a) => a.status !== 'CLOSED').map((a, i) => ({
      no: a.accountNumber,
      label: `${a.accountType === 'SAVINGS' ? 'Savings' : 'Checking'} •••• ${a.accountNumber.slice(-4)}`,
      pct: (a.balance / total) * 100,
      color: SHADES[i % SHADES.length],
    }));
  });

  constructor() {
    forkJoin({ accounts: this.api.myAccounts(), txns: this.api.history({ size: 50 }) }).subscribe({
      next: ({ accounts, txns }) => {
        this.accounts.set(accounts);
        this.txns.set(txns.content);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(problemMessage(err));
        this.loading.set(false);
      },
    });
  }
}
