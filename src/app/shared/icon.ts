import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const PATHS: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  accounts: 'M3 9h18M5 9v9m4.7-9v9m4.6-9v9M19 9v9M2 20h20M12 3l9 4H3z',
  transfer: 'M4 8h13m0 0-4-4m4 4-4 4M20 16H7m0 0 4-4m-4 4 4 4',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 10a7 7 0 0 1 14 0m1-10a3.5 3.5 0 0 0 0-7m5 17a6 6 0 0 0-4-5.7',
  deposit: 'M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5M4 17v3h16v-3',
  pulse: 'M3 12h4l3-8 4 16 3-8h4',
  chart: 'M4 20V10m6 10V4m6 16v-7m4 7H2',
  logout: 'M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l-4-4 4-4m-4 4h11',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm9 3-4.3-4.3',
  check: 'M5 12.5 10 17 19 7',
  shield: 'M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z',
  arrowUp: 'M12 19V5m0 0-6 6m6-6 6 6',
  arrowDown: 'M12 5v14m0 0-6-6m6 6 6-6',
  swap: 'M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4m4 4H7',
};

@Component({
  selector: 'nb-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="d()" /></svg>`,
  styles: `:host { display: inline-flex; flex: none; }`,
})
export class Icon {
  readonly name = input.required<string>();
  readonly size = input(18);
  protected readonly d = computed(() => PATHS[this.name()] ?? '');
}
