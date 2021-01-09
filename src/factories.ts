import {
  asyncScheduler,
  ksCold,
  ksCreateStream,
  lazySubscription,
  noop,
  Observable,
  Stream,
} from './core';
import { ksMap } from './transformers';
import { isSome, none, Option, some } from './option';
import { Either, left, right } from './either';

/**
 * Observable that immediately completes.
 */
export const ksEmpty = <T>(): Stream<T> => {
  return ksCreateStream(ksCold, ({ complete }) => {
    complete();
    return { unsubscribe: noop };
  });
};

/**
 * Emit variable amount of values in a sequence and then emits a complete notification.
 */
export const ksOf = <T>(value: T, behaviour = ksCold): Stream<T> => {
  return ksCreateStream<T>(behaviour, ({ next, complete }) => {
    next(value);
    complete();
    return { unsubscribe: noop };
  });
};

/**
 * Subscribe to observables in order as previous completes.
 */
export const ksConcat = <T1, T2>(
  stream1: Stream<T1>,
  stream2: Stream<T2>,
): Stream<T1 | T2> => {
  return ksCreateStream(stream1.behaviour, ({ next, complete }) => {
    const subscription2 = lazySubscription();

    const subscription1 = stream1.subscribe({
      next,
      complete: () => {
        subscription2.resolve(stream2.subscribe({ next, complete }));
      },
    });

    return {
      unsubscribe: () => {
        subscription2.unsubscribe();
        subscription1.unsubscribe();
      },
    };
  });
};

/**
 * Turn multiple observables into a single observable.
 */
export const ksMerge = <T1, T2>(
  stream1: Stream<T1>,
  stream2: Stream<T2>,
): Stream<T1 | T2> => {
  return ksCreateStream(stream1.behaviour, ({ next, complete }) => {
    let completed1 = false;
    let completed2 = false;
    const subscription1 = lazySubscription();
    const subscription2 = lazySubscription();

    const unsubscribe = () => {
      subscription2.unsubscribe();
      subscription1.unsubscribe();
    };

    const tryComplete = () => {
      if (completed1 && completed2) {
        complete();
        unsubscribe();
      }
    };

    subscription1.resolve(
      stream1.subscribe({
        next,
        complete: () => {
          completed1 = true;
          tryComplete();
        },
      }),
    );

    subscription2.resolve(
      stream2.subscribe({
        next,
        complete: () => {
          completed2 = true;
          tryComplete();
        },
      }),
    );

    return { unsubscribe };
  });
};

/**
 * After all observables emit, emit values as an array.
 */
export const ksZip = <T1, T2>(
  stream1: Stream<T1>,
  stream2: Stream<T2>,
): Stream<[T1, T2]> => {
  return ksCreateStream(stream1.behaviour, ({ next, complete }) => {
    let completed1 = false;
    let completed2 = false;
    const queue1: T1[] = [];
    const queue2: T2[] = [];
    const subscription1 = lazySubscription();
    const subscription2 = lazySubscription();

    const unsubscribe = () => {
      subscription2.unsubscribe();
      subscription1.unsubscribe();
    };

    const tryNext = () => {
      if (queue1.length > 0 && queue2.length > 0) {
        next([queue1.shift() as T1, queue2.shift() as T2]);
      }
    };

    const tryComplete = () => {
      if (
        (completed1 && queue1.length === 0) ||
        (completed2 && queue2.length === 0)
      ) {
        complete();
        unsubscribe();
      }
    };

    subscription1.resolve(
      stream1.subscribe({
        next: value => {
          queue1.push(value);
          tryNext();
        },
        complete: () => {
          completed1 = true;
          tryComplete();
        },
      }),
    );

    subscription2.resolve(
      stream2.subscribe({
        next: value => {
          queue2.push(value);
          tryNext();
        },
        complete: () => {
          completed2 = true;
          tryComplete();
        },
      }),
    );

    return { unsubscribe };
  });
};

export const ksTimeout = (
  ms: number,
  behaviour = ksCold,
  scheduler = asyncScheduler,
): Stream<number> => {
  return ksCreateStream(behaviour, ({ next, complete }) => {
    const handler = () => {
      next(0);
      complete();
    };
    return scheduler.schedule(handler, ms);
  });
};

export const ksInterval = (
  ms: number,
  behaviour = ksCold,
  scheduler = asyncScheduler,
): Stream<number> => {
  return ksCreateStream(behaviour, ({ next }) => {
    let count = 0;
    let unsubscribe = noop;
    const tick = () => {
      unsubscribe = scheduler.schedule(handler, ms).unsubscribe;
    };
    const handler = () => {
      next(count++);
      tick();
    };
    tick();
    return { unsubscribe: () => unsubscribe() };
  });
};

export const ksPeriodic = (ms: number, behaviour = ksCold): Stream<number> => {
  return ksConcat(
    ksOf(0, behaviour),
    ksInterval(ms, behaviour).pipe(ksMap(n => n + 1)),
  );
};

/**
 * When any observable emits a value, emit the last emitted value from each.
 */
export const ksCombineLatest = <T1, T2>(
  stream1: Stream<T1>,
  stream2: Stream<T2>,
): Stream<[T1, T2]> => {
  return ksCreateStream(stream1.behaviour, ({ next, complete }) => {
    let completed1 = false;
    let completed2 = false;
    let value1 = none<T1>();
    let value2 = none<T2>();
    const subscription1 = lazySubscription();
    const subscription2 = lazySubscription();

    const unsubscribe = () => {
      subscription2.unsubscribe();
      subscription1.unsubscribe();
    };

    const tryNext = () => {
      if (isSome(value1) && isSome(value2)) {
        return next([value1.value, value2.value]);
      }
    };

    const tryComplete = () => {
      if (completed1 && completed2) {
        complete();
        unsubscribe();
      }
    };

    subscription1.resolve(
      stream1.subscribe({
        next: value => {
          value1 = some(value);
          tryNext();
        },
        complete: () => {
          completed1 = true;
          tryComplete();
        },
      }),
    );

    subscription2.resolve(
      stream2.subscribe({
        next: value => {
          value2 = some(value);
          tryNext();
        },
        complete: () => {
          completed2 = true;
          tryComplete();
        },
      }),
    );

    return { unsubscribe };
  });
};

/**
 * When all observables complete, emit the last emitted value from each.
 */
export const ksForkJoin = <T1, T2>(
  stream1: Stream<T1>,
  stream2: Stream<T2>,
): Stream<[T1, T2]> => {
  return ksCreateStream(stream1.behaviour, ({ next, complete }) => {
    let completed1 = false;
    let completed2 = false;
    let value1 = none<T1>();
    let value2 = none<T2>();
    const subscription1 = lazySubscription();
    const subscription2 = lazySubscription();

    const unsubscribe = () => {
      subscription2.unsubscribe();
      subscription1.unsubscribe();
    };

    const tryComplete = () => {
      if (completed1 && completed2 && isSome(value1) && isSome(value2)) {
        next([value1.value, value2.value]);
        complete();
        unsubscribe();
      }
    };

    subscription1.resolve(
      stream1.subscribe({
        next: value => (value1 = some(value)),
        complete: () => {
          completed1 = true;
          tryComplete();
        },
      }),
    );

    subscription2.resolve(
      stream2.subscribe({
        next: value => (value2 = some(value)),
        complete: () => {
          completed2 = true;
          tryComplete();
        },
      }),
    );

    return { unsubscribe };
  });
};

export const ksFromPromise = <T, E>(
  promise: Promise<T>,
  behaviour = ksCold,
): Stream<Either<E, T>> => {
  return ksCreateStream(behaviour, ({ next, complete }) => {
    let on = true;
    promise
      .then(value => {
        if (on) {
          next(right(value));
          complete();
        }
      })
      .catch((err: E) => {
        if (on) {
          next(left(err));
          complete();
        }
      });
    return { unsubscribe: () => (on = false) };
  });
};

export const ksToPromise = <T>(o: Observable<T>): Promise<Option<T>> => {
  return new Promise<Option<T>>(resolve => {
    let result = none<T>();
    o.subscribe({
      next: value => (result = some(value)),
      complete: () => resolve(result),
    });
  });
};
