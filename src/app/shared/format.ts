import { Pipe, PipeTransform } from '@angular/core';

/** 100245180031 -> 1002 4518 0031, easier to read aloud and compare. */
@Pipe({ name: 'acct' })
export class AccountNumberPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return value ? value.replace(/(\d{4})(?=\d)/g, '$1 ') : '';
  }
}

/** Masked form for lists: •••• 0031 */
@Pipe({ name: 'acctMask' })
export class AccountMaskPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return value ? `•••• ${value.slice(-4)}` : '';
  }
}

export function newIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function titleCase(v: string): string {
  return v.charAt(0) + v.slice(1).toLowerCase();
}
