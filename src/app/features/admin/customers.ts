import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BankApi } from '../../core/bank-api';
import { problemMessage } from '../../core/http.interceptors';
import { Account, AccountType, Page, User, UserStatus } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { AccountNumberPipe } from '../../shared/format';
import { Pager } from '../../shared/pager';
import { StatusBadge } from '../../shared/status-badge';

@Component({
  selector: 'nb-customers',
  imports: [CurrencyPipe, DatePipe, FormsModule, AccountNumberPipe, Pager, StatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Customers</h1>
          <p>Search profiles, lock access and open accounts on a customer's behalf.</p>
        </div>
      </div>
      @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
      <section class="panel">
        <div class="toolbar">
          <input class="input" type="search" placeholder="Search by name or email" [(ngModel)]="q" (ngModelChange)="search$.next()" aria-label="Search customers" />
          <select class="select" [(ngModel)]="status" (ngModelChange)="load(0)" aria-label="Filter by status">
            <option value="">Any status</option>
            <option value="ACTIVE">Active</option>
            <option value="LOCKED">Locked</option>
          </select>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Customer</th><th>Phone</th><th>Joined</th><th>Last sign in</th><th>Status</th><th class="right">Actions</th></tr></thead>
            <tbody>
              @for (u of page()?.content ?? []; track u.id) {
                <tr>
                  <td><div class="cell-main">{{ u.fullName }}</div><div class="cell-sub">{{ u.email }}</div></td>
                  <td class="small">{{ u.phone || '' }}</td>
                  <td class="small muted">{{ u.createdAt | date: 'mediumDate' }}</td>
                  <td class="small muted">{{ u.lastLoginAt ? (u.lastLoginAt | date: 'MMM d, h:mm a') : 'Never' }}</td>
                  <td><nb-status [value]="u.status" /></td>
                  <td class="right"><div class="actions">
                    <button class="btn btn-secondary btn-sm" (click)="openFor(u)">Open account</button>
                    @if (u.status === 'ACTIVE') {
                      <button class="btn btn-danger btn-sm" (click)="setStatus(u, 'LOCKED')">Lock</button>
                    } @else {
                      <button class="btn btn-secondary btn-sm" (click)="setStatus(u, 'ACTIVE')">Unlock</button>
                    }
                  </div></td>
                </tr>
              } @empty {
                <tr><td colspan="6"><div class="empty"><strong>No customers match</strong>Try a different name or clear the status filter.</div></td></tr>
              }
            </tbody>
          </table>
        </div>
        <nb-pager [page]="pageNo()" [size]="15" [total]="page()?.page?.totalElements ?? 0" [pages]="page()?.page?.totalPages ?? 1" (go)="load($event)" />
      </section>

      @if (target(); as u) {
        <div class="scrim" (click)="target.set(null)">
          <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="oa" (click)="$event.stopPropagation()">
            <header>
              <h2 id="oa">Open an account for {{ u.fullName }}</h2>
              <p>The customer sees it in their app immediately.</p>
            </header>
            <div class="body">
              @if (opened(); as a) {
                <div class="alert alert-success">Opened {{ a.accountType.toLowerCase() }} account <b class="num">{{ a.accountNumber | acct }}</b>
                  with {{ a.balance | currency }}.</div>
              } @else {
                <div class="field">
                  <label for="t">Account type</label>
                  <select id="t" class="select" [(ngModel)]="type">
                    <option value="CHECKING">Checking</option>
                    <option value="SAVINGS">Savings</option>
                  </select>
                </div>
                <div class="field">
                  <label for="d">Opening deposit</label>
                  <div class="input-money"><span>$</span><input id="d" class="input" type="number" min="0" step="0.01" [(ngModel)]="initialDeposit" /></div>
                </div>
                @if (dialogError()) { <div class="alert alert-error">{{ dialogError() }}</div> }
              }
            </div>
            <footer>
              @if (opened()) {
                <button class="btn btn-primary" (click)="target.set(null)">Done</button>
              } @else {
                <button class="btn btn-secondary" (click)="target.set(null)">Cancel</button>
                <button class="btn btn-primary" [disabled]="busy()" (click)="openAccount(u)">Open account</button>
              }
            </footer>
          </div>
        </div>
      }
    </div>
  `,
  styles: `.actions { display: flex; gap: 8px; justify-content: flex-end; }`,
})
export class Customers {
  private readonly api = inject(BankApi);
  private readonly toast = inject(ToastService);
  protected readonly page = signal<Page<User> | null>(null);
  protected readonly pageNo = signal(0);
  protected readonly error = signal<string | null>(null);
  protected readonly target = signal<User | null>(null);
  protected readonly opened = signal<Account | null>(null);
  protected readonly busy = signal(false);
  protected readonly dialogError = signal<string | null>(null);
  protected readonly search$ = new Subject<void>();
  protected q = '';
  protected status: UserStatus | '' = '';
  protected type: AccountType = 'CHECKING';
  protected initialDeposit = 0;

  constructor() {
    this.search$.pipe(debounceTime(250), takeUntilDestroyed()).subscribe(() => this.load(0));
    this.load(0);
  }

  load(n: number): void {
    this.pageNo.set(n);
    this.api.users({ role: 'CUSTOMER', status: this.status, q: this.q, page: n, size: 15 }).subscribe({
      next: (p) => this.page.set(p),
      error: (e) => this.error.set(problemMessage(e)),
    });
  }

  setStatus(u: User, status: UserStatus): void {
    this.api.setUserStatus(u.id, status).subscribe({
      next: () => { this.toast.success(`${u.fullName} ${status === 'LOCKED' ? 'locked' : 'unlocked'}`); this.load(this.pageNo()); },
      error: (e) => this.toast.error(problemMessage(e)),
    });
  }

  openFor(u: User): void {
    this.opened.set(null);
    this.dialogError.set(null);
    this.type = 'CHECKING';
    this.initialDeposit = 0;
    this.target.set(u);
  }

  openAccount(u: User): void {
    this.busy.set(true);
    this.api.adminOpenAccount({ customerId: u.id, customerName: u.fullName, accountType: this.type, initialDeposit: Number(this.initialDeposit) || 0 }).subscribe({
      next: (a) => { this.opened.set(a); this.busy.set(false); },
      error: (e) => { this.dialogError.set(problemMessage(e)); this.busy.set(false); },
    });
  }
}
