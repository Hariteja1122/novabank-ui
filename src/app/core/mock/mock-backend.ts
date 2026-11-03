import { HttpErrorResponse, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable, delay, of, tap, throwError } from 'rxjs';
import {
  Account, AccountStatus, AccountType, AuditEntry, AuditSource, Beneficiary, Page, Transaction, TxnStatus, User, UserStatus,
} from '../models';

/*
 * Demo mode backend. Mirrors the real REST contract closely enough to click through
 * every screen without Docker or Db2. Data resets on page reload.
 * Enabled only by `npm run start:mock` (environment.mock.ts).
 */

const DAY = 86_400_000;
const now = Date.now();
const ago = (days: number, hours = 0) => new Date(now - days * DAY - hours * 3_600_000).toISOString();

const users: (User & { password: string })[] = [
  { id: 1, email: 'admin@novabank.dev', password: 'Admin@123', fullName: 'Grace Hopper', phone: '+1 313 555 0100', role: 'ADMIN', status: 'ACTIVE', createdAt: ago(120), lastLoginAt: ago(0, 2) },
  { id: 2, email: 'ops@novabank.dev', password: 'Admin@123', fullName: 'Alan Brooks', phone: '+1 313 555 0101', role: 'ADMIN', status: 'ACTIVE', createdAt: ago(110), lastLoginAt: ago(1) },
  { id: 3, email: 'john.carter@example.com', password: 'Password@123', fullName: 'John Carter', phone: '+1 248 555 0142', role: 'CUSTOMER', status: 'ACTIVE', createdAt: ago(95), lastLoginAt: ago(0, 5) },
  { id: 4, email: 'priya.sharma@example.com', password: 'Password@123', fullName: 'Priya Sharma', phone: '+1 248 555 0178', role: 'CUSTOMER', status: 'ACTIVE', createdAt: ago(90), lastLoginAt: ago(2) },
  { id: 5, email: 'michael.chen@example.com', password: 'Password@123', fullName: 'Michael Chen', phone: '+1 734 555 0119', role: 'CUSTOMER', status: 'ACTIVE', createdAt: ago(80), lastLoginAt: ago(3) },
  { id: 6, email: 'sofia.alvarez@example.com', password: 'Password@123', fullName: 'Sofia Alvarez', phone: '+1 586 555 0163', role: 'CUSTOMER', status: 'ACTIVE', createdAt: ago(70), lastLoginAt: ago(1) },
  { id: 7, email: 'david.okafor@example.com', password: 'Password@123', fullName: 'David Okafor', phone: '+1 313 555 0187', role: 'CUSTOMER', status: 'LOCKED', createdAt: ago(60), lastLoginAt: ago(9) },
  { id: 8, email: 'emily.nguyen@example.com', password: 'Password@123', fullName: 'Emily Nguyen', phone: '+1 947 555 0134', role: 'CUSTOMER', status: 'ACTIVE', createdAt: ago(20), lastLoginAt: ago(0, 9) },
];

const acct = (id: number, no: string, cid: number, type: AccountType, balance: number, status: AccountStatus, opened: number): Account => ({
  id, accountNumber: no, customerId: cid, customerName: users.find((u) => u.id === cid)!.fullName,
  accountType: type, balance, currency: 'USD', status, openedAt: ago(opened),
});

const accounts: Account[] = [
  acct(1, '100245180031', 3, 'CHECKING', 10729.99, 'ACTIVE', 94),
  acct(2, '100245180049', 3, 'SAVINGS', 26250.35, 'ACTIVE', 94),
  acct(3, '100245180057', 4, 'CHECKING', 8268.79, 'ACTIVE', 89),
  acct(4, '100245180065', 4, 'SAVINGS', 34010.24, 'ACTIVE', 89),
  acct(5, '100245180073', 5, 'CHECKING', 3384.77, 'ACTIVE', 79),
  acct(6, '100245180081', 6, 'CHECKING', 9259.72, 'ACTIVE', 69),
  acct(7, '100245180099', 6, 'SAVINGS', 12640.33, 'FROZEN', 69),
  acct(8, '100245180102', 7, 'CHECKING', 3752.11, 'ACTIVE', 59),
  acct(9, '100245180110', 8, 'CHECKING', 10696.57, 'ACTIVE', 19),
  acct(10, '100245180128', 8, 'SAVINGS', 9344.23, 'ACTIVE', 19),
];

// Same payees as novabank-platform/db2/schema/02-sample-data.sql
const beneficiaries: (Beneficiary & { customerId: number })[] = [
  { id: 1, customerId: 3, nickname: 'Priya (rent)', accountNumber: '100245180057', createdAt: ago(80) },
  { id: 2, customerId: 3, nickname: 'Michael Chen', accountNumber: '100245180073', createdAt: ago(41) },
  { id: 3, customerId: 3, nickname: 'Emily (book club)', accountNumber: '100245180110', createdAt: ago(12) },
  { id: 4, customerId: 4, nickname: 'John Carter', accountNumber: '100245180031', createdAt: ago(60) },
];
let beneficiarySeq = 1000;
const publicPayee = ({ customerId: _c, ...b }: Beneficiary & { customerId: number }): Beneficiary => b;

const descs = ['Rent share', 'Groceries', 'Utilities', 'Dinner split', 'Moving to savings', 'Gym membership', 'Car repair', 'Concert tickets', 'Insurance premium', 'Freelance invoice'];
let seq = 0;
const ref = () => `NB26${String(1102 - Math.floor(seq / 9)).padStart(4, '0')}-${(++seq * 7919).toString(36).toUpperCase().padStart(6, 'Q').slice(-6)}`;

const transactions: Transaction[] = [];
function seedTxn(type: Transaction['type'], from: string | null, to: string, amount: number, days: number, hours: number, status: TxnStatus = 'COMPLETED', description?: string, failureReason: string | null = null) {
  transactions.push({
    id: transactions.length + 1, reference: ref(), type, fromAccount: from, toAccount: to, amount, currency: 'USD', status,
    description: description ?? (type === 'DEPOSIT' ? 'Payroll credit' : descs[(days + hours) % descs.length]),
    failureReason, initiatedBy: from ? accounts.find((a) => a.accountNumber === from)!.customerId : 1,
    createdAt: ago(days, hours), completedAt: status === 'COMPLETED' ? ago(days, hours) : null, direction: null,
  });
}
// deterministic spread of activity over the last two weeks
const pool = accounts.filter((a) => a.status === 'ACTIVE').map((a) => a.accountNumber);
for (let d = 13; d >= 0; d--) {
  const n = 2 + ((d * 7) % 5);
  for (let i = 0; i < n; i++) {
    const from = pool[(d + i * 3) % pool.length];
    const to = pool[(d * 2 + i + 1) % pool.length];
    if (from !== to) seedTxn('TRANSFER', from, to, Math.round((40 + ((d + 1) * (i + 3) * 37) % 900) * 100) / 100 + 0.45, d, 1 + i * 3);
  }
  if (d % 3 === 0) seedTxn('DEPOSIT', null, pool[d % pool.length], 2240.5 + d * 13, d, 9);
}
seedTxn('TRANSFER', '100245180073', '100245180099', 150, 3, 5, 'FAILED', 'Savings top up', 'Destination account is FROZEN');
seedTxn('TRANSFER', '100245180110', '100245180031', 99999, 1, 3, 'FAILED', 'Typo amount', 'Insufficient funds');
transactions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

// ---------------------------------------------------------------- helpers
function token(u: User): string {
  const payload = btoa(JSON.stringify({ sub: String(u.id), role: u.role, name: u.fullName, email: u.email }));
  return `mock.${payload}.sig`;
}
function caller(req: HttpRequest<unknown>): User | null {
  const h = req.headers.get('Authorization');
  if (!h) return null;
  try {
    const p = JSON.parse(atob(h.replace('Bearer ', '').split('.')[1]));
    return users.find((u) => u.id === Number(p.sub)) ?? null;
  } catch {
    return null;
  }
}
const publicUser = ({ password: _p, ...u }: User & { password: string }): User => u;
const ok = <T>(body: T, status = 200) => of(new HttpResponse({ status, body })).pipe(delay(220));
const fail = (status: number, detail: string, extra: object = {}): Observable<never> =>
  throwError(() => new HttpErrorResponse({ status, error: { status, detail, ...extra } })).pipe(delay(220)) as Observable<never>;
function page<T>(items: T[], q: URLSearchParams): Page<T> {
  const size = Number(q.get('size') ?? 20);
  const number = Number(q.get('page') ?? 0);
  return {
    content: items.slice(number * size, number * size + size),
    page: { size, number, totalElements: items.length, totalPages: Math.max(1, Math.ceil(items.length / size)) },
  };
}
const like = (v: string | null | undefined, q: string | null) => !q || (v ?? '').toLowerCase().includes(q.toLowerCase());
const idem = new Map<string, Transaction>();

function record(t: Omit<Transaction, 'id' | 'reference' | 'createdAt' | 'completedAt' | 'direction' | 'currency'>): Transaction {
  const txn: Transaction = {
    ...t, id: transactions.length + 1000, reference: ref(), currency: 'USD', createdAt: new Date().toISOString(),
    completedAt: t.status === 'COMPLETED' ? new Date().toISOString() : null, direction: null,
  };
  transactions.unshift(txn);
  return txn;
}

// ---------------------------------------------------------------- audit log
// Mirrors the services: one row per state-changing request, success or failure.
// Reads are never recorded, and no part of a password ever goes into a row.
const audit: AuditEntry[] = [];
let auditSeq = 0;
function audited(source: AuditSource, e: Omit<AuditEntry, 'id' | 'service' | 'correlationId' | 'sourceIp' | 'createdAt'> & { createdAt?: string }) {
  audit.unshift({ id: ++auditSeq, service: source, createdAt: new Date().toISOString(), correlationId: crypto.randomUUID(), sourceIp: '127.0.0.1', ...e });
  audit.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
const row = (action: string, targetType: string | null, targetId: string | null, actor: User | null, details: Record<string, string> = {}) => ({
  action, targetType, targetId, actorId: actor?.id ?? null, actorRole: actor?.role ?? null, actorEmail: actor?.email ?? null,
  outcome: 'SUCCESS' as const, httpStatus: 200, reason: null, details,
});
// A little history so the page has something to show.
audited('auth', { ...row('LOGIN', 'USER', '3', null), actorEmail: 'john.carter@example.com', outcome: 'FAILURE', httpStatus: 401, reason: 'Wrong password', createdAt: ago(0, 5) });
audited('auth', { ...row('LOGIN', null, null, null), actorEmail: 'jon.carter@example.com', outcome: 'FAILURE', httpStatus: 401, reason: 'Unknown email', createdAt: ago(0, 4) });
audited('auth', { ...row('LOGIN', 'USER', '7', null), actorEmail: 'david.okafor@example.com', outcome: 'FAILURE', httpStatus: 403, reason: 'Profile is locked', createdAt: ago(0, 3) });
audited('auth', { ...row('USER_STATUS_CHANGE', 'USER', '7', users[0], { from: 'ACTIVE', to: 'LOCKED' }), createdAt: ago(9) });
audited('accounts', { ...row('ACCOUNT_STATUS_CHANGE', 'ACCOUNT', '100245180099', users[0], { from: 'ACTIVE', to: 'FROZEN' }), createdAt: ago(6) });
audited('accounts', { ...row('ACCOUNT_STATUS_CHANGE', 'ACCOUNT', '100245180057', users[1], { from: 'ACTIVE', to: 'CLOSED' }), outcome: 'FAILURE', httpStatus: 400, reason: 'Only accounts with a zero balance can be closed', createdAt: ago(2) });
audited('transactions', { ...row('DEPOSIT', 'TRANSACTION', 'NB2600475140', users[0], { toAccount: '100245180081', amount: '1500.24' }), httpStatus: 201, createdAt: ago(4) });

type Rule = [method: string, pattern: RegExp, source: AuditSource, action: string, targetType: string | null];
const AUDITED: Rule[] = [
  ['POST', /^\/api\/auth\/login$/, 'auth', 'LOGIN', 'USER'],
  ['POST', /^\/api\/auth\/register$/, 'auth', 'REGISTER', 'USER'],
  ['PUT', /^\/api\/auth\/me$/, 'auth', 'PROFILE_UPDATE', 'USER'],
  ['POST', /^\/api\/auth\/change-password$/, 'auth', 'PASSWORD_CHANGE', 'USER'],
  ['PATCH', /^\/api\/admin\/users\/(\d+)\/status$/, 'auth', 'USER_STATUS_CHANGE', 'USER'],
  ['POST', /^\/api\/accounts$/, 'accounts', 'ACCOUNT_OPEN', 'ACCOUNT'],
  ['POST', /^\/api\/admin\/accounts$/, 'accounts', 'ACCOUNT_OPEN', 'ACCOUNT'],
  ['PATCH', /^\/api\/admin\/accounts\/(\d{12})\/status$/, 'accounts', 'ACCOUNT_STATUS_CHANGE', 'ACCOUNT'],
  ['POST', /^\/api\/transactions\/transfer$/, 'transactions', 'TRANSFER', 'TRANSACTION'],
  ['POST', /^\/api\/admin\/transactions\/deposit$/, 'transactions', 'DEPOSIT', 'TRANSACTION'],
  ['POST', /^\/api\/beneficiaries$/, 'transactions', 'BENEFICIARY_ADD', 'BENEFICIARY'],
  ['PUT', /^\/api\/beneficiaries\/(\d+)$/, 'transactions', 'BENEFICIARY_RENAME', 'BENEFICIARY'],
  ['DELETE', /^\/api\/beneficiaries\/(\d+)$/, 'transactions', 'BENEFICIARY_DELETE', 'BENEFICIARY'],
];

export const mockBackendInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api')) return next(req);
  const path = new URL(req.urlWithParams, 'http://mock').pathname;
  const rule = AUDITED.find(([m, re]) => m === req.method && re.test(path));
  if (!rule) return route(req, next);
  const [, re, source, action, targetType] = rule;
  const body = (req.body ?? {}) as Record<string, any>;
  let actor = caller(req);
  let email = actor?.email ?? null;
  let reason: string | null = null;
  let targetId = path.match(re)?.[1] ?? (action === 'PROFILE_UPDATE' || action === 'PASSWORD_CHANGE' ? String(actor?.id ?? '') : null);
  if (action === 'LOGIN') {
    // Only the email is read here. The password is compared by route() and never stored.
    const tried = String(body['email'] ?? '').trim();
    email = tried;
    const u = users.find((x) => x.email === tried.toLowerCase());
    targetId = u ? String(u.id) : null;
    reason = !u ? 'Unknown email' : u.password !== body['password'] ? 'Wrong password' : u.status === 'LOCKED' ? 'Profile is locked' : null;
  }
  const details: Record<string, string> = {};
  if (body['status']) details['to'] = String(body['status']);
  if (body['amount']) details['amount'] = Number(body['amount']).toFixed(2);
  if (body['fromAccount']) details['fromAccount'] = String(body['fromAccount']);
  if (body['toAccount']) details['toAccount'] = String(body['toAccount']);
  if (body['accountNumber']) details['accountNumber'] = String(body['accountNumber']);
  const write = (httpStatus: number, failure: string | null, result: any) => {
    if (action === 'LOGIN' || action === 'REGISTER') {
      const u = result?.user as User | undefined;
      if (u) actor = u;
      if (!email) email = String(body['email'] ?? '').trim().toLowerCase();
      if (u) targetId = String(u.id);
    }
    if (!targetId && result) targetId = String(result.reference ?? result.accountNumber ?? result.id ?? '') || null;
    const ok = httpStatus < 400;
    audited(source, {
      action, targetType, targetId, actorId: ok || action !== 'LOGIN' ? actor?.id ?? null : null,
      actorRole: ok || action !== 'LOGIN' ? actor?.role ?? null : null, actorEmail: email,
      outcome: ok ? 'SUCCESS' : 'FAILURE', httpStatus, reason: ok ? null : reason ?? failure, details,
    });
  };
  return route(req, next).pipe(tap({
    next: (ev) => { if (ev instanceof HttpResponse) write(ev.status, null, ev.body); },
    error: (e: HttpErrorResponse) => write(e.status, e.error?.detail ?? null, e.error),
  }));
};

// ---------------------------------------------------------------- routes
function route(req: HttpRequest<unknown>, next: Parameters<HttpInterceptorFn>[1]): Observable<any> {
  const url = new URL(req.urlWithParams, 'http://mock');
  const path = url.pathname;
  const q = url.searchParams;
  const body = (req.body ?? {}) as Record<string, any>;
  const me = caller(req);
  const m = req.method;

  // auth
  if (m === 'POST' && path === '/api/auth/login') {
    const u = users.find((x) => x.email === String(body['email']).toLowerCase() && x.password === body['password']);
    if (!u) return fail(401, 'Invalid email or password');
    if (u.status === 'LOCKED') return fail(403, 'Your profile is locked. Please contact NovaBank support.');
    u.lastLoginAt = new Date().toISOString();
    return ok({ token: token(u), expiresInSeconds: 3600, user: publicUser(u) });
  }
  if (m === 'POST' && path === '/api/auth/register') {
    if (users.some((x) => x.email === String(body['email']).toLowerCase())) return fail(409, 'An account with this email already exists');
    const u = { id: users.length + 1000, email: String(body['email']).toLowerCase(), password: body['password'], fullName: body['fullName'], phone: body['phone'] ?? null, role: 'CUSTOMER' as const, status: 'ACTIVE' as const, createdAt: new Date().toISOString(), lastLoginAt: new Date().toISOString() };
    users.push(u);
    accounts.push(acct(accounts.length + 1000, '1002' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0'), u.id, 'CHECKING', 0, 'ACTIVE', 0));
    return ok({ token: token(u), expiresInSeconds: 3600, user: publicUser(u) }, 201);
  }
  if (!me) return fail(401, 'Authentication required');
  const admin = me.role === 'ADMIN';
  if ((path.startsWith('/api/admin') || path.startsWith('/api/system')) && !admin) return fail(403, 'You do not have access to this resource');
  const own = () => accounts.filter((a) => a.customerId === me.id);

  if (path === '/api/auth/me') {
    const u = users.find((x) => x.id === me.id)!;
    if (m === 'PUT') { u.fullName = body['fullName']; u.phone = body['phone']; }
    return ok(publicUser(u));
  }
  if (m === 'POST' && path === '/api/auth/change-password') {
    const u = users.find((x) => x.id === me.id)!;
    if (u.password !== body['currentPassword']) return fail(400, 'Current password is incorrect');
    u.password = body['newPassword'];
    return ok(null, 204);
  }

  // customer accounts
  if (path === '/api/accounts' && m === 'GET') return ok(own());
  if (path === '/api/accounts' && m === 'POST') {
    if (own().filter((a) => a.status !== 'CLOSED').length >= 4) return fail(400, 'A customer can hold at most 4 open accounts');
    const a = acct(accounts.length + 1000, '1002' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0'), me.id, body['accountType'], 0, 'ACTIVE', 0);
    accounts.push(a);
    return ok(a, 201);
  }
  const acctMatch = path.match(/^\/api\/accounts\/(\d{12})$/);
  if (acctMatch) {
    const a = accounts.find((x) => x.accountNumber === acctMatch[1] && (admin || x.customerId === me.id));
    return a ? ok(a) : fail(404, 'Account not found');
  }

  // customer transactions
  if (path === '/api/transactions' && m === 'GET') {
    const mine = new Set(own().map((a) => a.accountNumber));
    const scope = q.get('account') ? new Set([q.get('account')!]) : mine;
    const rows = transactions
      .filter((t) => scope.has(t.toAccount) || (t.fromAccount !== null && scope.has(t.fromAccount)))
      .map((t) => {
        const out = t.fromAccount !== null && mine.has(t.fromAccount);
        const inn = mine.has(t.toAccount);
        return { ...t, direction: out && inn ? 'INTERNAL' : out ? 'DEBIT' : 'CREDIT' } as Transaction;
      });
    return ok(page(rows, q));
  }
  if (path === '/api/transactions/transfer' && m === 'POST') {
    const key = req.headers.get('Idempotency-Key') ?? '';
    if (idem.has(key)) return ok(idem.get(key)!, 201);
    const amount = Number(body['amount']);
    if (body['fromAccount'] === body['toAccount']) return fail(400, 'Source and destination accounts must be different');
    if (amount > 10000) return fail(400, 'Online transfers are limited to $10000.00 per transaction');
    const from = accounts.find((a) => a.accountNumber === body['fromAccount']);
    const to = accounts.find((a) => a.accountNumber === body['toAccount']);
    let reason: string | null = null;
    if (!from || !to) reason = `Account ${!from ? body['fromAccount'] : body['toAccount']} not found`;
    else if (from.customerId !== me.id) reason = 'You can only transfer from your own accounts';
    else if (from.status !== 'ACTIVE') reason = `Source account is ${from.status}`;
    else if (to.status !== 'ACTIVE') reason = `Destination account is ${to.status}`;
    else if (from.balance < amount) reason = 'Insufficient funds';
    const txn = record({ type: 'TRANSFER', fromAccount: body['fromAccount'], toAccount: body['toAccount'], amount, status: reason ? 'FAILED' : 'COMPLETED', description: body['description'] || 'Funds transfer', failureReason: reason, initiatedBy: me.id });
    if (reason) return fail(422, reason, { reference: txn.reference });
    from!.balance = Math.round((from!.balance - amount) * 100) / 100;
    to!.balance = Math.round((to!.balance + amount) * 100) / 100;
    idem.set(key, txn);
    return ok(txn, 201);
  }

  // customer payees (same rules as BeneficiaryService)
  if (path === '/api/beneficiaries' && m === 'GET') {
    return ok(beneficiaries.filter((b) => b.customerId === me.id).sort((a, b) => a.nickname.localeCompare(b.nickname)).map(publicPayee));
  }
  if (path === '/api/beneficiaries' && m === 'POST') {
    const no = String(body['accountNumber'] ?? '');
    const nickname = String(body['nickname'] ?? '').trim();
    if (!nickname) return fail(400, 'Please correct the highlighted fields', { errors: { nickname: 'Enter a name for this payee' } });
    if (!/^\d{12}$/.test(no)) return fail(400, 'Please correct the highlighted fields', { errors: { accountNumber: 'Account numbers are 12 digits' } });
    const mine = beneficiaries.filter((b) => b.customerId === me.id);
    if (mine.some((b) => b.accountNumber === no)) return fail(409, 'You already have a payee for this account');
    if (mine.length >= 50) return fail(400, 'You can save up to 50 payees. Remove one to add another.');
    if (own().some((a) => a.accountNumber === no)) return fail(400, 'This is one of your own accounts. Pick it under My accounts when you move money.');
    if (!accounts.some((a) => a.accountNumber === no)) return fail(400, 'No NovaBank account has that number');
    const b = { id: ++beneficiarySeq, customerId: me.id, nickname, accountNumber: no, createdAt: new Date().toISOString() };
    beneficiaries.push(b);
    return ok(publicPayee(b), 201);
  }
  const payeeMatch = path.match(/^\/api\/beneficiaries\/(\d+)$/);
  if (payeeMatch) {
    const b = beneficiaries.find((x) => x.id === Number(payeeMatch[1]) && x.customerId === me.id);
    if (!b) return fail(404, 'Payee not found');
    if (m === 'GET') return ok(publicPayee(b));
    if (m === 'PUT') {
      const nickname = String(body['nickname'] ?? '').trim();
      if (!nickname) return fail(400, 'Please correct the highlighted fields', { errors: { nickname: 'Enter a name for this payee' } });
      b.nickname = nickname;
      return ok(publicPayee(b));
    }
    if (m === 'DELETE') {
      beneficiaries.splice(beneficiaries.indexOf(b), 1);
      return ok(null, 204);
    }
  }

  // admin: users
  if (path === '/api/admin/users/summary') {
    const c = users.filter((u) => u.role === 'CUSTOMER');
    return ok({ totalCustomers: c.length, activeCustomers: c.filter((u) => u.status === 'ACTIVE').length, lockedCustomers: c.filter((u) => u.status === 'LOCKED').length, newCustomersLast30Days: c.filter((u) => Date.parse(u.createdAt) > now - 30 * DAY).length, admins: users.length - c.length });
  }
  if (path === '/api/admin/users') {
    const rows = users.filter((u) => (!q.get('role') || u.role === q.get('role')) && (!q.get('status') || u.status === q.get('status')) && (like(u.fullName, q.get('q')) || like(u.email, q.get('q'))));
    return ok(page(rows.map(publicUser), q));
  }
  const userStatus = path.match(/^\/api\/admin\/users\/(\d+)\/status$/);
  if (userStatus && m === 'PATCH') {
    const u = users.find((x) => x.id === Number(userStatus[1]));
    if (!u) return fail(404, 'User not found');
    if (u.role === 'ADMIN') return fail(400, 'Admin profiles cannot be locked from the console');
    u.status = body['status'] as UserStatus;
    return ok(publicUser(u));
  }

  // admin: accounts
  if (path === '/api/admin/accounts/summary') {
    const byType = (['CHECKING', 'SAVINGS'] as AccountType[]).map((t) => ({ accountType: t, count: accounts.filter((a) => a.accountType === t).length, balance: accounts.filter((a) => a.accountType === t).reduce((s, a) => s + a.balance, 0) }));
    return ok({ totalAccounts: accounts.length, activeAccounts: accounts.filter((a) => a.status === 'ACTIVE').length, frozenAccounts: accounts.filter((a) => a.status === 'FROZEN').length, totalDeposits: accounts.filter((a) => a.status !== 'CLOSED').reduce((s, a) => s + a.balance, 0), byType });
  }
  if (path === '/api/admin/accounts' && m === 'GET') {
    const rows = accounts.filter((a) => (!q.get('status') || a.status === q.get('status')) && (!q.get('type') || a.accountType === q.get('type')) && (!q.get('customerId') || a.customerId === Number(q.get('customerId'))) && (like(a.accountNumber, q.get('q')) || like(a.customerName, q.get('q'))));
    return ok(page([...rows].sort((a, b) => b.openedAt.localeCompare(a.openedAt)), q));
  }
  if (path === '/api/admin/accounts' && m === 'POST') {
    const a = acct(accounts.length + 1000, '1002' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0'), body['customerId'], body['accountType'], Number(body['initialDeposit'] ?? 0), 'ACTIVE', 0);
    accounts.push(a);
    return ok(a, 201);
  }
  const acctStatus = path.match(/^\/api\/admin\/accounts\/(\d{12})\/status$/);
  if (acctStatus && m === 'PATCH') {
    const a = accounts.find((x) => x.accountNumber === acctStatus[1]);
    if (!a) return fail(404, 'Account not found');
    if (body['status'] === 'CLOSED' && a.balance !== 0) return fail(400, 'Only accounts with a zero balance can be closed');
    a.status = body['status'] as AccountStatus;
    return ok(a);
  }

  // admin: transactions
  if (path === '/api/admin/transactions/summary') {
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const done = transactions.filter((t) => t.status === 'COMPLETED');
    const last14Days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today.getTime() - (13 - i) * DAY).toISOString().slice(0, 10);
      const rows = done.filter((t) => t.createdAt.slice(0, 10) === d);
      return { date: d, count: rows.length, amount: Math.round(rows.reduce((s, t) => s + t.amount, 0) * 100) / 100 };
    });
    const todayRows = transactions.filter((t) => Date.parse(t.createdAt) >= today.getTime());
    return ok({ transactionsToday: todayRows.length, volumeToday: todayRows.filter((t) => t.status === 'COMPLETED').reduce((s, t) => s + t.amount, 0), failedLast7Days: transactions.filter((t) => t.status === 'FAILED' && Date.parse(t.createdAt) > now - 7 * DAY).length, pending: 0, last14Days });
  }
  if (path === '/api/admin/transactions' && m === 'GET') {
    const term = q.get('q');
    const rows = transactions.filter((t) => (!q.get('status') || t.status === q.get('status')) && (!q.get('type') || t.type === q.get('type')) && (like(t.reference, term) || like(t.fromAccount, term) || like(t.toAccount, term) || like(t.description, term)));
    return ok(page(rows, q));
  }
  if (path === '/api/admin/transactions/deposit' && m === 'POST') {
    const to = accounts.find((a) => a.accountNumber === body['toAccount']);
    const amount = Number(body['amount']);
    const reason = !to ? `Account ${body['toAccount']} not found` : to.status !== 'ACTIVE' ? `Destination account is ${to.status}` : null;
    const txn = record({ type: 'DEPOSIT', fromAccount: null, toAccount: body['toAccount'], amount, status: reason ? 'FAILED' : 'COMPLETED', description: body['description'] || 'Branch deposit', failureReason: reason, initiatedBy: me.id });
    if (reason) return fail(422, reason, { reference: txn.reference });
    to!.balance = Math.round((to!.balance + amount) * 100) / 100;
    return ok(txn, 201);
  }
  if (path === '/api/admin/audit' && m === 'GET') {
    const term = q.get('q');
    const actor = (q.get('actor') ?? '').trim();
    const rows = audit.filter((e) => (!q.get('action') || e.action === q.get('action')) && (!q.get('service') || e.service === q.get('service'))
      && (!q.get('outcome') || e.outcome === q.get('outcome'))
      && (!actor || (/^\d+$/.test(actor) ? e.actorId === Number(actor) : like(e.actorEmail, actor)))
      && (!term || like(e.targetId, term) || like(e.correlationId, term))
      && (!q.get('from') || e.createdAt >= q.get('from')!) && (!q.get('to') || e.createdAt < q.get('to')!));
    return ok(page(rows, q));
  }
  if (path === '/api/system/health') {
    return ok({ overall: 'UP', checkedAt: new Date().toISOString(), services: [
      { service: 'account-service', status: 'UP', latencyMs: 14 },
      { service: 'auth-service', status: 'UP', latencyMs: 11 },
      { service: 'transaction-service', status: 'UP', latencyMs: 17 },
    ] });
  }
  return fail(404, `No mock for ${m} ${path}`);
}
