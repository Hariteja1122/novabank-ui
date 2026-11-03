import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AuditEntry, Page } from '../models';
import { mockBackendInterceptor } from './mock-backend';

describe('mock backend audit log', () => {
  let http: HttpClient;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([mockBackendInterceptor]))] });
    http = TestBed.inject(HttpClient);
  });

  async function adminToken(): Promise<string> {
    const res = await firstValueFrom(http.post<{ token: string }>('/api/auth/login', { email: 'admin@novabank.dev', password: 'Admin@123' }));
    return res.token;
  }

  function audit(token: string, query: string): Promise<Page<AuditEntry>> {
    return firstValueFrom(http.get<Page<AuditEntry>>(`/api/admin/audit?${query}`, { headers: { Authorization: `Bearer ${token}` } }));
  }

  it('records a failed sign-in with the email tried and the reason, never the password', async () => {
    await firstValueFrom(http.post('/api/auth/login', { email: 'john.carter@example.com', password: 'Spec-Secret#77' })).catch(() => null);

    const page = await audit(await adminToken(), 'action=LOGIN&outcome=FAILURE');
    const row = page.content.find((e) => e.actorEmail === 'john.carter@example.com' && e.reason === 'Wrong password');

    expect(row).toBeTruthy();
    expect(row!.httpStatus).toBe(401);
    expect(row!.actorId).toBeNull();
    expect(JSON.stringify(page)).not.toContain('Spec-Secret');
  });

  it('filters by actor and keeps reads out of the log', async () => {
    const token = await adminToken();
    await audit(token, '');

    const mine = await audit(token, 'actor=1');
    expect(mine.content.length).toBeGreaterThan(0);
    expect(mine.content.every((e) => e.actorId === 1)).toBe(true);
    expect(mine.content.some((e) => e.action === 'LOGIN' && e.outcome === 'SUCCESS')).toBe(true);

    const all = await audit(token, 'size=100');
    expect(all.content.every((e) => !e.action.startsWith('GET'))).toBe(true);
  });

  it('is admin only', async () => {
    const customer = await firstValueFrom(http.post<{ token: string }>('/api/auth/login', { email: 'john.carter@example.com', password: 'Password@123' }));
    const status = await audit(customer.token, '').then(() => 200, (e) => e.status);
    expect(status).toBe(403);
  });
});
