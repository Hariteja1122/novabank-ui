import { AccountMaskPipe, AccountNumberPipe, newIdempotencyKey } from './format';

describe('account number formatting', () => {
  it('groups 12 digits in fours', () => {
    expect(new AccountNumberPipe().transform('100245180031')).toBe('1002 4518 0031');
  });

  it('masks all but the last four digits', () => {
    expect(new AccountMaskPipe().transform('100245180031')).toBe('•••• 0031');
  });

  it('creates a fresh idempotency key each time', () => {
    expect(newIdempotencyKey()).not.toBe(newIdempotencyKey());
  });
});
