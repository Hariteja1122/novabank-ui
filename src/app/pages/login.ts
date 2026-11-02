import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { problemMessage } from '../core/http.interceptors';

@Component({
  selector: 'nb-login',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './auth-layout.scss',
  template: `
    <section class="story">
      <div class="logo"><span>N</span> NovaBank</div>
      <div class="statement">
        <h1>Every dollar accounted for, to the cent.</h1>
        <p>Check balances, move money between accounts and review every transaction in one place.</p>
      </div>
      <div class="ledger" aria-hidden="true">
        <div><span>Checking •••• 0031</span><b>$10,729.99</b></div>
        <div><span>Savings •••• 0049</span><b>$26,250.35</b></div>
        <div><span>Transfer to Priya S.</span><b>−$250.00</b></div>
      </div>
    </section>

    <section class="form-side">
      <div class="card">
        <h2>Sign in</h2>
        <p>Use your NovaBank email and password.</p>

        @if (notice) {
          <div class="alert alert-info">{{ notice }}</div>
        }
        @if (error()) {
          <div class="alert alert-error" role="alert">{{ error() }}</div>
        }

        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="field">
            <label for="email">Email</label>
            <input id="email" class="input" type="email" formControlName="email" autocomplete="username" />
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input id="password" class="input" type="password" formControlName="password" autocomplete="current-password" />
          </div>
          <button class="btn btn-primary btn-block" type="submit" [disabled]="busy()">
            {{ busy() ? 'Signing in…' : 'Sign in' }}
          </button>
        </form>

        <p class="switch">New to NovaBank? <a routerLink="/register">Open an account</a></p>

        <div class="demo">
          <p>Sample logins from the demo database</p>
          <div class="demo-row">
            <button class="btn btn-secondary btn-sm" type="button" (click)="fill('john.carter@example.com', 'Password@123')">Customer: John Carter</button>
            <button class="btn btn-secondary btn-sm" type="button" (click)="fill('admin@novabank.dev', 'Admin@123')">Admin: Grace Hopper</button>
          </div>
        </div>
      </div>
    </section>
  `,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice =
    inject(ActivatedRoute).snapshot.queryParamMap.get('reason') === 'expired'
      ? 'Your session ended. Please sign in again.'
      : null;

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  fill(email: string, password: string): void {
    this.form.setValue({ email, password });
  }

  submit(): void {
    if (this.form.invalid) {
      this.error.set('Enter your email and password.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: (res) => this.router.navigateByUrl(this.auth.homeFor(res.user.role)),
      error: (err) => {
        this.error.set(problemMessage(err));
        this.busy.set(false);
      },
    });
  }
}
