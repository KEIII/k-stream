import { isSome, none, Option, some } from './option';

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

/**
 * A Pipeable Operator is a function that takes an Stream as its input
 * and returns another Stream.
 * It must be a pure operation: the previous Stream stays unmodified.
 */
export type PipeableOperator<A, B> = (stream: Stream<A>) => Stream<B>;

export type Pipe<A> = <B>(operator: PipeableOperator<A, B>) => Stream<B>;

export type Observable<A> = {
  readonly subscribe: Subscriber<A>;
};

export type Stream<A> = Observable<A> & {
  readonly pipe: Pipe<A>;
  readonly constructor: KsConstructor;
  readonly snapshot: () => A | undefined;
};

export type KsConstructor = <A>(subscriber: SubscriberRequired<A>) => Stream<A>;

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
 * Create source on each subscription.
 */
export const ksCold: KsConstructor = <A>(
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
    pipe: operator => operator(self),
    constructor: ksCold,
    snapshot: noop,
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
    pipe: operator => operator(self),
    constructor: replay ? ksShareReplay : ksShare,
    snapshot: () => {
      return isSome(lastValue) ? lastValue.value : undefined;
    },
  };

  return self;
};

/**
 * Share source among multiple subscribers.
 */
export const ksShare: KsConstructor = f => createShareStream(f, false);

/**
 * Share source and replay last emissions on subscription.
 */
export const ksShareReplay: KsConstructor = f => createShareStream(f, true);
