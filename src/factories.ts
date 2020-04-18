import {
  KsBehaviour,
  ksCreateStream,
  noop,
  Observable,
  Stream,
  Unsubscribable,
} from "./core";
import { ksMap } from "./transformers";
import { None, Option, Some } from "./ts-option";
import { Err, Ok, Result } from "./ts-result";

/**
 * Observable that immediately completes.
 */
export const ksEmpty = <T>(): Stream<T> => {
  return ksCreateStream(KsBehaviour.COLD, ({ complete }) => {
    complete();
    return { unsubscribe: noop };
  });
};

/**
 * Emit variable amount of values in a sequence and then emits a complete notification.
 */
export const ksOf = <T>(value: T, behaviour: KsBehaviour): Stream<T> => {
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
  stream2: Stream<T2>
): Stream<T1 | T2> => {
  return ksCreateStream(stream1.behaviour, ({ next, complete }) => {
    let subscription1: Unsubscribable | null = null;

    const subscription2 = stream1.subscribe({
      next,
      complete: () => {
        subscription1 = stream2.subscribe({ next, complete });
      },
    });

    const tryUnsubscribeFirst = () => {
      if (subscription1 !== null) {
        subscription1.unsubscribe();
      }
    };

    return {
      unsubscribe: () => {
        subscription2.unsubscribe();
        tryUnsubscribeFirst();
      },
    };
  });
};

/**
 * Turn multiple observables into a single observable.
 */
export const ksMerge = <T1, T2>(
  stream1: Stream<T1>,
  stream2: Stream<T2>
): Stream<T1 | T2> => {
  return ksCreateStream(stream1.behaviour, ({ next, complete }) => {
    let completed1 = false;
    let completed2 = false;

    const tryComplete = () => {
      if (completed1 && completed2) {
        complete();
      }
    };

    const subscription1 = stream1.subscribe({
      next,
      complete: () => {
        completed1 = true;
        tryComplete();
      },
    });

    const subscription2 = stream2.subscribe({
      next,
      complete: () => {
        completed2 = true;
        tryComplete();
      },
    });

    return {
      unsubscribe: () => {
        subscription1.unsubscribe();
        subscription2.unsubscribe();
      },
    };
  });
};

export const ksTimeout = (
  ms: number,
  behaviour: KsBehaviour
): Stream<number> => {
  return ksCreateStream(behaviour, ({ next, complete }) => {
    const handler = () => {
      next(0);
      complete();
    };
    const timeoutId = setTimeout(handler, ms);
    return { unsubscribe: () => clearInterval(timeoutId) };
  });
};

export const ksInterval = (
  ms: number,
  behaviour: KsBehaviour
): Stream<number> => {
  return ksCreateStream(behaviour, ({ next }) => {
    let count = 0;
    const handler = () => next(count++);
    const intervalId = setInterval(handler, ms);
    return { unsubscribe: () => clearInterval(intervalId) };
  });
};

export const ksPeriodic = (
  ms: number,
  behaviour: KsBehaviour
): Stream<number> => {
  return ksConcat(
    ksOf(0, behaviour),
    ksInterval(ms, behaviour).pipe(ksMap((n) => n + 1))
  );
};

/**
 * When any observable emits a value, emit the last emitted value from each.
 */
export const ksCombineLatest = <T1, T2>(
  stream1: Stream<T1>,
  stream2: Stream<T2>
): Stream<[T1, T2]> => {
  return ksCreateStream(stream1.behaviour, ({ next, complete }) => {
    let completed1 = false;
    let completed2 = false;
    let value1 = None<T1>();
    let value2 = None<T2>();

    const tryNext = () => {
      if (value1._tag === "Some" && value2._tag === "Some") {
        return next([value1.some, value2.some]);
      }
    };

    const tryComplete = () => {
      if (completed1 && completed2) {
        complete();
      }
    };

    const subscription1 = stream1.subscribe({
      next: (value) => {
        value1 = Some(value);
        tryNext();
      },
      complete: () => {
        completed1 = true;
        tryComplete();
      },
    });

    const subscription2 = stream2.subscribe({
      next: (value) => {
        value2 = Some(value);
        tryNext();
      },
      complete: () => {
        completed2 = true;
        tryComplete();
      },
    });

    return {
      unsubscribe: () => {
        subscription1.unsubscribe();
        subscription2.unsubscribe();
      },
    };
  });
};

/**
 * When all observables complete, emit the last emitted value from each.
 */
export const ksForkJoin = <T1, T2>(
  stream1: Stream<T1>,
  stream2: Stream<T2>
): Stream<[T1, T2]> => {
  return ksCreateStream(stream1.behaviour, ({ next, complete }) => {
    let completed1 = false;
    let completed2 = false;
    let value1 = None<T1>();
    let value2 = None<T2>();

    const tryComplete = () => {
      if (
        completed1 &&
        completed2 &&
        value1._tag === "Some" &&
        value2._tag === "Some"
      ) {
        next([value1.some, value2.some]);
        complete();
      }
    };

    const subscription1 = stream1.subscribe({
      next: (value) => (value1 = Some(value)),
      complete: () => {
        completed1 = true;
        tryComplete();
      },
    });

    const subscription2 = stream2.subscribe({
      next: (value) => (value2 = Some(value)),
      complete: () => {
        completed2 = true;
        tryComplete();
      },
    });

    return {
      unsubscribe: () => {
        subscription1.unsubscribe();
        subscription2.unsubscribe();
      },
    };
  });
};

export const ksFromPromise = <T, E>(
  promise: Promise<T>,
  behaviour: KsBehaviour
): Stream<Result<T, E>> => {
  return ksCreateStream(behaviour, ({ next, complete }) => {
    let on = true;
    promise
      .then((value) => {
        if (on) {
          next(Ok(value));
          complete();
        }
      })
      .catch((err: E) => {
        if (on) {
          next(Err(err));
          complete();
        }
      });
    return { unsubscribe: () => (on = false) };
  });
};

export const ksToPromise = <T>(o: Observable<T>): Promise<Option<T>> => {
  return new Promise<Option<T>>((resolve) => {
    let result = None<T>();
    const s = o.subscribe({
      next: (value) => (result = Some(value)),
      complete: () => {
        resolve(result);
        setTimeout(() => s.unsubscribe());
      },
    });
  });
};
