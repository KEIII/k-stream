import {
  KsBehaviour,
  Complete,
  Next,
  Observer,
  Stream,
  Transformer,
  Unsubscribable,
  _lazy,
} from './core';
import { some, none, Option, isSome } from './option';

type TimeoutId = ReturnType<typeof setTimeout>;

export const ksChangeBehaviour = <A>(
  behaviour: KsBehaviour,
): Transformer<A, A> => {
  return stream => behaviour(stream.subscribe);
};

/**
 * Apply projection with each value from source.
 */
export const ksMap = <A, B>(project: (value: A) => B): Transformer<A, B> => {
  return stream => {
    return stream.behaviour(({ next, complete }) => {
      return stream.subscribe({
        next: (value: A) => next(project(value)),
        complete,
      });
    });
  };
};

/**
 * Map emissions to constant value.
 */
export const ksMapTo = <A, B>(value: B): Transformer<A, B> => {
  return stream => {
    return stream.behaviour(({ next, complete }) => {
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
export const ksTap = <A>(observer: Observer<A>): Transformer<A, A> => {
  return stream => {
    return stream.behaviour(({ next, complete }) => {
      return stream.subscribe({
        next: value => {
          observer.next?.(value);
          next(value);
        },
        complete: () => {
          observer.complete?.();
          complete();
        },
      });
    });
  };
};

/**
 * Emit values that pass the provided condition.
 */
export const ksFilterMap = <A, B>(
  select: (value: A) => Option<B>,
): Transformer<A, B> => {
  return stream => {
    return stream.behaviour(({ next, complete }) => {
      return stream.subscribe({
        next: value => {
          const valueOptional = select(value);
          if (isSome(valueOptional)) {
            next(valueOptional.value);
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
export const ksSwitch = <A, B>(
  project: (value: A) => Stream<B>,
): Transformer<A, B> => {
  return stream => {
    return stream.behaviour(({ next, complete }) => {
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

      const onMainNext = (value: A) => {
        projectSubscription?.unsubscribe();
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
          projectSubscription?.unsubscribe();
          mainSubscription.unsubscribe();
        },
      };
    });
  };
};

/**
 * Emit values until provided observable emits or completes.
 */
export const ksTakeUntil = <A>(
  notifier: Stream<unknown>,
): Transformer<A, A> => {
  return stream => {
    const newStream = stream.behaviour<A>(({ next, complete }) => {
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
      }

      let isTerminated = false;
      const _notifier = _lazy(notifier);

      const unsubscribe = () => {
        _notifier.unsubscribe();
        mainSubscription.unsubscribe();
      };

      const terminate = () => {
        if (isTerminated) return;
        isTerminated = true;
        complete();
        unsubscribe();
      };

      _notifier.subscribe({
        next: terminate,
        complete: terminate,
      });

      return { unsubscribe };
    });

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
export const ksTake = <A>(count: number): Transformer<A, A> => {
  return stream => {
    return stream.behaviour(({ next, complete }) => {
      let counter = 0;

      const _stream = _lazy(stream);

      const onComplete = () => {
        complete();
        _stream.unsubscribe();
      };

      const onNext: Next<A> = value => {
        next(value);
        if (++counter >= count) {
          onComplete();
        }
      };

      return _stream.subscribe({
        next: onNext,
        complete: onComplete,
      });
    });
  };
};

/**
 * Emit values until provided expression is false.
 */
export const ksTakeWhile = <A>(
  predicate: (value: A) => boolean,
): Transformer<A, A> => {
  return stream => {
    return stream.behaviour(({ next, complete }) => {
      const _stream = _lazy(stream);

      const onComplete: Complete = () => {
        complete();
        _stream.unsubscribe();
      };

      const onNext: Next<A> = value => {
        if (predicate(value)) {
          next(value);
        } else {
          onComplete();
        }
      };

      return _stream.subscribe({
        next: onNext,
        complete: onComplete,
      });
    });
  };
};

/**
 * Delay emitted values by given time.
 */
export const ksDelay = <A>(ms: number): Transformer<A, A> => {
  return stream => {
    return stream.behaviour(({ next, complete }) => {
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
export const ksDebounce = <A>(dueTime: number): Transformer<A, A> => {
  return stream => {
    return stream.behaviour(({ next, complete }) => {
      let timeoutId: TimeoutId;
      let lastValue: Option<A> = none;

      const tryNext = () => {
        if (isSome(lastValue)) {
          next(lastValue.value);
          lastValue = none;
        }
      };

      const debounceNext: Next<A> = value => {
        lastValue = some(value);
        clearTimeout(timeoutId);
        timeoutId = setTimeout(tryNext, dueTime);
      };

      const debounceComplete: Complete = () => {
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
export const ksThrottle = <A>(duration: number): Transformer<A, A> => {
  return stream => {
    return stream.behaviour(({ next, complete }) => {
      let executedTime = Number.MIN_SAFE_INTEGER;
      let lastValue: Option<A> = none;

      const tryNext = () => {
        if (isSome(lastValue)) {
          next(lastValue.value);
          lastValue = none;
        }
      };

      const throttleNext: Next<A> = value => {
        lastValue = some(value);
        const now = Date.now();
        const diff = now - executedTime;
        if (diff > duration) {
          executedTime = now;
          tryNext();
        }
      };

      const throttleComplete: Complete = () => {
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
export const ksPairwise = <A>(): Transformer<A, [A, A]> => {
  return stream => {
    return stream.behaviour(({ next, complete }) => {
      let prevValue: Option<A> = none;
      return stream.subscribe({
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
export const ksScan = <A, B>(
  accumulator: (acc: B, curr: A) => B,
  seed: B,
): Transformer<A, B> => {
  return stream => {
    return stream.behaviour(({ next, complete }) => {
      let acc = seed;
      return stream.subscribe({
        next: value => {
          acc = accumulator(acc, value);
          next(acc);
        },
        complete,
      });
    });
  };
};
