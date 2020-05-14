import { ksCreateStream, ksShareReplay, noop, } from './core';
export const ksSubject = (initValue, behaviour = ksShareReplay) => {
    const state = { isCompleted: false, current: initValue };
    let subjectObserver = null;
    const stream = ksCreateStream(behaviour, observer => {
        subjectObserver = observer;
        subjectObserver.next(state.current);
        return { unsubscribe: () => (subjectObserver = null) };
    });
    return {
        subscribe: observer => {
            var _a, _b;
            if (state.isCompleted) {
                (_a = observer.next) === null || _a === void 0 ? void 0 : _a.call(observer, state.current);
                (_b = observer.complete) === null || _b === void 0 ? void 0 : _b.call(observer);
                return { unsubscribe: noop };
            }
            else {
                return stream.subscribe(observer);
            }
        },
        pipe: stream.pipe,
        behaviour: stream.behaviour,
        complete: () => {
            state.isCompleted = true;
            if (subjectObserver !== null) {
                subjectObserver.complete();
            }
        },
        set value(value) {
            if (state.isCompleted) {
                console.warn('Logic error: Ignore call next on completed stream.');
            }
            else {
                state.current = value;
                if (subjectObserver !== null) {
                    subjectObserver.next(value);
                }
            }
        },
        get value() {
            return state.current;
        },
    };
};
//# sourceMappingURL=subject.js.map