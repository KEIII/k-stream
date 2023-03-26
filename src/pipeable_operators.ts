import {
  KsConstructor,
  Complete,
  Next,
  Observer,
  Stream,
  PipeableOperator,
  Unsubscribable,
} from './core';
import { some, none, Option, isSome, isNone } from './option';
import { ksEmpty } from './creation_operators';
import { ksSubject, Subject } from './subject';
import { Either, isRight, left } from './either';
import { _once, _subscribableOnce, _unsubscribableObservable } from './private';

type TimeoutId = ReturnType<typeof setTimeout>;

export const ksChangeConstructor = <A>(
  constructor: KsConstructor,
): PipeableOperator<A, A> => {
  return stream => constructor(stream.subscribe);
};

/**
 * Apply projection with each value from source.
 */
export const ksMap = <A, B>(
  project: (value: A) => B,
): PipeableOperator<A, B> => {
  return stream => {
    return stream.constructor(({ next, complete }) => {
      return stream.subscribe({
        next: value => next(project(value)),
        complete,
      });
    });
  };
};

/**
 * Map emissions to constant value.
 */
export const ksMapTo = <A, B>(value: B): PipeableOperator<A, B> => {
  return stream => stream.pipe(ksMap(() => value));
};

/**
 * Transparently perform actions or side-effects, such as logging.
 */
export const ksTap = <A>(observer: Observer<A>): PipeableOperator<A, A> => {
  return stream => {
    return stream.constructor(({ next, complete }) => {
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
): PipeableOperator<A, B> => {
  return stream => {
    return stream.constructor(({ next, complete }) => {
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
): PipeableOperator<A, B> => {
  return stream => {
    return stream.constructor(({ next, complete }) => {
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

      let prevProjected: Stream<B>;

      const onMainNext = (value: A) => {
        const projected = project(value);
        if (projected === prevProjected) {
          return;
        }
        prevProjected = projected;
        const projectUnsubscribe = projectSubscription?.unsubscribe;
        projectSubscription = prevProjected.subscribe({
          next,
          complete: onProjectComplete,
        });
        projectUnsubscribe?.(); // NOTE: we need to unsubscribe after create new subscription on projected stream
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
): PipeableOperator<A, A> => {
  return stream => {
    const newStream = stream.constructor<A>(({ next, complete }) => {
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

      const _notifier = _unsubscribableObservable(notifier);

      const unsubscribe = () => {
        _notifier.unsubscribe();
        mainSubscription.unsubscribe();
      };

      const terminate = _once(() => {
        complete();
        unsubscribe();
      });

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
export const ksTake = <A>(count: number): PipeableOperator<A, A> => {
  if (count <= 0) return ksEmpty;
  return stream => {
    return stream.constructor(({ next, complete }) => {
      const _stream = _unsubscribableObservable(stream);
      let seen = 0;

      const onComplete: Complete = () => {
        _stream.unsubscribe();
        complete();
      };

      return _stream.subscribe({
        next: value => {
          if (++seen <= count) {
            next(value);
            if (seen >= count) {
              onComplete();
            }
          }
        },
        complete: onComplete,
      });
    });
  };
};

/**
 * Emit values until provided expression is false.
 */
export const ksTakeWhile = <A>(
  predicate: (value: A, index: number) => boolean,
): PipeableOperator<A, A> => {
  return stream => {
    return stream.constructor(({ next, complete }) => {
      const _stream = _unsubscribableObservable(stream);
      let index = 0;

      const onComplete: Complete = () => {
        _stream.unsubscribe();
        complete();
      };

      return _stream.subscribe({
        next: value => {
          if (predicate(value, index++)) {
            next(value);
          } else {
            onComplete();
          }
        },
        complete: onComplete,
      });
    });
  };
};

/**
 * Delay emitted values by given time.
 */
export const ksDelay = <A>(ms: number): PipeableOperator<A, A> => {
  return stream => {
    return stream.constructor(({ next, complete }) => {
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
export const ksDebounce = <A>(dueTime: number): PipeableOperator<A, A> => {
  return stream => {
    return stream.constructor(({ next, complete }) => {
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
export const ksThrottle = <A>(duration: number): PipeableOperator<A, A> => {
  return stream => {
    return stream.constructor(({ next, complete }) => {
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
export const ksPairwise = <A>(): PipeableOperator<A, [A, A]> => {
  return stream => {
    return stream.constructor(({ next, complete }) => {
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
): PipeableOperator<A, B> => {
  return stream => {
    return stream.constructor(({ next, complete }) => {
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

/**
 * Repeats an observable on completion.
 */
export const ksRepeat = <A>(count: number): PipeableOperator<A, A> => {
  if (count <= 0) return ksEmpty;
  return stream => {
    return stream.constructor(observer => {
      let soFar = 0;
      let innerSub: Unsubscribable | null = null;
      const subscribeForRepeat = () => {
        let syncUnsub = false;
        innerSub?.unsubscribe();
        innerSub = stream.subscribe({
          next: observer.next,
          complete: () => {
            if (++soFar < count) {
              if (innerSub) {
                innerSub.unsubscribe();
                innerSub = null;
                subscribeForRepeat();
              } else {
                syncUnsub = true;
              }
            } else {
              observer.complete();
            }
          },
        });
        if (syncUnsub) {
          innerSub.unsubscribe();
          innerSub = null;
          subscribeForRepeat();
        }
      };
      subscribeForRepeat();
      return { unsubscribe: () => innerSub?.unsubscribe() };
    });
  };
};

/**
 * Repeats when notified via returned notifier on complete.
 */
export const ksRepeatWhen = <A>(
  notifier: (notifications: Stream<void>) => Stream<void>,
): PipeableOperator<A, A> => {
  return stream => {
    return stream.constructor(observer => {
      let innerSub: Unsubscribable | null = null;
      let notifierSub: Unsubscribable | null = null;
      let syncResub = false;
      let completions$: Subject<void> | null = null;
      let isNotifierComplete = false;
      let isMainComplete = false;

      const checkComplete = () => {
        if (isMainComplete && isNotifierComplete) {
          observer.complete();
          return true;
        }
        return false;
      };

      const getCompletionSubject = () => {
        if (completions$ === null) {
          completions$ = ksSubject();
          notifierSub?.unsubscribe();
          notifierSub = notifier(completions$).subscribe({
            next: () => {
              if (innerSub) {
                subscribeForRepeatWhen();
              } else {
                syncResub = true;
              }
            },
            complete: () => {
              isNotifierComplete = true;
              checkComplete();
            },
          });
        }
        return completions$;
      };

      const subscribeForRepeatWhen = () => {
        isMainComplete = false;
        innerSub?.unsubscribe();
        innerSub = stream.subscribe({
          next: observer.next,
          complete: () => {
            isMainComplete = true;
            if (!checkComplete()) {
              getCompletionSubject().next();
            }
          },
        });
        if (syncResub) {
          innerSub.unsubscribe();
          innerSub = null;
          syncResub = false;
          subscribeForRepeatWhen();
        }
      };

      subscribeForRepeatWhen();

      return {
        unsubscribe: () => {
          notifierSub?.unsubscribe();
          innerSub?.unsubscribe();
        },
      };
    });
  };
};

/**
 * Retry when notified via returned notifier.
 */
export const ksRetryWhen = <E, A>(
  notifier: (errors: Stream<E>) => Stream<Option<E>>,
): PipeableOperator<Either<E, A>, Either<E, A>> => {
  return stream => {
    return stream.constructor(observer => {
      const innerSub = _subscribableOnce<Either<E, A>>();
      const notifierSub = _subscribableOnce<Option<E>>();
      let errors$: Subject<E> | null = null;
      let isMainComplete = false;
      let isLockComplete = false;

      const subscribeForRetryWhen = () => {
        isMainComplete = false;
        isLockComplete = false;
        innerSub.restartWith(stream).subscribe({
          next: eitherValue => {
            if (isRight(eitherValue)) {
              isLockComplete = false;
              observer.next(eitherValue);
            } else {
              isLockComplete = true;
              if (errors$ === null) {
                errors$ = ksSubject();
                notifierSub.restartWith(notifier(errors$)).subscribe({
                  next: optionError => {
                    if (isNone(optionError)) {
                      subscribeForRetryWhen();
                    } else {
                      isLockComplete = false;
                      observer.next(left(optionError.value));
                      if (isMainComplete) {
                        observer.complete();
                      }
                    }
                  },
                });
              }
              errors$.next(eitherValue.left);
            }
          },
          complete: () => {
            isMainComplete = true;
            if (!isLockComplete) {
              observer.complete();
            }
          },
        });
      };

      subscribeForRetryWhen();

      return {
        unsubscribe: () => {
          notifierSub.unsubscribe();
          innerSub.unsubscribe();
        },
      };
    });
  };
};

/**
 * Also provide the last value from another observable.
 */
export const ksWithLatestFrom = <A, B>(
  other: Stream<B>,
): PipeableOperator<A, [A, B]> => {
  return stream => {
    return stream.constructor(observer => {
      let otherOptional: Option<B> = none;
      const otherSub = other.subscribe({
        next: value => (otherOptional = some(value)),
      });
      const mainSub = stream.subscribe({
        next: value => {
          if (isSome(otherOptional)) {
            observer.next([value, otherOptional.value]);
          }
        },
        complete: observer.complete,
      });
      return {
        unsubscribe: () => {
          otherSub.unsubscribe();
          mainSub.unsubscribe();
        },
      };
    });
  };
};

/**
 * Ignore for time based on provided observable, then emit most recent value.
 */
export const ksAudit = <A>(
  durationSelector: (value: A) => Stream<unknown>,
): PipeableOperator<A, A> => {
  return stream => {
    return stream.constructor(observer => {
      let lastValue: Option<A> = none;
      const durationSubscriber = _subscribableOnce<unknown>();
      let isComplete = false;

      const endDuration = () => {
        durationSubscriber.stop();
        if (isComplete) {
          observer.complete();
        } else if (isSome(lastValue)) {
          const value = lastValue;
          lastValue = none;
          observer.next(value.value);
        }
      };

      const mainSub = stream.subscribe({
        next: value => {
          lastValue = some(value);
          durationSubscriber
            .ifNull(() => durationSelector(value))
            .subscribe({
              next: endDuration,
              complete: durationSubscriber.unsubscribe,
            });
        },
        complete: () => {
          isComplete = true;
          if (durationSubscriber.isNull()) {
            observer.complete();
          }
        },
      });

      return {
        unsubscribe: () => {
          durationSubscriber.unsubscribe();
          mainSub.unsubscribe();
        },
      };
    });
  };
};
