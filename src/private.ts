import { noopUnsubscribe, Observable, Unsubscribable } from './core';
import { isSome, none, some, Option } from './option';

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
  stop: () => void; // Unsubscribe current sub but it's possible to restart
};

/**
 * Returns object with:
 * - `ifNull()` allows to create subscription once
 * - `unsubscribe()` allows to unsubscribe anytime
 */
export const _subscribableOnce = <A>(): SubscribableOnce<A> => {
  let isUnsubscribed = false;
  let currentSub: UnsubscribableObservable<A> | null = null;

  const stop = () => {
    currentSub?.unsubscribe();
    currentSub = null;
  };

  const skip: UnsubscribableObservable<A> = {
    subscribe: () => noopUnsubscribe,
    unsubscribe: stop,
  };

  const restartWith: SubscribableOnce<A>['restartWith'] = observable => {
    stop();
    const sub = _unsubscribableObservable(observable);
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
      unsubscribe: stop,
    };
  };

  return {
    isNull: () => currentSub === null,
    ifNull: f => {
      return isUnsubscribed || currentSub !== null ? skip : restartWith(f());
    },
    restartWith: observable => {
      return isUnsubscribed ? skip : restartWith(observable);
    },
    stop,
    unsubscribe: () => {
      isUnsubscribed = true;
      stop();
    },
  };
};

/**
 * Create a new function which can call only once.
 */
export const _once = <A extends any[], B>(
  f: (...a: A) => B,
): ((...a: A) => B) => {
  let cache: Option<B> = none;
  return (...a: A) => {
    if (isSome(cache)) return cache.value;
    const value = f(...a);
    cache = some(value);
    return value;
  };
};
