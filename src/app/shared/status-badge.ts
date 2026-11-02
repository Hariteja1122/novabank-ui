import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const TONE: Record<string, string> = {
  ACTIVE: 'badge-ok', COMPLETED: 'badge-ok', UP: 'badge-ok',
  LOCKED: 'badge-bad', FAILED: 'badge-bad', DOWN: 'badge-bad', CLOSED: 'badge-neutral',
  FROZEN: 'badge-warn', PENDING: 'badge-warn', DEGRADED: 'badge-warn',
};

@Component({
  selector: 'nb-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [class]="'badge ' + tone()">{{ label() }}</span>`,
})
export class StatusBadge {
  readonly value = input.required<string>();
  protected readonly tone = computed(() => TONE[this.value()] ?? 'badge-neutral');
  protected readonly label = computed(() => this.value().charAt(0) + this.value().slice(1).toLowerCase());
}
