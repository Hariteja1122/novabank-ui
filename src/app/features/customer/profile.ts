import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { BankApi } from '../../core/bank-api';
import { problemMessage } from '../../core/http.interceptors';
import { ToastService } from '../../core/toast.service';

const STRONG = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,64}$/;

/** Profile page, shared by customers and admins. */
@Component({
  selector: 'nb-profile',
  imports: [ReactiveFormsModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Profile and security</h1>
          <p>Signed in as {{ auth.user()?.email }}. Last sign in {{ auth.user()?.lastLoginAt | date: 'medium' }}.</p>
        </div>
      </div>
      <div class="grid grid-2">
        <section class="panel">
          <div class="panel-head"><h2>Personal details</h2></div>
          <form class="panel-body" [formGroup]="details" (ngSubmit)="saveDetails()">
            <div class="field">
              <label for="fullName">Full name</label>
              <input id="fullName" class="input" formControlName="fullName" />
            </div>
            <div class="field">
              <label for="phone">Mobile phone</label>
              <input id="phone" class="input" formControlName="phone" />
            </div>
            <div class="field">
              <label for="email">Email</label>
              <input id="email" class="input" [value]="auth.user()?.email" disabled />
              <span class="hint">Contact support to change the email on your profile.</span>
            </div>
            @if (detailsError()) { <div class="alert alert-error">{{ detailsError() }}</div> }
            <button class="btn btn-primary" type="submit" [disabled]="busy()">Save details</button>
          </form>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>Password</h2></div>
          <form class="panel-body" [formGroup]="password" (ngSubmit)="changePassword()">
            <div class="field">
              <label for="current">Current password</label>
              <input id="current" class="input" type="password" formControlName="currentPassword" autocomplete="current-password" />
            </div>
            <div class="field">
              <label for="new">New password</label>
              <input id="new" class="input" type="password" formControlName="newPassword" autocomplete="new-password" />
              <span class="hint">8 or more characters with an upper case letter, a number and a symbol.</span>
            </div>
            @if (passwordError()) { <div class="alert alert-error">{{ passwordError() }}</div> }
            <button class="btn btn-primary" type="submit" [disabled]="busy()">Change password</button>
          </form>
        </section>
      </div>
    </div>
  `,
})
export class Profile {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(BankApi);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly busy = signal(false);
  protected readonly detailsError = signal<string | null>(null);
  protected readonly passwordError = signal<string | null>(null);

  protected readonly details = this.fb.group({
    fullName: [this.auth.user()?.fullName ?? '', [Validators.required, Validators.maxLength(120)]],
    phone: [this.auth.user()?.phone ?? ''],
  });
  protected readonly password = this.fb.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.pattern(STRONG)]],
  });

  saveDetails(): void {
    if (this.details.invalid) return this.detailsError.set('Enter your full name.');
    this.busy.set(true);
    const v = this.details.getRawValue();
    this.api.updateProfile({ fullName: v.fullName, phone: v.phone || null }).subscribe({
      next: (u) => { this.auth.updateUser(u); this.detailsError.set(null); this.busy.set(false); this.toast.success('Details saved'); },
      error: (e) => { this.detailsError.set(problemMessage(e)); this.busy.set(false); },
    });
  }

  changePassword(): void {
    if (this.password.invalid) return this.passwordError.set('Enter your current password and a strong new password.');
    this.busy.set(true);
    this.api.changePassword(this.password.getRawValue()).subscribe({
      next: () => { this.password.reset(); this.passwordError.set(null); this.busy.set(false); this.toast.success('Password changed'); },
      error: (e) => { this.passwordError.set(problemMessage(e)); this.busy.set(false); },
    });
  }
}
