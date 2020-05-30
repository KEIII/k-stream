import { ksCreateStream, noop, ksShare, } from './core';
export const ksSubject = (behaviour = ksShare) => {
    let isCompleted = false;
    let subjectObserver = null;
    const next = (value) => {
        if (!isCompleted) {
            subjectObserver === null || subjectObserver === void 0 ? void 0 : subjectObserver.next(value);
        }
    };
    const complete = () => {
        isCompleted = true;
        subjectObserver === null || subjectObserver === void 0 ? void 0 : subjectObserver.complete();
    };
    const stream = ksCreateStream(behaviour, o => {
        subjectObserver = o;
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
//# sourceMappingURL=subject.js.map