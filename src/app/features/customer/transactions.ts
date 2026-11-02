import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BankApi } from '../../core/bank-api';
import { problemMessage } from '../../core/http.interceptors';
import { Account, Page, Transaction } from '../../core/models';
import { Pager } from '../../shared/pager';
import { TxnTable } from '../../shared/txn-table';

@Component({
  selector: 'nb-transactions',
  imports: [FormsModule, Pager, TxnTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Transactions</h1>
          <p>Every transfer and deposit across your accounts, newest first.</p>
        </div>
      </div>
      @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
      <section class="panel">
        <div class="toolbar">
          <select class="select" [(ngModel)]="account" (ngModelChange)="load(0)" aria-label="Filter by account">
            <option value="">All accounts</option>
            @for (a of accounts(); track a.id) {
              <option [value]="a.accountNumber">{{ a.accountType === 'SAVINGS' ? 'Savings' : 'Checking' }} •••• {{ a.accountNumber.slice(-4) }}</option>
            }
          </select>
        </div>
        <nb-txn-table [rows]="page()?.content ?? []" />
        <nb-pager [page]="pageNo()" [size]="20" [total]="page()?.page?.totalElements ?? 0" [pages]="page()?.page?.totalPages ?? 1" (go)="load($event)" />
      </section>
    </div>
  `,
})
export class Transactions {
  private readonly api = inject(BankApi);
  protected readonly accounts = signal<Account[]>([]);
  protected readonly page = signal<Page<Transaction> | null>(null);
  protected readonly pageNo = signal(0);
  protected readonly error = signal<string | null>(null);
  protected account = '';

  constructor() {
    this.api.myAccounts().subscribe((a) => this.accounts.set(a));
    this.load(0);
  }

  load(n: number): void {
    this.pageNo.set(n);
    this.api.history({ account: this.account || null, page: n, size: 20 }).subscribe({
      next: (p) => this.page.set(p),
      error: (e) => this.error.set(problemMessage(e)),
    });
  }
}
