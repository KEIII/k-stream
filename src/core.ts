import { some, none, isSome } from './option';

export type Unsubscribable = { readonly unsubscribe: () => void };

export type NextFn<T> = (value: T) => void;

export type CompleteFn = () => void;

export type Observer<T> = {
  readonly next: NextFn<T>;
  readonly complete: CompleteFn;
};

export type SubscriberFn<T> = (observer: Observer<T>) => Unsubscribable;

export type SubscribePartialFn<T> = (
  partialObserver: Partial<Observer<T>>,
) => Unsubscribable;

export type TransformFn<T, O> = (stream: Stream<T>) => Stream<O>;

export type PipeFn<T> = <O>(transformFn: TransformFn<T, O>) => Stream<O>;

export type Observable<T> = { readonly subscribe: SubscribePartialFn<T> };

export type Stream<T> = Observable<T> & {
  readonly pipe: PipeFn<T>;
  readonly behaviour: KsBehaviour;
  readonly lastValue?: T;
};

export type KsBehaviour = <T>(subscribeFn: SubscriberFn<T>) => Stream<T>;

export const noop: () => void = () => void 0;

export type Scheduler = {
  schedule: (handler: () => void, ms: number) => Unsubscribable;
};

export const asyncScheduler: Scheduler = {
  schedule: (handler, ms) => {
    const t = setTimeout(handler, ms);
    return { unsubscribe: () => clearTimeout(t) };
  },
};

export const lazySubscription = () => {
  let resolve: (s: Unsubscribable) => void;
  const promise = new Promise<Unsubscribable>(r => {
    resolve = r;
  });
  return {
    resolve: (s: Unsubscribable) => {
      resolve(s);
      return s;
    },
    unsubscribe: () => {
      promise.then(s => s.unsubscribe());
    },
  };
};

/**
 * Create source on each subscription.
 */
export const ksCold: KsBehaviour = <T>(
  subscriberFn: SubscriberFn<T>,
): Stream<T> => {
  const subscribe: SubscribePartialFn<T> = observer => {
    let isCompleted = false;
    return subscriberFn({
      next: value => {
        if (isCompleted) {
          console.warn('Logic error: Ignore call `next` on completed stream.');
        } else {
          observer.next?.(value);
        }
      },
      complete: () => {
        if (isCompleted) {
          console.warn(
            'Logic error: Ignore call `complete` on completed stream.',
          );
        } else {
          isCompleted = true;
          observer.complete?.();
        }
      },
    });
  };

  const stream: Stream<T> = {
    subscribe,
    pipe: transformFn => transformFn(stream),
    behaviour: ksCold,
  };

  return stream;
};

const createShareStream = <T>(
  subscribeFn: SubscriberFn<T>,
  replay: boolean,
): Stream<T> => {
  let isCompleted = false;
  let lastValue = none<T>();
  let subscription: Unsubscribable | null = null;
  const observersMap = new Map<Symbol, Partial<Observer<T>>>();

  const onNext: NextFn<T> = value => {
    if (isCompleted) {
      console.warn('Logic error: Ignore call `next` on completed stream.');
    } else {
      if (replay) {
        lastValue = some(value);
      }
      observersMap.forEach(observer => observer.next?.(value));
    }
  };

  const onComplete: CompleteFn = () => {
    if (isCompleted) {
      console.warn('Logic error: Ignore call `complete` on completed stream.');
    } else {
      isCompleted = true;
      observersMap.forEach(observer => observer.complete?.());
    }
  };

  const subscribe: SubscribePartialFn<T> = observer => {
    if (isCompleted) {
      return { unsubscribe: noop };
    }

    if (replay && isSome(lastValue)) {
      observer.next?.(lastValue.value);
    }

    const subscribeId = Symbol();

    const unsubscribe = () => {
      observersMap.delete(subscribeId);
      if (observersMap.size === 0) {
        if (replay) {
          lastValue = none();
        }
        if (subscription !== null) {
          subscription.unsubscribe();
          subscription = null;
        }
      }
    };

    observersMap.set(subscribeId, observer);

    // NOTE: we need to create subscription after added observer
    if (subscription === null) {
      subscription = subscribeFn({
        next: onNext,
        complete: onComplete,
      });
    }

    return { unsubscribe };
  };

  const stream: Stream<T> = {
    subscribe,
    pipe: transformFn => transformFn(stream),
    behaviour: replay ? ksShareReplay : ksShare,
    get lastValue() {
      return isSome(lastValue) ? lastValue.value : undefined;
    },
  };

  return stream;
};

/**
 * Share source among multiple subscribers.
 */
export const ksShare: KsBehaviour = f => createShareStream(f, false);

/**
 * Share source and replay last emissions on subscription.
 */
export const ksShareReplay: KsBehaviour = f => createShareStream(f, true);

export const ksCreateStream = <T>(
  b: KsBehaviour,
  f: SubscriberFn<T>,
): Stream<T> => b(f);

/**
 * Combine transformers.
 */
export const ksPipe = <A, B, C>(
  t1: TransformFn<A, B>,
  t2: TransformFn<B, C>,
): TransformFn<A, C> => {
  return s => s.pipe(t1).pipe(t2);
};
