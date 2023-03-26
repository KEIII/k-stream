import {
  ksConcat,
  ksEmpty,
  ksMap,
  ksOf,
  ksPeriodic,
  ksShareReplay,
  ksSubject,
  ksSwitch,
  ksTake,
  ksTimeout,
  noopUnsubscribe,
} from '../src';
import { stackOut } from './utils';
import { timer } from 'rxjs';
import { switchMap, take } from 'rxjs/operators';

describe('ksSwitch', () => {
  it('should test switch', async () => {
    const project = (n: number) => {
      return ksConcat(ksOf(n), ksOf(n));
    };
    const s = ksPeriodic(1).pipe(ksSwitch(project)).pipe(ksTake(10));
    expect(await stackOut(s)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it('should work like RxJS', async () => {
    const a = ksTimeout(0).pipe(ksSwitch(() => ksPeriodic(0).pipe(ksTake(10))));
    const b = timer(0).pipe(switchMap(() => timer(0, 0).pipe(take(10))));
    expect(await stackOut(a)).toEqual(await stackOut(b));
  });

  it('should unsubscribe before project emits', async () => {
    const s = ksOf(0).pipe(ksSwitch(ksEmpty));
    expect(await stackOut(s)).toEqual([]);
  });

  it('should unsubscribe after create new subscription on projected stream', async () => {
    let count = 0;
    const a = ksShareReplay(o => {
      o.next(++count);
      o.complete();
      return noopUnsubscribe;
    });
    const b = ksSubject();
    const { unsubscribe } = b
      .pipe(ksSwitch(() => a.pipe(ksMap(x => x))))
      .subscribe({});
    b.next(null);
    b.next(null);
    unsubscribe();
    expect(count).toBe(2);
  });
});
