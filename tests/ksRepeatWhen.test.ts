import { from, stackOut } from './utils';
import { ksCold, ksRepeatWhen, ksTake, noopUnsubscribe } from '../src';

describe('ksRepeatWhen', () => {
  it('should repeat until stopped', async () => {
    const s = from([1, 2, 3])
      .pipe(ksRepeatWhen(n => n))
      .pipe(ksTake(5));
    expect(await stackOut(s)).toEqual([1, 2, 3, 1, 2]);
  });

  it('should repeat 4 times', async () => {
    const s = from([1, 2, 3]).pipe(ksRepeatWhen(n => n.pipe(ksTake(4))));
    expect(await stackOut(s)).toEqual([
      1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3,
    ]);
  });

  it('should repeat once', async () => {
    const s = from([1, 2, 3]).pipe(
      ksRepeatWhen(() =>
        ksCold(({ next, complete }) => {
          Promise.resolve().then(() => {
            next();
            complete();
          });
          return noopUnsubscribe;
        }),
      ),
    );
    expect(await stackOut(s)).toEqual([1, 2, 3, 1, 2, 3]);
  });
});
