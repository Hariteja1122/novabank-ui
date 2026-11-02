import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { DailyVolume } from '../../core/models';

/** 14 day completed volume. Plain SVG bars with a hover readout, no chart library. */
@Component({
  selector: 'nb-volume-chart',
  imports: [CurrencyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="readout">
      @if (active(); as d) {
        <b class="serif">{{ d.amount | currency: 'USD' : 'symbol' : '1.0-0' }}</b>
        <span class="muted">{{ d.count }} transactions on {{ d.date | date: 'EEE, MMM d' }}</span>
      } @else {
        <b class="serif">{{ total() | currency: 'USD' : 'symbol' : '1.0-0' }}</b>
        <span class="muted">completed in the last 14 days</span>
      }
    </div>
    <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" preserveAspectRatio="none" role="img" aria-label="Daily completed transaction volume">
      @for (g of grid(); track g) {
        <line [attr.x1]="0" [attr.x2]="W" [attr.y1]="g" [attr.y2]="g" class="gridline" />
      }
      @for (b of bars(); track b.date) {
        <rect [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" rx="3"
          [class.on]="hover() === b.date" (mouseenter)="hover.set(b.date)" (mouseleave)="hover.set(null)" />
        <rect class="hit" [attr.x]="b.x - 3" y="0" [attr.width]="b.w + 6" [attr.height]="H"
          (mouseenter)="hover.set(b.date)" (mouseleave)="hover.set(null)" />
      }
    </svg>
    <div class="axis">
      @for (b of bars(); track b.date; let i = $index) {
        <span>{{ i % 2 === 0 ? (b.date | date: 'd MMM') : '' }}</span>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .readout { display: flex; align-items: baseline; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
    .readout b { font-size: 1.6rem; font-weight: 400; font-variant-numeric: tabular-nums; }
    svg { width: 100%; height: 180px; display: block; }
    rect { fill: var(--ledger); opacity: 0.82; transition: opacity 0.12s; }
    rect.on { fill: var(--brass); opacity: 1; }
    rect.hit { fill: transparent; }
    .gridline { stroke: var(--line); stroke-width: 1; vector-effect: non-scaling-stroke; }
    .axis { display: grid; grid-template-columns: repeat(14, 1fr); font-size: 0.72rem; color: var(--faint); margin-top: 6px; }
  `,
})
export class VolumeChart {
  readonly days = input.required<DailyVolume[]>();
  protected readonly W = 700;
  protected readonly H = 180;
  protected readonly hover = signal<string | null>(null);

  /** Always 14 slots ending today, so missing days show as gaps rather than shifting bars. */
  private readonly filled = computed(() => {
    const byDate = new Map(this.days().map((d) => [d.date, d]));
    const today = new Date();
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (13 - i)));
      const key = d.toISOString().slice(0, 10);
      return byDate.get(key) ?? { date: key, count: 0, amount: 0 };
    });
  });
  private readonly max = computed(() => Math.max(1, ...this.filled().map((d) => d.amount)));
  protected readonly total = computed(() => this.filled().reduce((s, d) => s + d.amount, 0));
  protected readonly active = computed(() => this.filled().find((d) => d.date === this.hover()) ?? null);
  protected readonly grid = computed(() => [this.H * 0.25, this.H * 0.5, this.H * 0.75]);
  protected readonly bars = computed(() => {
    const slot = this.W / 14;
    const w = slot * 0.62;
    return this.filled().map((d, i) => {
      const h = Math.max(d.amount > 0 ? 3 : 0, (d.amount / this.max()) * (this.H - 8));
      return { date: d.date, x: i * slot + (slot - w) / 2, w, h, y: this.H - h };
    });
  });
}
