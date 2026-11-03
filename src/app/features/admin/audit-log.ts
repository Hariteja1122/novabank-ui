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
  { value: 'accounts', label: 'Accounts', actions: [['ACCOUNT_OPEN', 'Account opened'], ['ACCOUNT_STATUS_CHANGE', 'Account freeze, unfreeze or close']] },
  { value: 'transactions', label: 'Money movement and payees', actions: [
    ['TRANSFER', 'Transfer'], ['DEPOSIT', 'Teller deposit'], ['BENEFICIARY_ADD', 'Payee added'],
    ['BENEFICIARY_RENAME', 'Payee renamed'], ['BENEFICIARY_DELETE', 'Payee removed'], ['RECONCILE', 'Reconciliation'],
  ] },
];

/** A yyyy-mm-dd date input as the start of that day in the viewer's time zone, as an ISO instant. */
function startOfDay(date: string, plusDays = 0): string | null {
  if (!date) return null;
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + plusDays);
  return d.toISOString();
}

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
          <select class="select" [(ngModel)]="action" (ngModelChange)="load(0)" aria-label="Filter by action">
            <option value="">Any action</option>
            @for (s of sources; track s.value) {
              <optgroup [label]="s.label">
                @for (a of s.actions; track a[0]) { <option [value]="a[0]">{{ a[1] }}</option> }
              </optgroup>
            }
          </select>
          <select class="select" [(ngModel)]="outcome" (ngModelChange)="load(0)" aria-label="Filter by result">
            <option value="">Any result</option>
            <option value="SUCCESS">Succeeded</option>
            <option value="FAILURE">Failed</option>
          </select>
          <input class="input" type="search" placeholder="Who: user id or email" [(ngModel)]="actor" (ngModelChange)="search$.next()" aria-label="Filter by who made the change" />
          <input class="input date" type="date" [(ngModel)]="from" (ngModelChange)="load(0)" aria-label="From date" />
          <input class="input date" type="date" [(ngModel)]="to" (ngModelChange)="load(0)" aria-label="To date (inclusive)" />
          <input class="input" type="search" placeholder="Target or correlation id" [(ngModel)]="q" (ngModelChange)="search$.next()" aria-label="Search by target or correlation id" />
          @if (filtered()) { <button class="btn btn-secondary btn-sm" (click)="clear()">Clear filters</button> }
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>When</th><th>Action</th><th>Who</th><th>Target</th><th>Result</th><th>Details</th></tr></thead>
            <tbody>
              @for (e of page()?.content ?? []; track e.id) {
                <tr>
                  <td class="small muted">{{ e.createdAt | date: 'MMM d, h:mm:ss a' }}</td>
                  <td class="small">
                    {{ label(e.action) }}
                    <div class="cell-sub">{{ sourceLabel(e.service) }}</div>
                  </td>
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
                <tr><td colspan="6"><div class="empty"><strong>Nothing matches</strong>Clear the filters or widen the date range.</div></td></tr>
              }
            </tbody>
          </table>
        </div>
        <nb-pager [page]="pageNo()" [size]="20" [total]="page()?.page?.totalElements ?? 0" [pages]="page()?.page?.totalPages ?? 1" (go)="load($event)" />
      </section>
    </div>
  `,
  styles: [`.toolbar .input.date { flex: 0 0 auto; min-width: 150px; }`],
})
export class AuditLog {
  private readonly api = inject(BankApi);
  protected readonly sources = SOURCES;
  protected readonly page = signal<Page<AuditEntry> | null>(null);
  protected readonly pageNo = signal(0);
  protected readonly error = signal<string | null>(null);
  protected readonly search$ = new Subject<void>();
  protected action = '';
  protected outcome: AuditOutcome | '' = '';
  protected actor = '';
  protected from = '';
  protected to = '';
  protected q = '';

  constructor() {
    this.search$.pipe(debounceTime(250), takeUntilDestroyed()).subscribe(() => this.load(0));
    this.load(0);
  }

  protected label(action: string): string {
    return SOURCES.flatMap((s) => s.actions).find(([a]) => a === action)?.[1] ?? action;
  }

  protected sourceLabel(service: AuditSource): string {
    return SOURCES.find((s) => s.value === service)?.label ?? service;
  }

  protected filtered(): boolean {
    return !!(this.action || this.outcome || this.actor || this.from || this.to || this.q);
  }

  protected clear(): void {
    this.action = this.actor = this.from = this.to = this.q = '';
    this.outcome = '';
    this.load(0);
  }

  load(n: number): void {
    this.pageNo.set(n);
    this.error.set(null);
    this.api.auditLog({
      action: this.action, outcome: this.outcome, actor: this.actor.trim(), q: this.q.trim(),
      from: startOfDay(this.from), to: startOfDay(this.to, 1), page: n, size: 20,
    }).subscribe({
      next: (p) => this.page.set(p),
      error: (e) => this.error.set(problemMessage(e)),
    });
  }
}
