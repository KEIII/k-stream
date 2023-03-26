import {
  ksAudit,
  ksCold,
  ksConcat,
  ksEmpty,
  ksInterval,
  ksOf,
  ksTakeUntil,
  ksTakeWhile,
  ksTimeout,
  noopUnsubscribe,
} from '../src';
import { from, stackOut } from './utils';

describe('ksAudit', () => {
  it('should ignore for time based on provided observable, then emit most recent value.', async () => {
    const s = ksInterval(50)
      .pipe(ksTakeWhile(x => x < 40))
      .pipe(ksAudit(n => ksInterval(n * 10)));
    expect(await stackOut(s)).toEqual([
      0, 1, 2, 3, 4, 5, 7, 9, 11, 14, 17, 21, 26, 32, 39,
    ]);
  });

  it('should audit twice after main completes', async () => {
    const s = ksOf(42).pipe(
      ksAudit(() =>
        ksCold(({ next, complete }) => {
          Promise.resolve().then(next).then(next).then(complete);
          return noopUnsubscribe;
        }),
      ),
    );
    expect(await stackOut(s)).toEqual([]);
  });

  it('should emit empty when main completes before audit', async () => {
    const s = ksOf(42).pipe(ksAudit(() => ksTimeout(1_000)));
    expect(await stackOut(s)).toEqual([]);
  });

  it('should emit once', async () => {
    const s = ksOf(42).pipe(ksAudit(() => ksOf(1)));
    expect(await stackOut(s)).toEqual([42]);
  });

  it('should emit twice', async () => {
    const s = from([1, 2]).pipe(ksAudit(() => from([1])));
    expect(await stackOut(s)).toEqual([1, 2]);
  });

  it('should emit no values if durations are EMPTY', async () => {
    const s = ksConcat(ksOf(1), ksOf(2))
      .pipe(ksAudit(ksEmpty))
      .pipe(ksTakeUntil(ksTimeout(1000)));
    expect(await stackOut(s)).toEqual([]);
  });
});
