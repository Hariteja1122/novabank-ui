import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BankApi } from '../../core/bank-api';
import { fieldErrors, problemMessage } from '../../core/http.interceptors';
import { Beneficiary } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { AccountNumberPipe } from '../../shared/format';
import { Icon } from '../../shared/icon';

type Dialog = { kind: 'add' } | { kind: 'rename'; payee: Beneficiary } | { kind: 'remove'; payee: Beneficiary };

@Component({
  selector: 'nb-payees',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, AccountNumberPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Payees</h1>
          <p>Save the NovaBank accounts you pay often, then pick them on Move money instead of typing the number.</p>
        </div>
        <button class="btn btn-primary" (click)="openAdd()"><nb-icon name="plus" /> Add payee</button>
      </div>

      @if (error()) { <div class="alert alert-error">{{ error() }}</div> }

      <section class="panel">
        @if (payees().length) {
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Payee</th><th>Account</th><th class="right">Actions</th></tr></thead>
              <tbody>
                @for (p of payees(); track p.id) {
                  <tr>
                    <td><div class="cell-main">{{ p.nickname }}</div><div class="cell-sub">Added {{ p.createdAt | date: 'mediumDate' }}</div></td>
                    <td class="num">{{ p.accountNumber | acct }}</td>
                    <td class="right actions">
                      <a class="btn btn-primary btn-sm" routerLink="/app/transfer" [queryParams]="{ payee: p.id }">Send money</a>
                      <button class="btn btn-secondary btn-sm" (click)="openRename(p)">Rename</button>
                      <button class="btn btn-danger btn-sm" (click)="dialog.set({ kind: 'remove', payee: p })">Remove</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else if (!loading()) {
          <div class="empty"><strong>No payees yet</strong>Add someone you pay often, like a landlord or a friend you split bills with.</div>
        }
      </section>

      @if (dialog(); as d) {
        <div class="scrim" (click)="close()">
          <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="payee-title" (click)="$event.stopPropagation()">
            @switch (d.kind) {
              @case ('add') {
                <form [formGroup]="addForm" (ngSubmit)="add()">
                  <header>
                    <h2 id="payee-title">Add a payee</h2>
                    <p>We check that the account exists before saving it.</p>
                  </header>
                  <div class="body">
                    <div class="field">
                      <label for="nickname">Name</label>
                      <input id="nickname" class="input" formControlName="nickname" maxlength="60" placeholder="Priya (rent)" />
                      @if (errors()['nickname']; as m) { <span class="error">{{ m }}</span> }
                    </div>
                    <div class="field">
                      <label for="accountNumber">Account number</label>
                      <input id="accountNumber" class="input num" formControlName="accountNumber" inputmode="numeric" maxlength="12" placeholder="12 digit account number" />
                      @if (errors()['accountNumber']; as m) { <span class="error">{{ m }}</span> }
                      @else { <span class="hint">Try 100245180081 (Sofia Alvarez in the sample data).</span> }
                    </div>
                    @if (dialogError()) { <div class="alert alert-error">{{ dialogError() }}</div> }
                  </div>
                  <footer>
                    <button class="btn btn-secondary" type="button" (click)="close()">Cancel</button>
                    <button class="btn btn-primary" type="submit" [disabled]="busy()">{{ busy() ? 'Saving…' : 'Save payee' }}</button>
                  </footer>
                </form>
              }
              @case ('rename') {
                <form [formGroup]="renameForm" (ngSubmit)="rename(d.payee)">
                  <header>
                    <h2 id="payee-title">Rename payee</h2>
                    <p>Account <span class="num">{{ d.payee.accountNumber | acct }}</span> stays the same.</p>
                  </header>
                  <div class="body">
                    <div class="field">
                      <label for="rename">Name</label>
                      <input id="rename" class="input" formControlName="nickname" maxlength="60" />
                    </div>
                    @if (dialogError()) { <div class="alert alert-error">{{ dialogError() }}</div> }
                  </div>
                  <footer>
                    <button class="btn btn-secondary" type="button" (click)="close()">Cancel</button>
                    <button class="btn btn-primary" type="submit" [disabled]="busy()">{{ busy() ? 'Saving…' : 'Save name' }}</button>
                  </footer>
                </form>
              }
              @case ('remove') {
                <header>
                  <h2 id="payee-title">Remove {{ d.payee.nickname }}?</h2>
                  <p>Past transfers stay in your history. You can add this payee again later.</p>
                </header>
                <div class="body">
                  @if (dialogError()) { <div class="alert alert-error">{{ dialogError() }}</div> }
                </div>
                <footer>
                  <button class="btn btn-secondary" (click)="close()">Keep payee</button>
                  <button class="btn btn-danger" [disabled]="busy()" (click)="remove(d.payee)">{{ busy() ? 'Removing…' : 'Remove payee' }}</button>
                </footer>
              }
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .actions { white-space: nowrap; }
    .actions .btn + .btn { margin-left: 6px; }
  `,
})
export class Payees {
  private readonly api = inject(BankApi);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly payees = signal<Beneficiary[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly dialog = signal<Dialog | null>(null);
  protected readonly busy = signal(false);
  protected readonly dialogError = signal<string | null>(null);
  protected readonly errors = signal<Record<string, string>>({});

  protected readonly addForm = this.fb.group({
    nickname: ['', [Validators.required, Validators.maxLength(60)]],
    accountNumber: ['', [Validators.required, Validators.pattern(/^\d{12}$/)]],
  });
  protected readonly renameForm = this.fb.group({
    nickname: ['', [Validators.required, Validators.maxLength(60)]],
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.api.beneficiaries().subscribe({
      next: (list) => { this.payees.set(list); this.loading.set(false); },
      error: (e) => { this.error.set(problemMessage(e)); this.loading.set(false); },
    });
  }

  openAdd(): void {
    this.addForm.reset();
    this.dialog.set({ kind: 'add' });
  }

  openRename(payee: Beneficiary): void {
    this.renameForm.setValue({ nickname: payee.nickname });
    this.dialog.set({ kind: 'rename', payee });
  }

  add(): void {
    const v = this.addForm.getRawValue();
    const local: Record<string, string> = {};
    if (!v.nickname.trim()) local['nickname'] = 'Enter a name for this payee';
    if (!/^\d{12}$/.test(v.accountNumber.trim())) local['accountNumber'] = 'Account numbers are 12 digits';
    this.errors.set(local);
    if (Object.keys(local).length) return;

    this.busy.set(true);
    this.api.addBeneficiary({ nickname: v.nickname.trim(), accountNumber: v.accountNumber.trim() }).subscribe({
      next: (p) => { this.done(`${p.nickname} saved`); },
      error: (e) => this.failed(e),
    });
  }

  rename(payee: Beneficiary): void {
    const nickname = this.renameForm.getRawValue().nickname.trim();
    if (!nickname) return this.dialogError.set('Enter a name for this payee.');
    this.busy.set(true);
    this.api.renameBeneficiary(payee.id, nickname).subscribe({
      next: () => this.done('Payee renamed'),
      error: (e) => this.failed(e),
    });
  }

  remove(payee: Beneficiary): void {
    this.busy.set(true);
    this.api.deleteBeneficiary(payee.id).subscribe({
      next: () => this.done(`${payee.nickname} removed`),
      error: (e) => this.failed(e),
    });
  }

  close(): void {
    this.dialog.set(null);
    this.dialogError.set(null);
    this.errors.set({});
  }

  private done(message: string): void {
    this.busy.set(false);
    this.close();
    this.toast.success(message);
    this.load();
  }

  private failed(e: unknown): void {
    this.busy.set(false);
    const fields = fieldErrors(e);
    this.errors.set(fields);
    this.dialogError.set(Object.keys(fields).length ? null : problemMessage(e));
  }
}
