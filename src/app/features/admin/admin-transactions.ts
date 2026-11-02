import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { BankApi } from '../../core/bank-api';
import { problemMessage } from '../../core/http.interceptors';
import { Page, Transaction, TxnStatus, TxnType } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { AccountMaskPipe, newIdempotencyKey } from '../../shared/format';
import { Pager } from '../../shared/pager';
import { StatusBadge } from '../../shared/status-badge';

@Component({
  selector: 'nb-admin-transactions',
  imports: [CurrencyPipe, DatePipe, FormsModule, AccountMaskPipe, Pager, StatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Transactions</h1>
          <p>Monitor every transfer and deposit across the bank.</p>
        </div>
        <button class="btn btn-primary" (click)="openDeposit()">Record deposit</button>
      </div>
      @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
      <section class="panel">
        <div class="toolbar">
          <input class="input" type="search" placeholder="Reference, account number or note" [(ngModel)]="q" (ngModelChange)="search$.next()" aria-label="Search transactions" />
          <select class="select" [(ngModel)]="status" (ngModelChange)="load(0)" aria-label="Filter by status">
            <option value="">Any status</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
            <option value="PENDING">Pending</option>
          </select>
          <select class="select" [(ngModel)]="type" (ngModelChange)="load(0)" aria-label="Filter by type">
            <option value="">Any type</option>
            <option value="TRANSFER">Transfers</option>
            <option value="DEPOSIT">Deposits</option>
          </select>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Reference</th><th>Type</th><th>From</th><th>To</th><th>Note</th><th>When</th><th>Status</th><th class="right">Amount</th></tr></thead>
            <tbody>
              @for (t of page()?.content ?? []; track t.id) {
                <tr>
                  <td class="num small">{{ t.reference }}</td>
                  <td class="small">{{ t.type === 'DEPOSIT' ? 'Deposit' : 'Transfer' }}</td>
                  <td class="num small">{{ t.fromAccount ? (t.fromAccount | acctMask) : 'Branch' }}</td>
                  <td class="num small">{{ t.toAccount | acctMask }}</td>
                  <td class="small">
                    {{ t.description }}
                    @if (t.failureReason) { <div class="cell-sub debit">{{ t.failureReason }}</div> }
                  </td>
                  <td class="small muted">{{ t.createdAt | date: 'MMM d, h:mm a' }}</td>
                  <td><nb-status [value]="t.status" /></td>
                  <td class="right money">{{ t.amount | currency: t.currency }}</td>
                </tr>
              } @empty {
                <tr><td colspan="8"><div class="empty"><strong>No transactions match</strong>Clear the filters or search for another reference.</div></td></tr>
              }
            </tbody>
          </table>
        </div>
        <nb-pager [page]="pageNo()" [size]="20" [total]="page()?.page?.totalElements ?? 0" [pages]="page()?.page?.totalPages ?? 1" (go)="load($event)" />
      </section>

      @if (depositOpen()) {
        <div class="scrim" (click)="depositOpen.set(false)">
          <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dep" (click)="$event.stopPropagation()">
            <header>
              <h2 id="dep">Record a deposit</h2>
              <p>Credits cash or a cheque received at the branch to a customer account.</p>
            </header>
            <div class="body">
              <div class="field">
                <label for="to">Account number</label>
                <input id="to" class="input num" maxlength="12" inputmode="numeric" [(ngModel)]="dep.toAccount" placeholder="100245180031" />
              </div>
              <div class="field">
                <label for="amt">Amount</label>
                <div class="input-money"><span>$</span><input id="amt" class="input" type="number" min="0.01" step="0.01" [(ngModel)]="dep.amount" /></div>
              </div>
              <div class="field">
                <label for="note">Note</label>
                <input id="note" class="input" maxlength="140" [(ngModel)]="dep.description" placeholder="Branch cash deposit" />
              </div>
              @if (depositError()) { <div class="alert alert-error">{{ depositError() }}</div> }
            </div>
            <footer>
              <button class="btn btn-secondary" (click)="depositOpen.set(false)">Cancel</button>
              <button class="btn btn-primary" [disabled]="busy()" (click)="deposit()">{{ busy() ? 'Recording…' : 'Record deposit' }}</button>
            </footer>
          </div>
        </div>
      }
    </div>
  `,
})
export class AdminTransactions {
  private readonly api = inject(BankApi);
  private readonly toast = inject(ToastService);
  protected readonly page = signal<Page<Transaction> | null>(null);
  protected readonly pageNo = signal(0);
  protected readonly error = signal<string | null>(null);
  protected readonly depositOpen = signal(false);
  protected readonly depositError = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly search$ = new Subject<void>();
  protected q = '';
  protected status: TxnStatus | '' = '';
  protected type: TxnType | '' = '';
  protected dep = { toAccount: '', amount: null as number | null, description: '' };
  private depositKey = newIdempotencyKey();

  constructor() {
    const qp = inject(ActivatedRoute).snapshot.queryParamMap;
    this.status = (qp.get('status') as TxnStatus) ?? '';
    if (qp.get('deposit')) this.openDeposit();
    this.search$.pipe(debounceTime(250), takeUntilDestroyed()).subscribe(() => this.load(0));
    this.load(0);
  }

  load(n: number): void {
    this.pageNo.set(n);
    this.api.adminTransactions({ q: this.q, status: this.status, type: this.type, page: n, size: 20 }).subscribe({
      next: (p) => this.page.set(p),
      error: (e) => this.error.set(problemMessage(e)),
    });
  }

  openDeposit(): void {
    this.dep = { toAccount: '', amount: null, description: '' };
    this.depositKey = newIdempotencyKey();
    this.depositError.set(null);
    this.depositOpen.set(true);
  }

  deposit(): void {
    if (!/^\d{12}$/.test(this.dep.toAccount.trim())) return this.depositError.set('Enter a 12 digit account number.');
    if (!this.dep.amount || this.dep.amount <= 0) return this.depositError.set('Enter an amount above $0.00.');
    this.busy.set(true);
    this.api.deposit({ toAccount: this.dep.toAccount.trim(), amount: Number(this.dep.amount), description: this.dep.description || null }, this.depositKey)
      .subscribe({
        next: (t) => {
          this.busy.set(false);
          this.depositOpen.set(false);
          this.toast.success(`Deposit ${t.reference} recorded`);
          this.load(0);
        },
        error: (e) => {
          this.busy.set(false);
          this.depositError.set(problemMessage(e));
          if (e?.status >= 400 && e?.status < 500) this.depositKey = newIdempotencyKey();
        },
      });
  }
}
