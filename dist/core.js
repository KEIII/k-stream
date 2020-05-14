import { Some, None } from './ts-option';
export const noop = () => { };
/**
 * Create source on each subscription.
 */
export const ksCold = (subscribeFn) => {
    const subscribe = (observer) => {
        let isCompleted = false;
        return subscribeFn({
            next: value => {
                var _a;
                if (isCompleted) {
                    console.warn('Logic error: Ignore call next on completed stream.');
                }
                else {
                    (_a = observer.next) === null || _a === void 0 ? void 0 : _a.call(observer, value);
                }
            },
            complete: () => {
                var _a;
                if (isCompleted) {
                    console.warn('Logic error: Ignore call complete on completed stream.');
                }
                else {
                    isCompleted = true;
                    (_a = observer.complete) === null || _a === void 0 ? void 0 : _a.call(observer);
                }
            },
        });
    };
    const stream = {
        subscribe,
        pipe: transformFn => transformFn(stream),
        behaviour: ksCold,
    };
    return stream;
};
const createShareStream = (subscribeFn, replay) => {
    let isCompleted = false;
    let lastValue = None();
    let subscription = null;
    const observersMap = new Map();
    const onNext = (value) => {
        if (isCompleted) {
            console.warn('Logic error: Ignore call next on completed stream.');
        }
        else {
            if (replay) {
                lastValue = Some(value);
            }
            for (const { next } of observersMap.values()) {
                next === null || next === void 0 ? void 0 : next(value);
            }
        }
    };
    const onComplete = () => {
        if (isCompleted) {
            console.warn('Logic error: Ignore call complete on completed stream.');
        }
        else {
            isCompleted = true;
            for (const { complete } of observersMap.values()) {
                complete === null || complete === void 0 ? void 0 : complete();
            }
        }
    };
    const subscribe = (observer) => {
        var _a;
        if (isCompleted) {
            return { unsubscribe: noop };
        }
        if (replay && lastValue._tag === 'Some') {
            (_a = observer.next) === null || _a === void 0 ? void 0 : _a.call(observer, lastValue.some);
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
                next: onNext,
                complete: onComplete,
            });
        }
        return { unsubscribe };
    };
    const stream = {
        subscribe,
        pipe: transformFn => transformFn(stream),
        behaviour: replay ? ksShareReplay : ksShare,
        get lastValue() {
            return lastValue._tag === 'Some' ? lastValue.some : undefined;
        },
    };
    return stream;
};
/**
 * Share source among multiple subscribers.
 */
export const ksShare = (f) => {
    return createShareStream(f, false);
};
/**
 * Share source and replay last emissions on subscription.
 */
export const ksShareReplay = (f) => {
    return createShareStream(f, true);
};
export const ksCreateStream = (b, f) => b(f);
/**
 * Combine transformers.
 */
export const ksPipe = (t1, t2) => {
    return (s) => s.pipe(t1).pipe(t2);
};
//# sourceMappingURL=core.js.map