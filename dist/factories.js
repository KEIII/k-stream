import { ksCold, ksCreateStream, noop, } from './core';
import { ksMap } from './transformers';
import { None, Some } from './ts-option';
import { Err, Ok } from './ts-result';
/**
 * Observable that immediately completes.
 */
export const ksEmpty = () => {
    return ksCreateStream(ksCold, ({ complete }) => {
        complete();
        return { unsubscribe: noop };
    });
};
/**
 * Emit variable amount of values in a sequence and then emits a complete notification.
 */
export const ksOf = (value, behaviour = ksCold) => {
    return ksCreateStream(behaviour, ({ next, complete }) => {
        next(value);
        complete();
        return { unsubscribe: noop };
    });
};
/**
 * Subscribe to observables in order as previous completes.
 */
export const ksConcat = (stream1, stream2) => {
    return ksCreateStream(stream1.behaviour, ({ next, complete }) => {
        let subscription2 = null;
        const subscription1 = stream1.subscribe({
            next,
            complete: () => {
                subscription2 = stream2.subscribe({ next, complete });
            },
        });
        const tryUnsubscribeSecond = () => {
            if (subscription2 !== null) {
                subscription2.unsubscribe();
            }
        };
        return {
            unsubscribe: () => {
                subscription1.unsubscribe();
                tryUnsubscribeSecond();
            },
        };
    });
};
/**
 * Turn multiple observables into a single observable.
 */
export const ksMerge = (stream1, stream2) => {
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
/**
 * After all observables emit, emit values as an array.
 */
export const ksZip = (stream1, stream2) => {
    return ksCreateStream(stream1.behaviour, ({ next, complete }) => {
        let completed1 = false;
        let completed2 = false;
        const queue1 = [];
        const queue2 = [];
        const tryNext = () => {
            if (queue1.length > 0 && queue2.length > 0) {
                next([queue1.shift(), queue2.shift()]);
            }
        };
        const tryComplete = () => {
            if ((completed1 && queue1.length === 0) ||
                (completed2 && queue2.length === 0)) {
                complete();
            }
        };
        const subscription1 = stream1.subscribe({
            next: value => {
                queue1.push(value);
                tryNext();
            },
            complete: () => {
                completed1 = true;
                tryComplete();
            },
        });
        const subscription2 = stream2.subscribe({
            next: value => {
                queue2.push(value);
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
export const ksTimeout = (ms, behaviour = ksCold) => {
    return ksCreateStream(behaviour, ({ next, complete }) => {
        const handler = () => {
            next(0);
            complete();
        };
        const timeoutId = setTimeout(handler, ms);
        return { unsubscribe: () => clearTimeout(timeoutId) };
    });
};
export const ksInterval = (ms, behaviour = ksCold) => {
    return ksCreateStream(behaviour, ({ next }) => {
        let count = 0;
        const handler = () => next(count++);
        const intervalId = setInterval(handler, ms);
        return { unsubscribe: () => clearInterval(intervalId) };
    });
};
export const ksPeriodic = (ms, behaviour = ksCold) => {
    return ksConcat(ksOf(0, behaviour), ksInterval(ms, behaviour).pipe(ksMap(n => n + 1)));
};
/**
 * When any observable emits a value, emit the last emitted value from each.
 */
export const ksCombineLatest = (stream1, stream2) => {
    return ksCreateStream(stream1.behaviour, ({ next, complete }) => {
        let completed1 = false;
        let completed2 = false;
        let value1 = None();
        let value2 = None();
        const tryNext = () => {
            if (value1._tag === 'Some' && value2._tag === 'Some') {
                return next([value1.some, value2.some]);
            }
        };
        const tryComplete = () => {
            if (completed1 && completed2) {
                complete();
            }
        };
        const subscription1 = stream1.subscribe({
            next: value => {
                value1 = Some(value);
                tryNext();
            },
            complete: () => {
                completed1 = true;
                tryComplete();
            },
        });
        const subscription2 = stream2.subscribe({
            next: value => {
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
export const ksForkJoin = (stream1, stream2) => {
    return ksCreateStream(stream1.behaviour, ({ next, complete }) => {
        let completed1 = false;
        let completed2 = false;
        let value1 = None();
        let value2 = None();
        const tryComplete = () => {
            if (completed1 &&
                completed2 &&
                value1._tag === 'Some' &&
                value2._tag === 'Some') {
                next([value1.some, value2.some]);
                complete();
            }
        };
        const subscription1 = stream1.subscribe({
            next: value => (value1 = Some(value)),
            complete: () => {
                completed1 = true;
                tryComplete();
            },
        });
        const subscription2 = stream2.subscribe({
            next: value => (value2 = Some(value)),
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
export const ksFromPromise = (promise, behaviour = ksCold) => {
    return ksCreateStream(behaviour, ({ next, complete }) => {
        let on = true;
        promise
            .then(value => {
            if (on) {
                next(Ok(value));
                complete();
            }
        })
            .catch((err) => {
            if (on) {
                next(Err(err));
                complete();
            }
        });
        return { unsubscribe: () => (on = false) };
    });
};
export const ksToPromise = (o) => {
    return new Promise(resolve => {
        let result = None();
        const s = o.subscribe({
            next: value => (result = Some(value)),
            complete: () => {
                resolve(result);
                setTimeout(() => s.unsubscribe());
            },
        });
    });
};
//# sourceMappingURL=factories.js.map