import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BankApi } from '../../core/bank-api';
import { problemMessage } from '../../core/http.interceptors';
import { Account, AccountType } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { AccountSlab } from '../../shared/account-slab';
import { AccountNumberPipe } from '../../shared/format';
import { Icon } from '../../shared/icon';

@Component({
  selector: 'nb-accounts',
  imports: [FormsModule, AccountSlab, Icon, AccountNumberPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Accounts</h1>
          <p>Up to four open accounts per customer. Select an account to see its activity.</p>
        </div>
        <button class="btn btn-primary" (click)="dialog.set(true)"><nb-icon name="plus" /> Open account</button>
      </div>

      @if (error()) { <div class="alert alert-error">{{ error() }}</div> }

      <div class="slabs">
        @for (a of accounts(); track a.id) { <nb-account-slab [account]="a" /> }
        @empty {
          @if (!loading()) {
            <div class="panel empty"><strong>You have no accounts yet</strong>Open a checking or savings account to get started.</div>
          }
        }
      </div>

      @if (dialog()) {
        <div class="scrim" (click)="close()">
          <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="open-title" (click)="$event.stopPropagation()">
            <header>
              <h2 id="open-title">Open a new account</h2>
              <p>The account opens straight away with a $0.00 balance.</p>
            </header>
            <div class="body">
              @if (opened(); as a) {
                <div class="alert alert-success">Your {{ a.accountType === 'SAVINGS' ? 'savings' : 'checking' }} account
                  <b class="num">{{ a.accountNumber | acct }}</b> is open.</div>
              } @else {
                <div class="choices">
                  <label [class.on]="type === 'CHECKING'">
                    <input type="radio" name="t" value="CHECKING" [(ngModel)]="type" />
                    <b>Checking</b><span>For everyday spending and bills.</span>
                  </label>
                  <label [class.on]="type === 'SAVINGS'">
                    <input type="radio" name="t" value="SAVINGS" [(ngModel)]="type" />
                    <b>Savings</b><span>Keep money aside for later.</span>
                  </label>
                </div>
                @if (dialogError()) { <div class="alert alert-error">{{ dialogError() }}</div> }
              }
            </div>
            <footer>
              @if (opened()) {
                <button class="btn btn-primary" (click)="close()">Done</button>
              } @else {
                <button class="btn btn-secondary" (click)="close()">Cancel</button>
                <button class="btn btn-primary" [disabled]="busy()" (click)="open()">{{ busy() ? 'Opening…' : 'Open account' }}</button>
              }
            </footer>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .slabs { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
    .choices { display: grid; gap: 10px; margin-bottom: 12px; }
    .choices label { display: grid; grid-template-columns: auto 1fr; column-gap: 12px; padding: 14px; border: 1px solid var(--line-strong); border-radius: 8px; cursor: pointer; }
    .choices label.on { border-color: var(--ledger); background: var(--ledger-tint); }
    .choices input { grid-row: span 2; margin-top: 4px; accent-color: var(--ledger); }
    .choices span { color: var(--muted); font-size: 0.88rem; }
  `,
})
export class Accounts {
  private readonly api = inject(BankApi);
  private readonly toast = inject(ToastService);
  protected readonly accounts = signal<Account[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly dialog = signal(false);
  protected readonly busy = signal(false);
  protected readonly dialogError = signal<string | null>(null);
  protected readonly opened = signal<Account | null>(null);
  protected type: AccountType = 'SAVINGS';

  constructor() {
    this.load();
  }

  load(): void {
    this.api.myAccounts().subscribe({
      next: (a) => { this.accounts.set(a); this.loading.set(false); },
      error: (e) => { this.error.set(problemMessage(e)); this.loading.set(false); },
    });
  }

  open(): void {
    this.busy.set(true);
    this.dialogError.set(null);
    this.api.openOwnAccount(this.type).subscribe({
      next: (a) => {
        this.opened.set(a);
        this.busy.set(false);
        this.toast.success('Account opened');
        this.load();
      },
      error: (e) => { this.dialogError.set(problemMessage(e)); this.busy.set(false); },
    });
  }

  close(): void {
    this.dialog.set(false);
    this.opened.set(null);
    this.dialogError.set(null);
  }
}
