import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthResponse, Role, User } from './models';

interface Session {
  token: string;
  expiresAt: number;
  user: User;
}

const STORAGE_KEY = 'novabank.session';

/**
 * Holds the signed-in user in a signal. The session lives in sessionStorage, so closing
 * the browser tab signs the user out, which is the norm for online banking.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly session = signal<Session | null>(this.restore());
  private logoutTimer?: ReturnType<typeof setTimeout>;

  readonly user = computed(() => this.session()?.user ?? null);
  readonly token = computed(() => this.session()?.token ?? null);
  readonly isLoggedIn = computed(() => this.session() !== null);
  readonly role = computed<Role | null>(() => this.session()?.user.role ?? null);

  constructor() {
    this.scheduleExpiry();
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiBase}/auth/login`, { email, password })
      .pipe(tap((res) => this.start(res)));
  }

  register(body: { fullName: string; email: string; phone: string | null; password: string }): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiBase}/auth/register`, body)
      .pipe(tap((res) => this.start(res)));
  }

  updateUser(user: User): void {
    const s = this.session();
    if (s) {
      this.persist({ ...s, user });
    }
  }

  homeFor(role: Role | null): string {
    return role === 'ADMIN' ? '/admin' : '/app';
  }

  logout(reason?: 'expired'): void {
    clearTimeout(this.logoutTimer);
    this.session.set(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
    this.router.navigate(['/login'], reason ? { queryParams: { reason } } : {});
  }

  private start(res: AuthResponse): void {
    this.persist({ token: res.token, user: res.user, expiresAt: Date.now() + res.expiresInSeconds * 1000 });
    this.scheduleExpiry();
  }

  private persist(s: Session): void {
    this.session.set(s);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      /* storage unavailable: session lasts for this page only */
    }
  }

  private restore(): Session | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as Session;
      return s.expiresAt > Date.now() ? s : null;
    } catch {
      return null;
    }
  }

  private scheduleExpiry(): void {
    clearTimeout(this.logoutTimer);
    const s = this.session();
    if (s) {
      this.logoutTimer = setTimeout(() => this.logout('expired'), Math.max(0, s.expiresAt - Date.now()));
    }
  }
}
