import {
  asyncScheduler,
  ksCold,
  _lazy,
  Observable,
  Stream,
  noopUnsubscribe,
  Unsubscribable,
} from './core';
import { ksMap } from './transformers';
import { isSome, none, Option, some } from './option';
import { Either, left, right } from './either';

/**
 * Observable that emits no items and does not terminate.
 */
export const ksNever = ksCold<never>(() => noopUnsubscribe);

const _ksEmpty = ksCold<never>(({ complete }) => {
  complete();
  return noopUnsubscribe;
});

/**
 * Observable that immediately completes.
 */
export const ksEmpty = (): Stream<never> => _ksEmpty;

/**
 * Emit variable amount of values in a sequence and then emits a complete notification.
 */
export const ksOf = <A>(value: A, behaviour = ksCold): Stream<A> => {
  return behaviour(({ next, complete }) => {
    next(value);
    complete();
    return noopUnsubscribe;
  });
};

/**
 * Subscribe to observables in order as previous completes.
 */
export const ksConcat = <A, B>(
  stream_a: Stream<A>,
  stream_b: Stream<B>,
): Stream<A | B> => {
  return stream_a.behaviour(({ next, complete }) => {
    const b = _lazy(stream_b);

    const a = stream_a.subscribe({
      next,
      complete: () => {
        b.subscribe({ next, complete });
      },
    });

    return {
      unsubscribe: () => {
        b.unsubscribe();
        a.unsubscribe();
      },
    };
  });
};

/**
 * Turn multiple observables into a single observable.
 */
export const ksMerge = <A, B>(
  stream_a: Stream<A>,
  stream_b: Stream<B>,
): Stream<A | B> => {
  return stream_a.behaviour(({ next, complete }) => {
    let completed_a = false;
    let completed_b = false;
    const a = _lazy(stream_a);
    const b = _lazy(stream_b);

    const unsubscribe = () => {
      b.unsubscribe();
      a.unsubscribe();
    };

    const tryComplete = () => {
      if (completed_a && completed_b) {
        complete();
        unsubscribe();
      }
    };

    a.subscribe({
      next,
      complete: () => {
        completed_a = true;
        tryComplete();
      },
    });

    b.subscribe({
      next,
      complete: () => {
        completed_b = true;
        tryComplete();
      },
    });

    return { unsubscribe };
  });
};

/**
 * After all observables emit, emit values as an array.
 */
export const ksZip = <A, B>(
  stream_a: Stream<A>,
  stream_b: Stream<B>,
): Stream<[A, B]> => {
  return stream_a.behaviour(({ next, complete }) => {
    let completed_a = false;
    let completed_b = false;
    const queue_a: A[] = [];
    const queue_b: B[] = [];
    const a = _lazy(stream_a);
    const b = _lazy(stream_b);

    const unsubscribe = () => {
      b.unsubscribe();
      a.unsubscribe();
    };

    const tryNext = () => {
      if (queue_a.length > 0 && queue_b.length > 0) {
        next([queue_a.shift() as A, queue_b.shift() as B]);
      }
    };

    const tryComplete = () => {
      if (
        (completed_a && queue_a.length === 0) ||
        (completed_b && queue_b.length === 0)
      ) {
        complete();
        unsubscribe();
      }
    };

    a.subscribe({
      next: value => {
        queue_a.push(value);
        tryNext();
      },
      complete: () => {
        completed_a = true;
        tryComplete();
      },
    });

    b.subscribe({
      next: value => {
        queue_b.push(value);
        tryNext();
      },
      complete: () => {
        completed_b = true;
        tryComplete();
      },
    });

    return { unsubscribe };
  });
};

/**
 * Emits a single item after a delay period.
 */
export const ksTimeout = (
  ms: number,
  behaviour = ksCold,
  scheduler = asyncScheduler,
): Stream<number> => {
  return behaviour(({ next, complete }) => {
    const handler = () => {
      next(0);
      complete();
    };
    return scheduler.schedule(handler, ms);
  });
};

/**
 * After given duration, emit numbers in sequence every specified duration.
 */
export const ksInterval = (
  ms: number,
  behaviour = ksCold,
  scheduler = asyncScheduler,
): Stream<number> => {
  return behaviour(({ next }) => {
    let count = 0;
    let sub: Unsubscribable | undefined;
    let isUnsubscribed = false;
    const tick = () => {
      sub = scheduler.schedule(handler, ms);
      // check if `unsubscribed` was changed inside `handler()`
      if (isUnsubscribed) {
        sub.unsubscribe();
      }
    };
    const handler = () => {
      next(count++);
      tick();
    };
    tick();
    return {
      unsubscribe: () => {
        isUnsubscribed = true;
        sub?.unsubscribe();
      },
    };
  });
};

/**
 * Emit numbers in sequence every specified duration.
 */
export const ksPeriodic = (
  ms: number,
  behaviour = ksCold,
  scheduler = asyncScheduler,
): Stream<number> => {
  return ksConcat(
    ksOf(0, behaviour),
    ksInterval(ms, behaviour, scheduler).pipe(ksMap(n => n + 1)),
  );
};

/**
 * When any observable emits a value, emit the last emitted value from each.
 */
export const ksCombineLatest = <A, B>(
  stream_a: Stream<A>,
  stream_b: Stream<B>,
): Stream<[A, B]> => {
  return stream_a.behaviour(({ next, complete }) => {
    let completed_a = false;
    let completed_b = false;
    let value_a: Option<A> = none;
    let value_b: Option<B> = none;
    const a = _lazy(stream_a);
    const b = _lazy(stream_b);

    const unsubscribe = () => {
      b.unsubscribe();
      a.unsubscribe();
    };

    const tryNext = () => {
      if (isSome(value_a) && isSome(value_b)) {
        return next([value_a.value, value_b.value]);
      }
    };

    const tryComplete = () => {
      if (completed_a && completed_b) {
        complete();
        unsubscribe();
      }
    };

    a.subscribe({
      next: value => {
        value_a = some(value);
        tryNext();
      },
      complete: () => {
        completed_a = true;
        tryComplete();
      },
    });

    b.subscribe({
      next: value => {
        value_b = some(value);
        tryNext();
      },
      complete: () => {
        completed_b = true;
        tryComplete();
      },
    });

    return { unsubscribe };
  });
};

/**
 * When all observables complete, emit the last emitted value from each.
 */
export const ksForkJoin = <A, B>(
  stream_a: Stream<A>,
  stream_b: Stream<B>,
): Stream<[A, B]> => {
  return stream_a.behaviour(({ next, complete }) => {
    let completed_a = false;
    let completed_b = false;
    let value_a: Option<A> = none;
    let value_b: Option<B> = none;
    const a = _lazy(stream_a);
    const b = _lazy(stream_b);

    const unsubscribe = () => {
      b.unsubscribe();
      a.unsubscribe();
    };

    const tryComplete = () => {
      if (completed_a && completed_b && isSome(value_a) && isSome(value_b)) {
        next([value_a.value, value_b.value]);
        complete();
        unsubscribe();
      }
    };

    a.subscribe({
      next: value => (value_a = some(value)),
      complete: () => {
        completed_a = true;
        tryComplete();
      },
    });

    b.subscribe({
      next: value => (value_b = some(value)),
      complete: () => {
        completed_b = true;
        tryComplete();
      },
    });

    return { unsubscribe };
  });
};

export const ksFromPromise = <A, E>(
  promise: Promise<A>,
  behaviour = ksCold,
): Stream<Either<E, A>> => {
  return behaviour(({ next, complete }) => {
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

export const ksToPromise = <A>(
  observable: Observable<A>,
): Promise<Option<A>> => {
  return new Promise<Option<A>>(resolve => {
    let result: Option<A> = none;
    observable.subscribe({
      next: value => (result = some(value)),
      complete: () => resolve(result),
    });
  });
};
