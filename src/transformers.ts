import {
  KsBehaviour,
  CompleteFn,
  ksCreateStream,
  NextFn,
  Observer,
  Stream,
  TransformFn,
  Unsubscribable,
  lazySubscription,
} from './core';
import { some, none, Option, isSome } from './option';

type TimeoutId = ReturnType<typeof setTimeout>;

export const ksChangeBehaviour = <T>(b: KsBehaviour): TransformFn<T, T> => {
  return s => ksCreateStream(b, s.subscribe);
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
  tapObserver: Partial<Observer<T>>,
): TransformFn<T, T> => {
  return (stream: Stream<T>): Stream<T> => {
    return ksCreateStream(stream.behaviour, ({ next, complete }) => {
      return stream.subscribe({
        next: value => {
          tapObserver.next?.(value);
          next(value);
        },
        complete: () => {
          tapObserver.complete?.();
          complete();
        },
      });
    });
  };
};

/**
 * Emit values that pass the provided condition.
 */
export const ksFilterMap = <T, O>(
  select: (value: T) => Option<O>,
): TransformFn<T, O> => {
  return (stream: Stream<T>): Stream<O> => {
    return ksCreateStream(stream.behaviour, ({ next, complete }) => {
      return stream.subscribe({
        next: value => {
          const opt = select(value);
          if (isSome(opt)) {
            next(opt.value);
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
  project: (value: T) => Stream<O>,
): TransformFn<T, O> => {
  return (stream: Stream<T>): Stream<O> => {
    return ksCreateStream(stream.behaviour, ({ next, complete }) => {
      let projectSubscription: Unsubscribable | null = null;
      let projectCompleted = false;
      let mainCompleted = false;

      const tryComplete = () => {
        if (mainCompleted && projectCompleted) {
          complete();
        }
      };

      const onProjectComplete = () => {
        projectCompleted = true;
        tryComplete();
      };

      const onMainComplete = () => {
        mainCompleted = true;
        tryComplete();
      };

      const tryUnsubscribeProject = () => {
        if (projectSubscription !== null) {
          projectSubscription.unsubscribe();
        }
      };

      const onMainNext = (value: T) => {
        tryUnsubscribeProject();
        projectCompleted = false;
        projectSubscription = project(value).subscribe({
          next,
          complete: onProjectComplete,
        });
      };

      const mainSubscription = stream.subscribe({
        next: onMainNext,
        complete: onMainComplete,
      });

      return {
        unsubscribe: () => {
          tryUnsubscribeProject();
          mainSubscription.unsubscribe();
        },
      };
    });
  };
};

/**
 * Emit values until provided observable emits or completes.
 */
export const ksTakeUntil = <T>(
  notifier: Stream<unknown>,
): TransformFn<T, T> => {
  return (stream: Stream<T>): Stream<T> => {
    const newStream = ksCreateStream<T>(
      stream.behaviour,
      ({ next, complete }) => {
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
          let isTerminated = false;
          const notifierSubscription = lazySubscription();

          const unsubscribe = () => {
            notifierSubscription.unsubscribe();
            mainSubscription.unsubscribe();
          };

          const terminate = () => {
            if (isTerminated) return;
            isTerminated = true;
            complete();
            unsubscribe();
          };

          notifierSubscription.resolve(
            notifier.subscribe({
              next: terminate,
              complete: terminate,
            }),
          );

          return { unsubscribe };
        }
      },
    );

    return {
      ...newStream,
      pipe: () => {
        throw 'Disallows the application of operators after `takeUntil`. Operators placed after `takeUntil` can effect subscription leaks.';
      },
    };
  };
};

/**
 * Emit provided number of values before completing.
 */
export const ksTake = <T>(count: number): TransformFn<T, T> => {
  return (stream: Stream<T>): Stream<T> => {
    return ksCreateStream(stream.behaviour, ({ next, complete }) => {
      let counter = 0;

      const subscription = lazySubscription();

      const onComplete = () => {
        complete();
        subscription.unsubscribe();
      };

      const onNext: NextFn<T> = value => {
        next(value);
        if (++counter >= count) {
          onComplete();
        }
      };

      return subscription.resolve(
        stream.subscribe({
          next: onNext,
          complete: onComplete,
        }),
      );
    });
  };
};

/**
 * Emit values until provided expression is false.
 */
export const ksTakeWhile = <T>(
  predicate: (value: T) => boolean,
): TransformFn<T, T> => {
  return (stream: Stream<T>): Stream<T> => {
    return ksCreateStream(stream.behaviour, ({ next, complete }) => {
      const subscription = lazySubscription();

      const onComplete = () => {
        complete();
        subscription.unsubscribe();
      };

      const onNext: NextFn<T> = value => {
        if (predicate(value)) {
          next(value);
        } else {
          onComplete();
        }
      };

      return subscription.resolve(
        stream.subscribe({
          next: onNext,
          complete: onComplete,
        }),
      );
    });
  };
};

/**
 * Delay emitted values by given time.
 */
export const ksDelay = <T>(ms: number): TransformFn<T, T> => {
  return (stream: Stream<T>): Stream<T> => {
    return ksCreateStream(stream.behaviour, ({ next, complete }) => {
      const timers = new Set<TimeoutId>();

      const clearTimers = () => {
        timers.forEach(t => clearTimeout(t));
        timers.clear();
      };

      const subscription = stream.subscribe({
        next: value => {
          const t = setTimeout(() => {
            next(value);
            timers.delete(t);
          }, ms);
          timers.add(t);
        },
        complete: () => {
          const t = setTimeout(() => {
            complete();
            timers.delete(t);
          }, ms);
          timers.add(t);
        },
      });

      return {
        unsubscribe: () => {
          clearTimers();
          subscription.unsubscribe();
        },
      };
    });
  };
};

/**
 * Discard emitted values that take less than the specified time between output.
 */
export const ksDebounce = <T>(dueTime: number): TransformFn<T, T> => {
  return (stream: Stream<T>): Stream<T> => {
    return ksCreateStream(stream.behaviour, ({ next, complete }) => {
      let timeoutId: TimeoutId;
      let lastValue = none<T>();

      const tryNext = () => {
        if (isSome(lastValue)) {
          next(lastValue.value);
          lastValue = none();
        }
      };

      const debounceNext: NextFn<T> = value => {
        lastValue = some(value);
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
      let lastValue = none<T>();

      const tryNext = () => {
        if (isSome(lastValue)) {
          next(lastValue.value);
          lastValue = none();
        }
      };

      const throttleNext: NextFn<T> = value => {
        lastValue = some(value);
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
export const ksPairwise = <T>(): TransformFn<T, [T, T]> => {
  return (o: Stream<T>): Stream<[T, T]> => {
    return ksCreateStream(o.behaviour, ({ next, complete }) => {
      let prevValue = none<T>();
      return o.subscribe({
        next: value => {
          if (isSome(prevValue)) {
            next([prevValue.value, value]);
          }
          prevValue = some(value);
        },
        complete,
      });
    });
  };
};

/**
 * Reduce over time.
 */
export const ksScan = <T, O>(
  accumulator: (acc: O, curr: T) => O,
  seed: O,
): TransformFn<T, O> => {
  return (o: Stream<T>): Stream<O> => {
    return ksCreateStream(o.behaviour, ({ next, complete }) => {
      let acc = seed;
      return o.subscribe({
        next: value => {
          acc = accumulator(acc, value);
          next(acc);
        },
        complete,
      });
    });
  };
};
