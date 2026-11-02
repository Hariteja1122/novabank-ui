import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'nb-pager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (total() > 0) {
      <div class="pager">
        <span>{{ from() }}–{{ to() }} of {{ total() }}</span>
        <div>
          <button class="btn btn-secondary btn-sm" [disabled]="page() === 0" (click)="go.emit(page() - 1)">Previous</button>
          <button class="btn btn-secondary btn-sm" [disabled]="page() + 1 >= pages()" (click)="go.emit(page() + 1)">Next</button>
        </div>
      </div>
    }
  `,
})
export class Pager {
  readonly page = input(0);
  readonly size = input(20);
  readonly total = input(0);
  readonly pages = input(1);
  readonly go = output<number>();
  protected from() { return this.page() * this.size() + 1; }
  protected to() { return Math.min(this.total(), (this.page() + 1) * this.size()); }
}
