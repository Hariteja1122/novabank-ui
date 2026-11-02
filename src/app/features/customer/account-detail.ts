import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BankApi } from '../../core/bank-api';
import { problemMessage } from '../../core/http.interceptors';
import { Account, Page, Transaction } from '../../core/models';
import { AccountNumberPipe } from '../../shared/format';
import { Pager } from '../../shared/pager';
import { StatusBadge } from '../../shared/status-badge';
import { TxnTable } from '../../shared/txn-table';

@Component({
  selector: 'nb-account-detail',
  imports: [CurrencyPipe, DatePipe, RouterLink, AccountNumberPipe, Pager, StatusBadge, TxnTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <a class="btn btn-link back" routerLink="/app/accounts">All accounts</a>
      @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
      @if (account(); as a) {
        <section class="panel head">
          <div>
            <div class="title">
              <h1>{{ a.accountType === 'SAVINGS' ? 'Savings' : 'Checking' }}</h1>
              <nb-status [value]="a.status" />
            </div>
            <dl>
              <div><dt>Account number</dt><dd class="num">{{ a.accountNumber | acct }}</dd></div>
              <div><dt>Opened</dt><dd>{{ a.openedAt | date: 'mediumDate' }}</dd></div>
              <div><dt>Currency</dt><dd>{{ a.currency }}</dd></div>
            </dl>
          </div>
          <div class="bal">
            <span class="muted">Available balance</span>
            <div class="serif">{{ a.balance | currency: a.currency }}</div>
            @if (a.status === 'ACTIVE') {
              <a class="btn btn-primary" routerLink="/app/transfer" [queryParams]="{ from: a.accountNumber }">Move money</a>
            } @else {
              <p class="small muted">This account is {{ a.status.toLowerCase() }}. Contact support to reactivate it.</p>
            }
          </div>
        </section>
      }
      <section class="panel">
        <div class="panel-head"><h2>Activity</h2></div>
        <nb-txn-table [rows]="page()?.content ?? []" />
        <nb-pager [page]="pageNo()" [size]="20" [total]="page()?.page?.totalElements ?? 0" [pages]="page()?.page?.totalPages ?? 1" (go)="load($event)" />
      </section>
    </div>
  `,
  styles: `
    .back { margin-bottom: 14px; }
    .head { display: flex; justify-content: space-between; gap: 24px; padding: 26px 28px; margin-bottom: 20px; flex-wrap: wrap; }
    .title { display: flex; align-items: center; gap: 12px; }
    dl { display: flex; gap: 32px; margin: 18px 0 0; flex-wrap: wrap; }
    dt { font-size: 0.82rem; color: var(--muted); }
    dd { margin: 2px 0 0; font-weight: 500; }
    .bal { text-align: right; display: grid; justify-items: end; gap: 6px; }
    .bal .serif { font-size: 2.4rem; line-height: 1.1; font-variant-numeric: tabular-nums; }
    .bal .btn { margin-top: 8px; }
    @media (max-width: 700px) { .bal { text-align: left; justify-items: start; } }
  `,
})
export class AccountDetail {
  private readonly api = inject(BankApi);
  /** Bound from the :accountNumber route parameter. */
  readonly accountNumber = input.required<string>();
  protected readonly account = signal<Account | null>(null);
  protected readonly page = signal<Page<Transaction> | null>(null);
  protected readonly pageNo = signal(0);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const no = this.accountNumber();
      this.api.account(no).subscribe({ next: (a) => this.account.set(a), error: (e) => this.error.set(problemMessage(e)) });
      this.load(0);
    });
  }

  load(n: number): void {
    this.pageNo.set(n);
    this.api.history({ account: this.accountNumber(), page: n, size: 20 }).subscribe({
      next: (p) => this.page.set(p),
      error: (e) => this.error.set(problemMessage(e)),
    });
  }
}
