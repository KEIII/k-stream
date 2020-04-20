import { Some, None } from "./ts-option";

export type Unsubscribable = { readonly unsubscribe: () => void };

export type NextFn<T> = (value: T) => void;

export type CompleteFn = () => void;

export type Observer<T> = {
  readonly next: NextFn<T>;
  readonly complete: CompleteFn;
};

export type SubscribeFn<T> = (observer: Observer<T>) => Unsubscribable;

export type SubscribePartialFn<T> = (
  partialObserver: Partial<Observer<T>>
) => Unsubscribable;

export type TransformFn<T, O> = (stream: Stream<T>) => Stream<O>;

export type PipeFn<T> = <O>(transformFn: TransformFn<T, O>) => Stream<O>;

export type Observable<T> = { readonly subscribe: SubscribePartialFn<T> };

export type Stream<T> = Observable<T> & {
  readonly pipe: PipeFn<T>;
  readonly behaviour: KsBehaviour;
};

export enum KsBehaviour {
  COLD,
  SHARE,
  SHARE_REPLAY,
}

export const noop = () => {};

export const observerFromPartial = <T>(
  o: Partial<Observer<T>>
): Observer<T> => {
  return {
    next: o.next !== undefined ? o.next : noop,
    complete: o.complete !== undefined ? o.complete : noop,
  };
};

const createShareStream = <T>(
  subscribeFn: SubscribeFn<T>,
  replay: boolean
): Stream<T> => {
  let isCompleted = false;
  let lastValue = None<T>();
  let subscription: Unsubscribable | null = null;
  const observersMap = new Map<Readonly<{}>, Observer<T>>();

  const shareNext: NextFn<T> = (value: T): void => {
    if (isCompleted) {
      console.warn("Logic error: Ignore call next on completed stream.");
    } else {
      if (replay) {
        lastValue = Some(value);
      }
      for (const { next } of observersMap.values()) {
        next(value);
      }
    }
  };

  const shareComplete: CompleteFn = (): void => {
    if (isCompleted) {
      console.warn("Logic error: Ignore call complete on completed stream.");
    } else {
      isCompleted = true;
      for (const { complete } of observersMap.values()) {
        complete();
      }
    }
  };

  const subscribe: SubscribePartialFn<T> = (
    partialObserver: Partial<Observer<T>>
  ): Unsubscribable => {
    if (isCompleted) {
      return { unsubscribe: noop };
    }

    const observer = observerFromPartial<T>(partialObserver);

    if (replay && lastValue._tag === "Some") {
      observer.next(lastValue.some);
    }

    const subscribeId = Object.freeze({});

    const unsubscribe = () => {
      observersMap.delete(subscribeId);
      if (observersMap.size === 0) {
        if (replay) {
          lastValue = None();
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
        next: shareNext,
        complete: shareComplete,
      });
    }

    return { unsubscribe };
  };

  const stream: Stream<T> = {
    subscribe,
    pipe: (transformFn) => transformFn(stream),
    behaviour: replay ? KsBehaviour.SHARE_REPLAY : KsBehaviour.SHARE,
  };

  return stream;
};

const createColdStream = <T>(subscribeFn: SubscribeFn<T>): Stream<T> => {
  const subscribe: SubscribePartialFn<T> = (
    partialObserver: Partial<Observer<T>>
  ): Unsubscribable => {
    let isCompleted = false;
    const observer = observerFromPartial(partialObserver);
    return subscribeFn({
      next: (value) => {
        if (isCompleted) {
          console.warn("Logic error: Ignore call next on completed stream.");
        } else {
          observer.next(value);
        }
      },
      complete: () => {
        if (isCompleted) {
          console.warn(
            "Logic error: Ignore call complete on completed stream."
          );
        } else {
          isCompleted = true;
          observer.complete();
        }
      },
    });
  };

  const stream: Stream<T> = {
    subscribe,
    pipe: (transformFn) => transformFn(stream),
    behaviour: KsBehaviour.COLD,
  };

  return stream;
};

export const ksCreateStream = <T>(
  behaviour: KsBehaviour,
  subscribeFn: SubscribeFn<T>
): Stream<T> => {
  switch (behaviour) {
    case KsBehaviour.COLD: {
      return createColdStream(subscribeFn);
    }
    case KsBehaviour.SHARE: {
      return createShareStream(subscribeFn, false);
    }
    case KsBehaviour.SHARE_REPLAY: {
      return createShareStream(subscribeFn, true);
    }
  }
};

/**
 * Combine transformers.
 */
export const ksPipe = <A, B, C>(
  t1: TransformFn<A, B>,
  t2: TransformFn<B, C>
): TransformFn<A, C> => {
  return (s: Stream<A>): Stream<C> => s.pipe(t1).pipe(t2);
};
