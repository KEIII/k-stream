import { ksCreateStream, observerFromPartial, } from "./core";
import { Some, None } from "./ts-option";
export const ksChangeBehaviour = (newBehaviour) => {
    return (stream) => {
        return ksCreateStream(newBehaviour, stream.subscribe);
    };
};
/**
 * Apply projection with each value from source.
 */
export const ksMap = (project) => {
    return (stream) => {
        return ksCreateStream(stream.behaviour, ({ next, complete }) => {
            return stream.subscribe({
                next: (value) => next(project(value)),
                complete,
            });
        });
    };
};
/**
 * Map emissions to constant value.
 */
export const ksMapTo = (value) => {
    return (stream) => {
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
export const ksTap = (tapPartialObserver) => {
    return (stream) => {
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
export const ksFilter = (select) => {
    return (stream) => {
        return ksCreateStream(stream.behaviour, ({ next, complete }) => {
            return stream.subscribe({
                next: (value) => {
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
export const ksSwitch = (project) => {
    return (stream) => {
        return ksCreateStream(stream.behaviour, ({ next, complete }) => {
            let projectSubscription = null;
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
            const onMainNext = (value) => {
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
export const ksTakeUntil = (notifier) => {
    return (stream) => {
        const newStream = ksCreateStream(stream.behaviour, ({ next, complete }) => {
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
            }
            else {
                const terminate = () => {
                    if (!notified) {
                        notified = true;
                        complete();
                        mainSubscription.unsubscribe();
                        setTimeout(() => notifierSubscription.unsubscribe());
                    }
                };
                const notifierSubscription = notifier.subscribe({
                    next: terminate,
                    complete: terminate,
                });
                return {
                    unsubscribe: () => {
                        notifierSubscription.unsubscribe();
                        mainSubscription.unsubscribe();
                    },
                };
            }
        });
        return Object.assign(Object.assign({}, newStream), { pipe: () => {
                throw "Disallows the application of operators after takeUntil. Operators placed after takeUntil can effect subscription leaks.";
            } });
    };
};
/**
 * Emit provided number of values before completing.
 */
export const ksTake = (count) => {
    return (stream) => {
        return ksCreateStream(stream.behaviour, ({ next, complete }) => {
            let counter = 0;
            const tryNext = (value) => {
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
 * Emit values until provided expression is false.
 */
export const ksTakeWhile = (predicate) => {
    return (stream) => {
        return ksCreateStream(stream.behaviour, ({ next, complete }) => {
            return stream.subscribe({
                next: (value) => {
                    if (predicate(value)) {
                        next(value);
                    }
                    else {
                        complete();
                    }
                },
                complete,
            });
        });
    };
};
/**
 * Delay emitted values by given time.
 */
export const ksDelay = (delay) => {
    return (stream) => {
        return ksCreateStream(stream.behaviour, ({ next, complete }) => {
            const timers = new Map();
            const clearTimers = () => {
                for (const t of timers.keys()) {
                    clearTimeout(t);
                }
                timers.clear();
            };
            const subscription = stream.subscribe({
                next: (value) => {
                    const t = setTimeout(() => {
                        next(value);
                        timers.delete(t);
                    }, delay);
                    timers.set(t);
                },
                complete: () => {
                    const t = setTimeout(() => {
                        complete();
                        timers.delete(t);
                    }, delay);
                    timers.set(t);
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
export const ksDebounce = (dueTime) => {
    return (stream) => {
        return ksCreateStream(stream.behaviour, ({ next, complete }) => {
            let timeoutId;
            let lastValue = None();
            const tryNext = () => {
                if (lastValue._tag === "Some") {
                    next(lastValue.some);
                    lastValue = None();
                }
            };
            const debounceNext = (value) => {
                lastValue = Some(value);
                clearTimeout(timeoutId);
                timeoutId = setTimeout(tryNext, dueTime);
            };
            const debounceComplete = () => {
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
export const ksThrottle = (duration) => {
    return (stream) => {
        return ksCreateStream(stream.behaviour, ({ next, complete }) => {
            let executedTime = Number.MIN_SAFE_INTEGER;
            let lastValue = None();
            const tryNext = () => {
                if (lastValue._tag === "Some") {
                    next(lastValue.some);
                    lastValue = None();
                }
            };
            const throttleNext = (value) => {
                lastValue = Some(value);
                const now = Date.now();
                const diff = now - executedTime;
                if (diff > duration) {
                    executedTime = now;
                    tryNext();
                }
            };
            const throttleComplete = () => {
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
    return (o) => {
        return ksCreateStream(o.behaviour, ({ next, complete }) => {
            let prevValue = None();
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
/**
 * Reduce over time.
 */
export const ksScan = (accumulator, seed) => {
    return (o) => {
        return ksCreateStream(o.behaviour, ({ next, complete }) => {
            let acc = seed;
            return o.subscribe({
                next: (value) => {
                    acc = accumulator(acc, value);
                    next(acc);
                },
                complete,
            });
        });
    };
};
//# sourceMappingURL=transformers.js.map