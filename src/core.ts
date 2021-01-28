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
  readonly lastValue?: A;
};

export type KsBehaviour = <A>(subscriber: SubscriberRequired<A>) => Stream<A>;

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

export const _lazy = <A>(observable: {
  subscribe: (observer: A) => Unsubscribable;
}) => {
  let resolve: (subscription: Unsubscribable) => void;
  const promise = new Promise<Unsubscribable>(r => {
    resolve = r;
  });
  return {
    subscribe: (observer: A): Unsubscribable => {
      const subscription = observable.subscribe(observer);
      resolve(subscription);
      return subscription;
    },
    unsubscribe: () => {
      promise.then(subscription => subscription.unsubscribe());
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
    return subscriber({
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
  };

  const stream: Stream<A> = {
    subscribe,
    pipe: transformer => transformer(stream),
    behaviour: ksCold,
  };

  return stream;
};

const createShareStream = <A>(
  subscriber: SubscriberRequired<A>,
  replay: boolean,
): Stream<A> => {
  let isCompleted = false;
  let lastValue: Option<A> = none;
  let subscription: Unsubscribable | null = null;
  const observersMap = new Map<Symbol, Observer<A>>();

  const onNext: Next<A> = value => {
    if (isCompleted) {
      return console.warn(
        'Logic error: Ignore call `next` on completed stream.',
      );
    }
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
          lastValue = none;
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
      subscription = subscriber({
        next: onNext,
        complete: onComplete,
      });
    }

    return { unsubscribe };
  };

  const stream: Stream<A> = {
    subscribe,
    pipe: transformer => transformer(stream),
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

export const ksCreateStream = <A>(
  behaviour: KsBehaviour,
  subscriber: SubscriberRequired<A>,
): Stream<A> => {
  return behaviour(subscriber);
};

/**
 * Combine transformers.
 */
export const ksPipe = <A, B, C>(
  fab: Transformer<A, B>,
  fbc: Transformer<B, C>,
): Transformer<A, C> => {
  return stream => stream.pipe(fab).pipe(fbc);
};
