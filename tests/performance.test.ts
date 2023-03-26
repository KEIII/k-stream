import { ksMap, ksOf } from '../src';
import { map } from 'rxjs/operators';
import { of } from 'rxjs';

describe('performance', () => {
  it('maximum call stack size exceeded', () => {
    const m = ksMap((x: number) => x + 1);
    let s = ksOf(0);
    const max = 2_048;
    for (let i = 0; i < max; i++) {
      s = s.pipe(m);
    }
    let result = 0;
    s.subscribe({ next: value => (result = value) }).unsubscribe();
    expect(result).toBe(max);
  });

  it('rxjs: maximum call stack size exceeded', () => {
    const m = map((x: number) => x + 1);
    let s = of(0);
    const max = 1_000;
    for (let i = 0; i < max / 8; i++) {
      s = s.pipe(m, m, m, m, m, m, m, m);
    }
    let result = 0;
    s.subscribe({ next: value => (result = value) }).unsubscribe();
    expect(result).toBe(max);
  });
});
