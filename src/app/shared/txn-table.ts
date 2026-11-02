import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Transaction } from '../core/models';
import { Icon } from './icon';
import { StatusBadge } from './status-badge';

/** Customer view of transactions: signed amounts relative to the customer's own accounts. */
@Component({
  selector: 'nb-txn-table',
  imports: [CurrencyPipe, DatePipe, Icon, StatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Details</th>
            <th>Date</th>
            @if (!compact()) { <th>Reference</th><th>Status</th> }
            <th class="right">Amount</th>
          </tr>
        </thead>
        <tbody>
          @for (t of rows(); track t.id) {
            <tr>
              <td>
                <div class="who">
                  <span class="dir" [class]="'dir ' + (t.direction ?? 'CREDIT')">
                    <nb-icon [name]="t.direction === 'DEBIT' ? 'arrowUp' : t.direction === 'INTERNAL' ? 'swap' : 'arrowDown'" [size]="15" />
                  </span>
                  <span>
                    <span class="cell-main">{{ t.description || (t.type === 'DEPOSIT' ? 'Deposit' : 'Transfer') }}</span>
                    <span class="cell-sub">{{ counterparty(t) }}</span>
                  </span>
                </div>
              </td>
              <td class="muted small">{{ t.createdAt | date: 'MMM d, h:mm a' }}</td>
              @if (!compact()) {
                <td class="small muted num">{{ t.reference }}</td>
                <td><nb-status [value]="t.status" /></td>
              }
              <td class="right money amount" [class.credit]="t.direction === 'CREDIT' && t.status === 'COMPLETED'"
                  [class.void]="t.status === 'FAILED'">
                {{ sign(t) }}{{ t.amount | currency: t.currency }}
              </td>
            </tr>
          } @empty {
            <tr><td [attr.colspan]="compact() ? 3 : 5"><div class="empty"><strong>No transactions yet</strong>Money you send or receive will show up here.</div></td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    .who { display: flex; align-items: center; gap: 12px; }
    .who > span:last-child { display: grid; }
    .dir { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; flex: none; }
    .dir.CREDIT { background: var(--credit-tint); color: var(--credit); }
    .dir.DEBIT { background: #eef1f0; color: var(--ink); }
    .dir.INTERNAL { background: var(--brass-tint); color: var(--warn); }
    .amount { font-weight: 500; white-space: nowrap; }
    .void { color: var(--faint); text-decoration: line-through; }
  `,
})
export class TxnTable {
  readonly rows = input.required<Transaction[]>();
  readonly compact = input(false);

  protected sign(t: Transaction): string {
    return t.direction === 'DEBIT' ? '−' : t.direction === 'CREDIT' ? '+' : '';
  }

  protected counterparty(t: Transaction): string {
    const mask = (n: string | null) => (n ? `•••• ${n.slice(-4)}` : 'Branch');
    if (t.type === 'DEPOSIT') return `Deposit to ${mask(t.toAccount)}`;
    if (t.direction === 'INTERNAL') return `${mask(t.fromAccount)} to ${mask(t.toAccount)}`;
    return t.direction === 'DEBIT' ? `To ${mask(t.toAccount)}` : `From ${mask(t.fromAccount)}`;
  }
}
