import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Account } from '../core/models';
import { AccountNumberPipe } from './format';
import { StatusBadge } from './status-badge';

/** One account as a passbook-style slab: type, grouped number, balance in the serif figure face. */
@Component({
  selector: 'nb-account-slab',
  imports: [CurrencyPipe, AccountNumberPipe, RouterLink, StatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="slab" [class.savings]="account().accountType === 'SAVINGS'" [routerLink]="['/app/accounts', account().accountNumber]">
      <div class="top">
        <span class="type">{{ account().accountType === 'SAVINGS' ? 'Savings' : 'Checking' }}</span>
        @if (account().status !== 'ACTIVE') { <nb-status [value]="account().status" /> }
      </div>
      <div class="balance serif">{{ account().balance | currency: account().currency }}</div>
      <div class="no num">{{ account().accountNumber | acct }}</div>
    </a>
  `,
  styles: `
    .slab { display: block; padding: 18px 20px 16px; border-radius: var(--r-panel); background: var(--surface); border: 1px solid var(--line);
      border-top: 3px solid var(--ledger); color: inherit; text-decoration: none; box-shadow: var(--shadow); transition: border-color 0.15s, transform 0.15s; }
    .slab.savings { border-top-color: var(--brass); }
    .slab:hover { border-color: var(--line-strong); transform: translateY(-1px); }
    .top { display: flex; justify-content: space-between; align-items: center; min-height: 24px; }
    .type { font-weight: 500; font-size: 0.92rem; }
    .balance { font-size: 1.75rem; margin: 14px 0 6px; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
    .no { color: var(--muted); font-size: 0.88rem; letter-spacing: 0.04em; }
  `,
})
export class AccountSlab {
  readonly account = input.required<Account>();
}
