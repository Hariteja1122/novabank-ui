import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime } from 'rxjs';
import { BankApi } from '../../core/bank-api';
import { problemMessage } from '../../core/http.interceptors';
import { Account, AccountStatus, AccountType, Page } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { AccountNumberPipe } from '../../shared/format';
import { Pager } from '../../shared/pager';
import { StatusBadge } from '../../shared/status-badge';

@Component({
  selector: 'nb-admin-accounts',
  imports: [CurrencyPipe, DatePipe, FormsModule, AccountNumberPipe, Pager, StatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Accounts</h1>
          <p>Freeze an account to stop money moving in or out while you investigate.</p>
        </div>
      </div>
      @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
      <section class="panel">
        <div class="toolbar">
          <input class="input" type="search" placeholder="Search by account number or customer" [(ngModel)]="q" (ngModelChange)="search$.next()" aria-label="Search accounts" />
          <select class="select" [(ngModel)]="status" (ngModelChange)="load(0)" aria-label="Filter by status">
            <option value="">Any status</option>
            <option value="ACTIVE">Active</option>
            <option value="FROZEN">Frozen</option>
            <option value="CLOSED">Closed</option>
          </select>
          <select class="select" [(ngModel)]="type" (ngModelChange)="load(0)" aria-label="Filter by type">
            <option value="">Any type</option>
            <option value="CHECKING">Checking</option>
            <option value="SAVINGS">Savings</option>
          </select>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Account</th><th>Customer</th><th>Opened</th><th>Status</th><th class="right">Balance</th><th class="right">Actions</th></tr></thead>
            <tbody>
              @for (a of page()?.content ?? []; track a.id) {
                <tr>
                  <td><div class="cell-main num">{{ a.accountNumber | acct }}</div><div class="cell-sub">{{ a.accountType === 'SAVINGS' ? 'Savings' : 'Checking' }}</div></td>
                  <td>{{ a.customerName }}</td>
                  <td class="small muted">{{ a.openedAt | date: 'mediumDate' }}</td>
                  <td><nb-status [value]="a.status" /></td>
                  <td class="right money">{{ a.balance | currency: a.currency }}</td>
                  <td class="right"><div class="actions">
                    @switch (a.status) {
                      @case ('ACTIVE') { <button class="btn btn-danger btn-sm" (click)="setStatus(a, 'FROZEN')">Freeze</button> }
                      @case ('FROZEN') { <button class="btn btn-secondary btn-sm" (click)="setStatus(a, 'ACTIVE')">Unfreeze</button> }
                    }
                    @if (a.status !== 'CLOSED' && a.balance === 0) {
                      <button class="btn btn-secondary btn-sm" (click)="setStatus(a, 'CLOSED')">Close</button>
                    }
                  </div></td>
                </tr>
              } @empty {
                <tr><td colspan="6"><div class="empty"><strong>No accounts match</strong>Clear the filters to see every account.</div></td></tr>
              }
            </tbody>
          </table>
        </div>
        <nb-pager [page]="pageNo()" [size]="15" [total]="page()?.page?.totalElements ?? 0" [pages]="page()?.page?.totalPages ?? 1" (go)="load($event)" />
      </section>
    </div>
  `,
  styles: `.actions { display: flex; gap: 8px; justify-content: flex-end; }`,
})
export class AdminAccounts {
  private readonly api = inject(BankApi);
  private readonly toast = inject(ToastService);
  protected readonly page = signal<Page<Account> | null>(null);
  protected readonly pageNo = signal(0);
  protected readonly error = signal<string | null>(null);
  protected readonly search$ = new Subject<void>();
  protected q = '';
  protected status: AccountStatus | '' = '';
  protected type: AccountType | '' = '';

  constructor() {
    this.search$.pipe(debounceTime(250), takeUntilDestroyed()).subscribe(() => this.load(0));
    this.load(0);
  }

  load(n: number): void {
    this.pageNo.set(n);
    this.api.adminAccounts({ q: this.q, status: this.status, type: this.type, page: n, size: 15 }).subscribe({
      next: (p) => this.page.set(p),
      error: (e) => this.error.set(problemMessage(e)),
    });
  }

  setStatus(a: Account, status: AccountStatus): void {
    const verb = status === 'FROZEN' ? 'Frozen' : status === 'CLOSED' ? 'Closed' : 'Unfrozen';
    this.api.setAccountStatus(a.accountNumber, status).subscribe({
      next: () => { this.toast.success(`${verb} account •••• ${a.accountNumber.slice(-4)}`); this.load(this.pageNo()); },
      error: (e) => this.toast.error(problemMessage(e)),
    });
  }
}
