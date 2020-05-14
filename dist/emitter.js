import { ksCreateStream, noop, ksShare, } from './core';
export const ksEmitter = (behaviour = ksShare) => {
    let isCompleted = false;
    let emitterObserver = null;
    const next = (value) => {
        if (!isCompleted) {
            emitterObserver === null || emitterObserver === void 0 ? void 0 : emitterObserver.next(value);
        }
    };
    const complete = () => {
        isCompleted = true;
        emitterObserver === null || emitterObserver === void 0 ? void 0 : emitterObserver.complete();
    };
    const stream = ksCreateStream(behaviour, o => {
        emitterObserver = o;
        return { unsubscribe: noop };
    });
    return {
        subscribe: observer => {
            var _a;
            if (isCompleted) {
                (_a = observer.complete) === null || _a === void 0 ? void 0 : _a.call(observer);
                return { unsubscribe: noop };
            }
            else {
                return stream.subscribe(observer);
            }
        },
        pipe: stream.pipe,
        behaviour: stream.behaviour,
        next,
        complete,
    };
};
//# sourceMappingURL=emitter.js.map