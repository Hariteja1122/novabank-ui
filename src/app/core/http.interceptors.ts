import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { Problem } from './models';

/** Adds the bearer token to API calls and signs the user out when the token is rejected. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();
  const authed = token && req.url.startsWith('/api') ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authed).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && token && !req.url.endsWith('/auth/login')) {
        auth.logout('expired');
      }
      return throwError(() => err);
    }),
  );
};

/** Turns any HTTP error into one readable sentence for the UI. */
export function problemMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const p = err.error as Problem | null;
    if (p && typeof p === 'object' && p.detail) return p.detail;
    if (err.status === 0) return 'Cannot reach NovaBank. Check that the API gateway is running.';
    if (err.status === 503 || err.status === 502) return 'The service is starting up. Try again in a moment.';
  }
  return 'Something went wrong. Please try again.';
}

export function fieldErrors(err: unknown): Record<string, string> {
  if (err instanceof HttpErrorResponse && err.error && typeof err.error === 'object') {
    return (err.error as Problem).errors ?? {};
  }
  return {};
}
