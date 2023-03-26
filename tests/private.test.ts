import { ksCold, ksOf, noopUnsubscribe } from '../src';
import {
  _subscribableOnce,
  _once,
  _unsubscribableObservable,
} from '../src/private';

describe('private', () => {
  it('should always teardown before starting the next cycle', () => {
    const result: unknown[] = [];
    const s = _unsubscribableObservable(
      ksCold(() => {
        return { unsubscribe: () => result.push('teardown') };
      }),
    );
    s.subscribe({ next: value => result.push(value) });
    s.subscribe({ next: value => result.push(value) });
    s.subscribe({ next: value => result.push(value) }).unsubscribe();
    expect(result).toEqual(['teardown', 'teardown', 'teardown']);
  });

  it('should test _subscribableOnce', () => {
    const n = [1, 2, 3];
    const s = ksCold<number>(({ next, complete }) => {
      next(n.pop()!);
      complete();
      return noopUnsubscribe;
    });
    const once = _subscribableOnce<number>();
    const r: number[] = [];
    once.restartWith(s).subscribe({
      next: v => r.push(v),
    });
    once.restartWith(s).subscribe({
      next: value => r.push(value),
      complete: () => r.push(0),
    });
    once.restartWith(s).subscribe({
      complete: () => r.push(-1),
    });
    expect(r).toEqual([3, 2, 0, -1]);
  });

  it('should ignore after restart', () => {
    const once = _subscribableOnce<string>();
    const r: string[] = [];
    const a = once.restartWith(ksOf('a'));
    const b = once.restartWith(ksOf('b'));
    a.subscribe({
      next: v => r.push(v),
      complete: () => r.push('a complete'),
    });
    b.subscribe({
      next: v => r.push(v),
      complete: () => r.push('b complete'),
    });
    expect(r).toEqual(['b', 'b complete']);
  });

  it('should ignore after unsubscribe', () => {
    const once = _subscribableOnce<string>();
    once.unsubscribe();
    const r: string[] = [];
    once.restartWith(ksOf('a')).subscribe({
      next: v => r.push(v),
      complete: () => r.push('a complete'),
    });
    expect(r).toEqual([]);
  });

  it('should call only once', () => {
    const a = jest.fn();
    const b = _once(a);
    b();
    b();
    expect(a).toBeCalledTimes(1);
  });
});
