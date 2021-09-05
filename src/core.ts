import { some, none, isSome, Option } from './option';

export type Unsubscribable = {
  readonly unsubscribe: () => void;
};

export type Next<A> = (value: A) => void;

export type Complete = () => void;

export type Observer<A> = {
  readonly next?: Next<A>;
  readonly complete?: Complete;
};

export type Subscriber<A> = (observer: Observer<A>) => Unsubscribable;

export type SubscriberRequired<A> = (
  observer: Required<Observer<A>>,
) => Unsubscribable;

export type Transformer<A, B> = (stream: Stream<A>) => Stream<B>;

export type Pipe<A> = <B>(transformer: Transformer<A, B>) => Stream<B>;

export type Observable<A> = {
  readonly subscribe: Subscriber<A>;
};

export type Stream<A> = Observable<A> & {
  readonly pipe: Pipe<A>;
  readonly behaviour: KsBehaviour;
  readonly _unsafeLastValue: () => A | undefined;
};

export type KsBehaviour = <A>(subscriber: SubscriberRequired<A>) => Stream<A>;

export const noop = () => void 0;

export const noopUnsubscribe: Unsubscribable = { unsubscribe: noop };

export type Scheduler = {
  schedule: (handler: () => void, ms: number) => Unsubscribable;
};

export const asyncScheduler: Scheduler = {
  schedule: (handler, ms) => {
    const t = setTimeout(handler, ms);
    return { unsubscribe: () => clearTimeout(t) };
  },
};

/**
 * Creates new observable object with `unsubscribe()` method
 * what could be called before `subscribe()`.
 */
export const _lazy = <A>(observable: {
  subscribe: (observer: A) => Unsubscribable;
}) => {
  let isUnsubscribed = false;
  let subscription: Unsubscribable | undefined;
  return {
    subscribe: (observer: A): Unsubscribable => {
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

/**
 * Create source on each subscription.
 */
export const ksCold: KsBehaviour = <A>(
  subscriber: SubscriberRequired<A>,
): Stream<A> => {
  const subscribe: Subscriber<A> = observer => {
    let isCompleted = false;
    const { unsubscribe } = subscriber({
      next: value => {
        if (isCompleted) {
          return console.warn(
            'Logic error: Ignore call `next` on completed stream.',
          );
        }
        observer.next?.(value);
      },
      complete: () => {
        if (isCompleted) {
          return console.warn(
            'Logic error: Ignore call `complete` on completed stream.',
          );
        }
        isCompleted = true;
        observer.complete?.();
      },
    });
    return {
      unsubscribe: () => {
        observer = {}; // stop emitting values after unsubscribe
        unsubscribe();
      },
    };
  };

  const self: Stream<A> = {
    subscribe,
    pipe: transformer => transformer(self),
    behaviour: ksCold,
    _unsafeLastValue: noop,
  };

  return self;
};

const createShareStream = <A>(
  subscriber: SubscriberRequired<A>,
  replay: boolean,
): Stream<A> => {
  let isCompleted = false;
  let lastValue: Option<A> = none;
  let subscription: Unsubscribable | null = null;
  const observersMap = new Map<symbol, Observer<A>>();

  const onNext: Next<A> = value => {
    if (isCompleted) {
      return console.warn(
        'Logic error: Ignore call `next` on completed stream.',
      );
    }
    // We need to save last value before notify observers
    // it leads to duplicates with circular dependencies but more consistent
    if (replay) {
      lastValue = some(value);
    }
    observersMap.forEach(observer => observer.next?.(value));
  };

  const onComplete: Complete = () => {
    if (isCompleted) {
      return console.warn(
        'Logic error: Ignore call `complete` on completed stream.',
      );
    }
    isCompleted = true;
    observersMap.forEach(observer => observer.complete?.());
  };

  const subscribe: Subscriber<A> = observer => {
    if (replay && isSome(lastValue)) {
      observer.next?.(lastValue.value);
      if (isCompleted) observer.complete?.();
    }

    if (isCompleted) {
      return noopUnsubscribe;
    }

    const subscribeId = Symbol();

    const unsubscribe = () => {
      observersMap.delete(subscribeId);
      if (observersMap.size === 0) {
        isCompleted = false;
        lastValue = none;
        subscription?.unsubscribe();
        subscription = null;
      }
    };

    observersMap.set(subscribeId, observer);

    // We need to create subscription after added observer into observersMap
    if (subscription === null) {
      // First we need to make `subscription` not equals `null`
      // to prevent `Maximum call stack size exceeded` with circular dependencies
      subscription = noopUnsubscribe;
      subscription = subscriber({
        next: onNext,
        complete: onComplete,
      });
    }

    return { unsubscribe };
  };

  const self: Stream<A> = {
    subscribe,
    pipe: transformer => transformer(self),
    behaviour: replay ? ksShareReplay : ksShare,
    _unsafeLastValue: () => {
      return isSome(lastValue) ? lastValue.value : undefined;
    },
  };

  return self;
};

/**
 * Share source among multiple subscribers.
 */
export const ksShare: KsBehaviour = f => createShareStream(f, false);

/**
 * Share source and replay last emissions on subscription.
 */
export const ksShareReplay: KsBehaviour = f => createShareStream(f, true);
