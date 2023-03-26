import { ksCold, noopUnsubscribe, Observable } from '../src';
import { _unsubscribableObservable } from '../src/private';

export const stackOut = <A>(observable: Observable<A>): Promise<A[]> => {
  return new Promise<A[]>(resolve => {
    const output: A[] = [];
    const _observable = _unsubscribableObservable(observable);
    _observable.subscribe({
      next: v => output.push(v),
      complete: () => {
        _observable.unsubscribe();
        resolve(output);
      },
    });
  });
};

export const from = <T>(a: T[]) => {
  return ksCold<T>(({ next, complete }) => {
    a.forEach(next);
    complete();
    return noopUnsubscribe;
  });
};
