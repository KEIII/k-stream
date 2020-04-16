import {
  KsBehaviour,
  CompleteFn,
  ksCreateStream,
  NextFn,
  Observer,
  observerFromPartial,
  Stream,
  TransformFn,
  Unsubscribable,
} from "./core";
import { Some, None, Option } from "./ts-option";

export const ksChangeBehaviour = <T>(
  newBehaviour: KsBehaviour
): TransformFn<T, T> => {
  return (stream: Stream<T>): Stream<T> => {
    return ksCreateStream(newBehaviour, stream.subscribe);
  };
};

/**
 * Apply projection with each value from source.
 */
export const ksMap = <T, O>(project: (value: T) => O): TransformFn<T, O> => {
  return (stream: Stream<T>): Stream<O> => {
    return ksCreateStream(stream.behaviour, ({ next, complete }) => {
      return stream.subscribe({
        next: (value: T) => next(project(value)),
        complete,
      });
    });
  };
};

/**
 * Map emissions to constant value.
 */
export const ksMapTo = <T, O>(value: O): TransformFn<T, O> => {
  return (stream: Stream<T>): Stream<O> => {
    return ksCreateStream(stream.behaviour, ({ next, complete }) => {
      return stream.subscribe({
        next: () => next(value),
        complete,
      });
    });
  };
};

/**
 * Transparently perform actions or side-effects, such as logging.
 */
export const ksTap = <T>(
  tapPartialObserver: Partial<Observer<T>>
): TransformFn<T, T> => {
  return (stream: Stream<T>): Stream<T> => {
    return ksCreateStream(stream.behaviour, ({ next, complete }) => {
      const tapObserver = observerFromPartial(tapPartialObserver);
      return stream.subscribe({
        next: (value) => {
          tapObserver.next(value);
          next(value);
        },
        complete: () => {
          tapObserver.complete();
          complete();
        },
      });
    });
  };
};

/**
 * Emit values that pass the provided condition.
 */
export const ksFilter = <T, O extends T>(
  select: (value: T) => Option<O>
): TransformFn<T, O> => {
  return (stream: Stream<T>): Stream<O> => {
    return ksCreateStream(stream.behaviour, ({ next, complete }) => {
      return stream.subscribe({
        next: (value: T) => {
          const o = select(value);
          if (o._tag === "Some") {
            next(o.some);
          }
        },
        complete,
      });
    });
  };
};

/**
 * Map to observable, complete previous inner observable, emit values.
 */
export const ksSwitch = <T, O>(
  project: (value: T) => Stream<O>
): TransformFn<T, O> => {
  return (stream: Stream<T>): Stream<O> => {
    return ksCreateStream(stream.behaviour, ({ next, complete }) => {
      let projectedSubscription: Unsubscribable | null = null;
      const mainSubscription = stream.subscribe({
        next: (value: T) => {
          const projectedObservable = project(value);
          if (projectedSubscription !== null) {
            projectedSubscription.unsubscribe();
          }
          projectedSubscription = projectedObservable.subscribe({ next });
        },
        complete,
      });
      return {
        unsubscribe: () => {
          if (projectedSubscription !== null) {
            projectedSubscription.unsubscribe();
          }
          mainSubscription.unsubscribe();
        },
      };
    });
  };
};

/**
 * Emit values until provided observable emits.
 */
export const ksTakeUntil = <T>(
  notifier: Stream<unknown>
): TransformFn<T, T> => {
  return (stream: Stream<T>): Stream<T> => {
    return ksCreateStream(stream.behaviour, ({ next, complete }) => {
      let notified = false;
      let isCompleted = false;

      const mainSubscription = stream.subscribe({
        next,
        complete: () => {
          isCompleted = true;
          complete();
        },
      });

      if (isCompleted) {
        return mainSubscription;
      } else {
        const notifierSubscription = notifier.subscribe({
          next: () => {
            if (!notified) {
              notified = true;
              mainSubscription.unsubscribe();
              setTimeout(() => notifierSubscription.unsubscribe());
            }
          },
          complete,
        });

        return {
          unsubscribe: () => {
            notifierSubscription.unsubscribe();
            mainSubscription.unsubscribe();
          },
        };
      }
    });
  };
};

/**
 * Emit provided number of values before completing.
 */
export const ksTake = <T>(count: number): TransformFn<T, T> => {
  return (stream: Stream<T>): Stream<T> => {
    return ksCreateStream(stream.behaviour, ({ next, complete }) => {
      let counter = 0;

      const tryNext: NextFn<T> = (value) => {
        next(value);
        if (++counter >= count) {
          complete();
          setTimeout(() => subscription.unsubscribe());
        }
      };

      const subscription = stream.subscribe({ next: tryNext, complete });

      return subscription;
    });
  };
};

/**
 * Discard emitted values that take less than the specified time between output.
 */
export const ksDebounce = <T>(dueTime: number): TransformFn<T, T> => {
  return (stream: Stream<T>): Stream<T> => {
    return ksCreateStream(stream.behaviour, ({ next, complete }) => {
      let timeoutId: ReturnType<typeof setTimeout>;
      let lastValue = None<T>();

      const tryNext = () => {
        if (lastValue._tag === "Some") {
          next(lastValue.some);
          lastValue = None();
        }
      };

      const debounceNext: NextFn<T> = (value) => {
        lastValue = Some(value);
        clearTimeout(timeoutId);
        timeoutId = setTimeout(tryNext, dueTime);
      };

      const debounceComplete: CompleteFn = () => {
        clearTimeout(timeoutId);
        tryNext();
        complete();
      };

      const subscription = stream.subscribe({
        next: debounceNext,
        complete: debounceComplete,
      });

      return {
        unsubscribe: () => {
          tryNext();
          clearTimeout(timeoutId);
          subscription.unsubscribe();
        },
      };
    });
  };
};

/**
 * Emit first value then ignore for specified duration.
 */
export const ksThrottle = <T>(duration: number): TransformFn<T, T> => {
  return (stream: Stream<T>): Stream<T> => {
    return ksCreateStream(stream.behaviour, ({ next, complete }) => {
      let executedTime = Number.MIN_SAFE_INTEGER;
      let lastValue = None<T>();

      const tryNext = () => {
        if (lastValue._tag === "Some") {
          next(lastValue.some);
          lastValue = None();
        }
      };

      const throttleNext: NextFn<T> = (value) => {
        lastValue = Some(value);
        const now = Date.now();
        const diff = now - executedTime;
        if (diff > duration) {
          executedTime = now;
          tryNext();
        }
      };

      const throttleComplete: CompleteFn = () => {
        tryNext();
        complete();
      };

      return stream.subscribe({
        next: throttleNext,
        complete: throttleComplete,
      });
    });
  };
};

/**
 * Emit the previous and current values as an array.
 */
export const ksPairwise = () => {
  return <T>(o: Stream<T>): Stream<[T, T]> => {
    return ksCreateStream(o.behaviour, ({ next, complete }) => {
      let prevValue = None<T>();
      return o.subscribe({
        next: (value) => {
          if (prevValue._tag === "Some") {
            next([prevValue.some, value]);
          }
          prevValue = Some(value);
        },
        complete,
      });
    });
  };
};
