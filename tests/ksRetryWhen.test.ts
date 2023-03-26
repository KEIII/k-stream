import {
  Either,
  ksCold,
  ksMap,
  ksMapTo,
  ksOf,
  ksRetryWhen,
  left,
  none,
  noopUnsubscribe,
  right,
  some,
} from '../src';
import { from, stackOut } from './utils';

describe('ksRetryWhen', () => {
  it('should emit an error from async notifier after main complete', async () => {
    const s = ksOf(left('e1')).pipe(
      ksRetryWhen(() =>
        ksCold(({ next }) => {
          Promise.resolve().then(() => next(some('e2')));
          return noopUnsubscribe;
        }),
      ),
    );
    expect(await stackOut(s)).toEqual([left('e2')]);
  });

  it('should retry when notified via returned notifier', async () => {
    let retried = 0;
    const s = from([right(1), right(2), left('3')]).pipe(
      ksRetryWhen(errors =>
        errors.pipe(
          ksMap(error => {
            retried++;
            if (retried < 2) {
              return none; // retry
            } else {
              return some(error); // emit error
            }
          }),
        ),
      ),
    );
    expect(await stackOut(s)).toEqual([
      right(1),
      right(2),
      right(1),
      right(2),
      left('3'),
    ]);
  });

  it('should skip errors sync', async () => {
    const attempts = [
      [left(0)],
      [right(1), left(2), right(3)],
      [right(4), left(5)],
      [left(6)],
      [right(7)],
    ];

    const s = ksCold<Either<number, number>>(o => {
      attempts.shift()?.forEach(o.next);
      o.complete();
      return noopUnsubscribe;
    }).pipe(ksRetryWhen(errors => errors.pipe(ksMapTo(none))));

    expect(await stackOut(s)).toEqual([right(1), right(4), right(7)]);
  });

  it('should skip errors async', async () => {
    const attempts = [
      [left(0)],
      [left(1), right(2), left(3), right(4)],
      [right(5)],
    ];

    const s = ksCold<Either<number, number>>(o => {
      const a = (attempts.shift() ?? []).map(x => {
        return new Promise<CallableFunction>(resolve => {
          setTimeout(() => resolve(() => o.next(x)), 100);
        });
      });
      a.push(
        new Promise<CallableFunction>(resolve => {
          setTimeout(() => resolve(() => o.complete()), 100);
        }),
      );
      (async () => {
        for await (const f of a) f();
      })();
      return noopUnsubscribe;
    }).pipe(ksRetryWhen(errors => errors.pipe(ksMapTo(none))));

    expect(await stackOut(s)).toEqual([right(5)]);
  });
});
