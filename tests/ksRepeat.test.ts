import { ksCold, ksOf, ksRepeat, ksTap } from '../src';
import { stackOut } from './utils';

describe('ksRepeat', () => {
  it('should consider negative count as no repeat, and return EMPTY', async () => {
    const s = ksOf(42).pipe(ksRepeat(-1));
    expect(await stackOut(s)).toEqual([]);
  });

  it('should complete without emit when count is zero', async () => {
    const s = ksOf(42).pipe(ksRepeat(0));
    expect(await stackOut(s)).toEqual([]);
  });

  it('should emit source once when count is one', async () => {
    const s = ksOf(42).pipe(ksRepeat(1));
    expect(await stackOut(s)).toEqual([42]);
  });

  it('should repeats an observable on completion', async () => {
    const s = ksOf(42).pipe(ksRepeat(3));
    expect(await stackOut(s)).toEqual([42, 42, 42]);
  });

  it('should always teardown before starting the next cycle', async () => {
    const results: unknown[] = [];
    const source = ksCold<number>(observer => {
      Promise.resolve().then(() => {
        observer.next(1);
        Promise.resolve().then(() => {
          observer.next(2);
          Promise.resolve().then(() => {
            observer.complete();
          });
        });
      });
      return {
        unsubscribe: () => {
          results.push('teardown');
        },
      };
    });

    await new Promise<void>(resolve => {
      const sub = source.pipe(ksRepeat(3)).subscribe({
        next: value => results.push(value),
        complete: () => {
          sub.unsubscribe();
          resolve();
        },
      });
    });

    expect(results).toEqual([
      1,
      2,
      'teardown',
      1,
      2,
      'teardown',
      1,
      2,
      'teardown',
    ]);
  });

  it('should always teardown before starting the next cycle, even when synchronous', async () => {
    const results: unknown[] = [];
    const source = ksCold<number>(observer => {
      observer.next(1);
      observer.next(2);
      observer.complete();
      return {
        unsubscribe: () => {
          results.push('teardown');
        },
      };
    });

    await stackOut(
      source.pipe(ksRepeat(3)).pipe(
        ksTap({
          next: value => results.push(value),
          complete: () => results.push('complete'),
        }),
      ),
    );

    expect(results).toEqual([
      1,
      2,
      'teardown',
      1,
      2,
      'teardown',
      1,
      2,
      'complete',
      'teardown',
    ]);
  });
});
