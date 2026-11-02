import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { fieldErrors, problemMessage } from '../core/http.interceptors';

const STRONG = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,64}$/;

@Component({
  selector: 'nb-register',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './auth-layout.scss',
  template: `
    <section class="story">
      <div class="logo"><span>N</span> NovaBank</div>
      <div class="statement">
        <h1>Open a checking account in under a minute.</h1>
        <p>Your account number is ready as soon as you finish. No branch visit, no minimum balance.</p>
      </div>
    </section>

    <section class="form-side">
      <div class="card">
        <h2>Open an account</h2>
        <p>We create a checking account for you right away.</p>

        @if (error()) {
          <div class="alert alert-error" role="alert">{{ error() }}</div>
        }

        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="field">
            <label for="fullName">Full name</label>
            <input id="fullName" class="input" formControlName="fullName" autocomplete="name" />
            @if (serverErrors()['fullName']; as e) { <span class="error">{{ e }}</span> }
          </div>
          <div class="field">
            <label for="email">Email</label>
            <input id="email" class="input" type="email" formControlName="email" autocomplete="email" />
            @if (serverErrors()['email']; as e) { <span class="error">{{ e }}</span> }
          </div>
          <div class="field">
            <label for="phone">Mobile phone <span class="muted">(optional)</span></label>
            <input id="phone" class="input" formControlName="phone" autocomplete="tel" placeholder="+1 248 555 0100" />
            @if (serverErrors()['phone']; as e) { <span class="error">{{ e }}</span> }
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input id="password" class="input" type="password" formControlName="password" autocomplete="new-password"
              [class.invalid]="form.controls.password.touched && form.controls.password.invalid" />
            <span class="hint">8 or more characters with an upper case letter, a number and a symbol.</span>
          </div>
          <button class="btn btn-primary btn-block" type="submit" [disabled]="busy()">
            {{ busy() ? 'Opening your account…' : 'Open account' }}
          </button>
        </form>
        <p class="switch">Already a customer? <a routerLink="/login">Sign in</a></p>
      </div>
    </section>
  `,
})
export class Register {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly serverErrors = signal<Record<string, string>>({});

  protected readonly form = inject(FormBuilder).nonNullable.group({
    fullName: ['', [Validators.required, Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    password: ['', [Validators.required, Validators.pattern(STRONG)]],
  });

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.error.set('Check the highlighted fields.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    const v = this.form.getRawValue();
    this.auth.register({ ...v, phone: v.phone || null }).subscribe({
      next: () => this.router.navigateByUrl('/app'),
      error: (err) => {
        this.error.set(problemMessage(err));
        this.serverErrors.set(fieldErrors(err));
        this.busy.set(false);
      },
    });
  }
}
