import { Some, None } from './ts-option';
export var KsBehaviour;
(function (KsBehaviour) {
    KsBehaviour[KsBehaviour["COLD"] = 0] = "COLD";
    KsBehaviour[KsBehaviour["SHARE"] = 1] = "SHARE";
    KsBehaviour[KsBehaviour["SHARE_REPLAY"] = 2] = "SHARE_REPLAY";
})(KsBehaviour || (KsBehaviour = {}));
export const noop = () => { };
export const observerFromPartial = (o) => {
    return {
        next: o.next !== undefined ? o.next : noop,
        complete: o.complete !== undefined ? o.complete : noop,
    };
};
const createColdStream = (subscribeFn) => {
    const subscribe = (partialObserver) => {
        let isCompleted = false;
        const observer = observerFromPartial(partialObserver);
        return subscribeFn({
            next: value => {
                if (isCompleted) {
                    console.warn('Logic error: Ignore call next on completed stream.');
                }
                else {
                    observer.next(value);
                }
            },
            complete: () => {
                if (isCompleted) {
                    console.warn('Logic error: Ignore call complete on completed stream.');
                }
                else {
                    isCompleted = true;
                    observer.complete();
                }
            },
        });
    };
    const stream = {
        subscribe,
        pipe: transformFn => transformFn(stream),
        behaviour: KsBehaviour.COLD,
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
                next(value);
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
                complete();
            }
        }
    };
    const subscribe = (partialObserver) => {
        if (isCompleted) {
            return { unsubscribe: noop };
        }
        const observer = observerFromPartial(partialObserver);
        if (replay && lastValue._tag === 'Some') {
            observer.next(lastValue.some);
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
        behaviour: replay ? KsBehaviour.SHARE_REPLAY : KsBehaviour.SHARE,
    };
    return stream;
};
export const ksCreateStream = (behaviour, subscribeFn) => {
    switch (behaviour) {
        case KsBehaviour.COLD: {
            return createColdStream(subscribeFn);
        }
        case KsBehaviour.SHARE: {
            return createShareStream(subscribeFn, false);
        }
        case KsBehaviour.SHARE_REPLAY: {
            return createShareStream(subscribeFn, true);
        }
        default: {
            throw 'unknown behaviour';
        }
    }
};
/**
 * Combine transformers.
 */
export const ksPipe = (t1, t2) => {
    return (s) => s.pipe(t1).pipe(t2);
};
//# sourceMappingURL=core.js.map