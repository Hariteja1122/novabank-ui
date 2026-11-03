import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BankApi } from '../../core/bank-api';
import { problemMessage } from '../../core/http.interceptors';
import { Account, Beneficiary, Transaction } from '../../core/models';
import { AccountMaskPipe, AccountNumberPipe, newIdempotencyKey } from '../../shared/format';
import { Icon } from '../../shared/icon';

type Step = 'edit' | 'review' | 'done';
type Mode = 'own' | 'payee' | 'other';
const LIMIT = 10000;

@Component({
  selector: 'nb-transfer',
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink, AccountNumberPipe, AccountMaskPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Move money</h1>
          <p>Transfers between NovaBank accounts arrive instantly. Limit {{ limit | currency: 'USD' : 'symbol' : '1.0-0' }} per transfer.</p>
        </div>
      </div>

      <div class="layout">
        <section class="panel">
          <ol class="steps" aria-label="Transfer progress">
            <li [class.on]="step() === 'edit'">Details</li>
            <li [class.on]="step() === 'review'">Review</li>
            <li [class.on]="step() === 'done'">Done</li>
          </ol>

          <div class="panel-body">
            @switch (step()) {
              @case ('edit') {
                <form [formGroup]="form" (ngSubmit)="review()">
                  <div class="field">
                    <label for="from">From</label>
                    <select id="from" class="select" formControlName="fromAccount">
                      @for (a of activeAccounts(); track a.id) {
                        <option [value]="a.accountNumber">{{ label(a) }}, {{ a.balance | currency }} available</option>
                      }
                    </select>
                  </div>

                  <div class="field">
                    <span class="lbl">To</span>
                    <div class="seg" role="radiogroup">
                      <label [class.on]="form.controls.mode.value === 'own'"><input type="radio" formControlName="mode" value="own" /> My accounts</label>
                      <label [class.on]="form.controls.mode.value === 'payee'"><input type="radio" formControlName="mode" value="payee" /> Saved payee</label>
                      <label [class.on]="form.controls.mode.value === 'other'"><input type="radio" formControlName="mode" value="other" /> New account number</label>
                    </div>
                  </div>

                  @if (form.controls.mode.value === 'own') {
                    <div class="field">
                      <label for="toOwn" class="sr">Destination account</label>
                      <select id="toOwn" class="select" formControlName="toOwn">
                        <option value="" disabled>Choose an account</option>
                        @for (a of destinations(); track a.id) {
                          <option [value]="a.accountNumber">{{ label(a) }}</option>
                        }
                      </select>
                    </div>
                  } @else if (form.controls.mode.value === 'payee') {
                    <div class="field">
                      @if (payees().length) {
                        <label for="toPayee" class="sr">Payee</label>
                        <select id="toPayee" class="select" formControlName="toPayee">
                          <option value="" disabled>Choose a payee</option>
                          @for (p of payees(); track p.id) {
                            <option [value]="p.accountNumber">{{ p.nickname }}, {{ p.accountNumber | acctMask }}</option>
                          }
                        </select>
                        <span class="hint"><a routerLink="/app/payees">Manage payees</a></span>
                      } @else {
                        <span class="hint">You have no saved payees yet. <a routerLink="/app/payees">Add a payee</a> or enter a new account number.</span>
                      }
                    </div>
                  } @else {
                    <div class="field">
                      <label for="toOther" class="sr">Recipient account number</label>
                      <input id="toOther" class="input num" formControlName="toOther" inputmode="numeric" maxlength="12" placeholder="12 digit account number" />
                      <span class="hint">Try 100245180057 (Priya Sharma in the sample data). Pay this account often? <a routerLink="/app/payees">Save it as a payee</a>.</span>
                    </div>
                  }

                  <div class="field">
                    <label for="amount">Amount</label>
                    <div class="input-money"><span>$</span><input id="amount" class="input" type="number" min="0.01" step="0.01" formControlName="amount" placeholder="0.00" /></div>
                    @if (overBalance()) { <span class="error">That is more than the available balance of {{ selected()?.balance | currency }}.</span> }
                  </div>

                  <div class="field">
                    <label for="desc">Note <span class="muted">(optional)</span></label>
                    <input id="desc" class="input" formControlName="description" maxlength="140" placeholder="Rent, dinner, savings…" />
                  </div>

                  @if (formError()) { <div class="alert alert-error">{{ formError() }}</div> }
                  <button class="btn btn-primary btn-block" type="submit">Review transfer</button>
                </form>
              }

              @case ('review') {
                <div class="review">
                  <div class="amt serif">{{ form.controls.amount.value | currency }}</div>
                  <dl>
                    <div><dt>From</dt><dd>{{ selected() ? label(selected()!) : '' }}</dd></div>
                    <div><dt>To</dt><dd>@if (payeeName(); as n) { {{ n }}<br /> }<span class="num">{{ toAccount() | acct }}</span></dd></div>
                    <div><dt>Note</dt><dd>{{ form.controls.description.value || 'Funds transfer' }}</dd></div>
                    <div><dt>Arrives</dt><dd>Immediately</dd></div>
                  </dl>
                  @if (submitError()) { <div class="alert alert-error">{{ submitError() }}</div> }
                  <div class="row">
                    <button class="btn btn-secondary" (click)="step.set('edit')" [disabled]="busy()">Edit</button>
                    <button class="btn btn-primary" (click)="send()" [disabled]="busy()">{{ busy() ? 'Sending…' : 'Send ' + (form.controls.amount.value | currency) }}</button>
                  </div>
                </div>
              }

              @case ('done') {
                @if (result(); as r) {
                  <div class="done">
                    <span class="tick"><nb-icon name="check" [size]="26" /></span>
                    <h2>Sent {{ r.amount | currency }}</h2>
                    <p class="muted">To @if (payeeName(); as n) { {{ n }}, }{{ r.toAccount | acct }}. Reference <b class="num">{{ r.reference }}</b></p>
                    <div class="row">
                      <button class="btn btn-secondary" (click)="again()">Make another transfer</button>
                      <a class="btn btn-primary" routerLink="/app">Back to overview</a>
                    </div>
                  </div>
                }
              }
            }
          </div>
        </section>

        <aside class="panel side">
          <h3>Good to know</h3>
          <ul>
            <li>Every transfer carries a unique request key, so pressing Send twice never pays twice.</li>
            <li>Frozen or closed accounts cannot send or receive money.</li>
            <li>Transfers above {{ limit | currency: 'USD' : 'symbol' : '1.0-0' }} need a branch visit.</li>
          </ul>
        </aside>
      </div>
    </div>
  `,
  styles: `
    .layout { display: grid; grid-template-columns: minmax(0, 560px) minmax(0, 300px); gap: 20px; align-items: start; }
    .steps { display: flex; list-style: none; margin: 0; padding: 0; border-bottom: 1px solid var(--line); }
    .steps li { flex: 1; padding: 14px 20px; font-size: 0.88rem; color: var(--faint); border-bottom: 2px solid transparent; margin-bottom: -1px; }
    .steps li.on { color: var(--ink); font-weight: 500; border-bottom-color: var(--ledger); }
    .lbl { font-size: 0.86rem; font-weight: 500; }
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .seg { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .seg label { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border: 1px solid var(--line-strong); border-radius: 7px; cursor: pointer; font-size: 0.9rem; }
    .seg label.on { border-color: var(--ledger); background: var(--ledger-tint); }
    .seg input { accent-color: var(--ledger); }
    .review .amt { font-size: 2.6rem; text-align: center; padding: 8px 0 18px; font-variant-numeric: tabular-nums; }
    dl { margin: 0 0 20px; border-top: 1px solid var(--line); }
    dl div { display: flex; justify-content: space-between; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--line); }
    dt { color: var(--muted); }
    dd { margin: 0; font-weight: 500; text-align: right; }
    .row { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; }
    .done { text-align: center; padding: 12px 0; }
    .done h2 { font-family: var(--serif); font-weight: 400; font-size: 1.7rem; margin: 14px 0 6px; }
    .done .row { justify-content: center; margin-top: 22px; }
    .tick { display: inline-grid; place-items: center; width: 56px; height: 56px; border-radius: 50%; background: var(--credit-tint); color: var(--credit); }
    .side { padding: 20px; }
    .side ul { margin: 12px 0 0; padding-left: 18px; display: grid; gap: 10px; color: var(--muted); font-size: 0.9rem; }
    @media (max-width: 960px) { .layout { grid-template-columns: 1fr; } }
    @media (max-width: 560px) { .seg { grid-template-columns: 1fr; } }
  `,
})
export class Transfer {
  private readonly api = inject(BankApi);
  protected readonly limit = LIMIT;
  protected readonly accounts = signal<Account[]>([]);
  protected readonly payees = signal<Beneficiary[]>([]);
  protected readonly step = signal<Step>('edit');
  protected readonly busy = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly submitError = signal<string | null>(null);
  protected readonly result = signal<Transaction | null>(null);
  /** One key per transfer attempt; a retry of the same attempt reuses it. */
  private idempotencyKey = newIdempotencyKey();

  protected readonly form = inject(FormBuilder).nonNullable.group({
    fromAccount: ['', Validators.required],
    mode: ['own' as Mode],
    toOwn: [''],
    toPayee: [''],
    toOther: [''],
    amount: [null as number | null, [Validators.required, Validators.min(0.01), Validators.max(LIMIT)]],
    description: [''],
  });

  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly activeAccounts = computed(() => this.accounts().filter((a) => a.status === 'ACTIVE'));
  protected readonly selected = computed(() => this.accounts().find((a) => a.accountNumber === this.value().fromAccount) ?? null);
  protected readonly destinations = computed(() => this.activeAccounts().filter((a) => a.accountNumber !== this.value().fromAccount));
  protected readonly overBalance = computed(() => {
    const amt = Number(this.value().amount ?? 0);
    return !!this.selected() && amt > (this.selected()?.balance ?? 0);
  });

  /** Nickname of the saved payee for the chosen destination, whichever way it was entered. */
  protected readonly payeeName = computed(() => {
    this.value();
    const to = this.toAccount();
    return this.payees().find((p) => p.accountNumber === to)?.nickname ?? null;
  });

  constructor() {
    const query = inject(ActivatedRoute).snapshot.queryParamMap;
    const preferred = query.get('from');
    const payeeId = Number(query.get('payee'));
    // Payees are a shortcut: if they fail to load, the other two destination modes still work.
    this.api.beneficiaries().subscribe({
      next: (list) => {
        this.payees.set(list);
        const chosen = list.find((p) => p.id === payeeId);
        if (chosen) this.form.patchValue({ mode: 'payee', toPayee: chosen.accountNumber });
      },
      error: () => this.payees.set([]),
    });
    this.api.myAccounts().subscribe((list) => {
      this.accounts.set(list);
      const first = list.find((a) => a.accountNumber === preferred && a.status === 'ACTIVE') ?? list.find((a) => a.status === 'ACTIVE');
      if (first) this.form.patchValue({ fromAccount: first.accountNumber });
    });
  }

  protected label(a: Account): string {
    return `${a.accountType === 'SAVINGS' ? 'Savings' : 'Checking'} •••• ${a.accountNumber.slice(-4)}`;
  }

  protected toAccount(): string {
    const v = this.form.getRawValue();
    if (v.mode === 'own') return v.toOwn;
    if (v.mode === 'payee') return v.toPayee;
    return v.toOther.trim();
  }

  review(): void {
    const to = this.toAccount();
    const v = this.form.getRawValue();
    if (!/^\d{12}$/.test(to)) return this.formError.set('Choose an account or payee, or enter a 12 digit account number.');
    if (to === v.fromAccount) return this.formError.set('Pick a different account to send to.');
    if (this.form.invalid) return this.formError.set(`Enter an amount between $0.01 and $${LIMIT.toLocaleString()}.`);
    if (this.overBalance()) return this.formError.set('The amount is more than the available balance.');
    this.formError.set(null);
    this.submitError.set(null);
    this.step.set('review');
  }

  send(): void {
    const v = this.form.getRawValue();
    this.busy.set(true);
    this.api.transfer({ fromAccount: v.fromAccount, toAccount: this.toAccount(), amount: Number(v.amount), description: v.description || null }, this.idempotencyKey)
      .subscribe({
        next: (t) => {
          this.result.set(t);
          this.busy.set(false);
          this.step.set('done');
          this.api.myAccounts().subscribe((list) => this.accounts.set(list));
        },
        error: (e) => {
          this.submitError.set(problemMessage(e));
          this.busy.set(false);
          // A 4xx means the server recorded this attempt as rejected, so a corrected
          // attempt needs a new key. On a network error keep the key: retrying is safe.
          if (e?.status >= 400 && e?.status < 500) this.idempotencyKey = newIdempotencyKey();
        },
      });
  }

  again(): void {
    this.idempotencyKey = newIdempotencyKey();
    this.result.set(null);
    this.form.patchValue({ amount: null, description: '', toOther: '', toOwn: '', toPayee: '' });
    this.step.set('edit');
  }
}
