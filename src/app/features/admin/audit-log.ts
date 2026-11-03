import { DatePipe, KeyValuePipe, LowerCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime } from 'rxjs';
import { BankApi } from '../../core/bank-api';
import { problemMessage } from '../../core/http.interceptors';
import { AuditEntry, AuditOutcome, AuditSource, Page } from '../../core/models';
import { Pager } from '../../shared/pager';
import { StatusBadge } from '../../shared/status-badge';

const SOURCES: { value: AuditSource; label: string; actions: [string, string][] }[] = [
  { value: 'auth', label: 'Sign-ins and profiles', actions: [
    ['LOGIN', 'Sign-in'], ['REGISTER', 'Registration'], ['PROFILE_UPDATE', 'Profile update'],
    ['PASSWORD_CHANGE', 'Password change'], ['USER_STATUS_CHANGE', 'Customer lock or unlock'],
  ] },
  { value: 'accounts', label: 'Accounts', actions: [['ACCOUNT_OPEN', 'Account opened'], ['ACCOUNT_STATUS_CHANGE', 'Account status change']] },
  { value: 'transactions', label: 'Money movement and payees', actions: [
    ['TRANSFER', 'Transfer'], ['DEPOSIT', 'Deposit'], ['BENEFICIARY_ADD', 'Payee added'],
    ['BENEFICIARY_RENAME', 'Payee renamed'], ['BENEFICIARY_DELETE', 'Payee removed'], ['RECONCILE', 'Reconciliation'],
  ] },
];

@Component({
  selector: 'nb-audit-log',
  imports: [DatePipe, KeyValuePipe, LowerCasePipe, FormsModule, Pager, StatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Audit log</h1>
          <p>Every change made in NovaBank, who made it and whether it worked. Page views and searches are not recorded.</p>
        </div>
      </div>
      @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
      <section class="panel">
        <div class="toolbar">
          <select class="select" [(ngModel)]="source" (ngModelChange)="action = ''; load(0)" aria-label="Which log">
            @for (s of sources; track s.value) { <option [value]="s.value">{{ s.label }}</option> }
          </select>
          <select class="select" [(ngModel)]="action" (ngModelChange)="load(0)" aria-label="Filter by action">
            <option value="">Any action</option>
            @for (a of actions(); track a[0]) { <option [value]="a[0]">{{ a[1] }}</option> }
          </select>
          <select class="select" [(ngModel)]="outcome" (ngModelChange)="load(0)" aria-label="Filter by result">
            <option value="">Any result</option>
            <option value="SUCCESS">Succeeded</option>
            <option value="FAILURE">Failed</option>
          </select>
          <input class="input" type="search" placeholder="Email, target or correlation id" [(ngModel)]="q" (ngModelChange)="search$.next()" aria-label="Search the audit log" />
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>When</th><th>Action</th><th>Who</th><th>Target</th><th>Result</th><th>Details</th></tr></thead>
            <tbody>
              @for (e of page()?.content ?? []; track e.id) {
                <tr>
                  <td class="small muted">{{ e.occurredAt | date: 'MMM d, h:mm:ss a' }}</td>
                  <td class="small">{{ label(e.action) }}</td>
                  <td class="small">
                    @if (e.actorRole === 'SYSTEM') { System }
                    @else if (e.actorId !== null) { #{{ e.actorId }} <span class="muted">{{ e.actorRole | lowercase }}</span> }
                    @else { <span class="muted">Not signed in</span> }
                    @if (e.actorEmail) { <div class="cell-sub">{{ e.actorEmail }}</div> }
                  </td>
                  <td class="num small">{{ e.targetId ? (e.targetType | lowercase) + ' ' + e.targetId : '—' }}</td>
                  <td>
                    <nb-status [value]="e.outcome" />
                    @if (e.reason) { <div class="cell-sub debit">{{ e.reason }}</div> }
                  </td>
                  <td class="small">
                    @for (d of e.details | keyvalue; track d.key) { <div><span class="muted">{{ d.key }}</span> {{ d.value }}</div> }
                    @if (e.correlationId) { <div class="cell-sub num" title="Correlation id">{{ e.correlationId }}</div> }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="6"><div class="empty"><strong>Nothing recorded yet</strong>Clear the filters or pick another log.</div></td></tr>
              }
            </tbody>
          </table>
        </div>
        <nb-pager [page]="pageNo()" [size]="20" [total]="page()?.page?.totalElements ?? 0" [pages]="page()?.page?.totalPages ?? 1" (go)="load($event)" />
      </section>
    </div>
  `,
})
export class AuditLog {
  private readonly api = inject(BankApi);
  protected readonly sources = SOURCES;
  protected readonly page = signal<Page<AuditEntry> | null>(null);
  protected readonly pageNo = signal(0);
  protected readonly error = signal<string | null>(null);
  protected readonly search$ = new Subject<void>();
  protected source: AuditSource = 'auth';
  protected action = '';
  protected outcome: AuditOutcome | '' = '';
  protected q = '';

  constructor() {
    this.search$.pipe(debounceTime(250), takeUntilDestroyed()).subscribe(() => this.load(0));
    this.load(0);
  }

  protected actions(): [string, string][] {
    return SOURCES.find((s) => s.value === this.source)?.actions ?? [];
  }

  protected label(action: string): string {
    return SOURCES.flatMap((s) => s.actions).find(([a]) => a === action)?.[1] ?? action;
  }

  load(n: number): void {
    this.pageNo.set(n);
    this.error.set(null);
    this.api.auditLog(this.source, { action: this.action, outcome: this.outcome, q: this.q, page: n, size: 20 }).subscribe({
      next: (p) => this.page.set(p),
      error: (e) => this.error.set(problemMessage(e)),
    });
  }
}
