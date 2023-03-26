import { noopUnsubscribe, Observable, Unsubscribable } from './core';

type UnsubscribableObservable<A> = Observable<A> & Unsubscribable;

/**
 * Creates new observable object with `unsubscribe()` method
 * what can be called before `subscribe()`.
 *
 * That required when `sub.unsubscribe()` may be called
 * in the `subscribe()` method.
 *
 * @private
 */
export const _unsubscribableObservable = <A>(
  observable: Observable<A>,
): UnsubscribableObservable<A> => {
  let isUnsubscribed = false;
  let subscription: Unsubscribable | undefined;
  return {
    subscribe: observer => {
      if (isUnsubscribed) return noopUnsubscribe;
      subscription?.unsubscribe();
      subscription = observable.subscribe(observer);
      // check again if `unsubscribed` was changed inside `observer()`
      if (isUnsubscribed) {
        subscription.unsubscribe();
      }
      return subscription;
    },
    unsubscribe: () => {
      isUnsubscribed = true;
      subscription?.unsubscribe();
    },
  };
};

export type SubscribableOnce<A> = Unsubscribable & {
  isNull: () => boolean;
  ifNull: (f: () => Observable<A>) => Observable<A>;
  restartWith: (observable: Observable<A>) => Observable<A>;
};

/**
 * Returns object with:
 * - `ifNull()` allows to create subscription once
 * - `unsubscribe()` allows to unsubscribe anytime
 */
export const _subscribableOnce = <A>(): SubscribableOnce<A> => {
  let currentSub: UnsubscribableObservable<A> | null = null;

  const unsubscribe = () => {
    currentSub?.unsubscribe();
    currentSub = null;
  };

  const skip: UnsubscribableObservable<A> = {
    subscribe: () => noopUnsubscribe,
    unsubscribe,
  };

  const restartWith: SubscribableOnce<A>['restartWith'] = observable => {
    const sub = _unsubscribableObservable(observable);
    unsubscribe();
    currentSub = sub;
    return {
      subscribe: ({ next, complete }) => {
        return sub.subscribe({
          next: value => {
            if (currentSub === sub) {
              // Ignore call `next()` on outdated observable
              next?.(value);
            }
          },
          complete: () => {
            if (currentSub === sub) {
              // Ignore call `complete()` on outdated observable
              complete?.();
            }
          },
        });
      },
      unsubscribe,
    };
  };

  return {
    isNull: () => currentSub === null,
    ifNull: f => (currentSub === null ? restartWith(f()) : skip),
    unsubscribe,
    restartWith,
  };
};
