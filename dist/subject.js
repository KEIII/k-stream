import { KsBehaviour, ksCreateStream, noop, observerFromPartial, } from './core';
export const ksSubject = (initValue, behaviour = KsBehaviour.SHARE_REPLAY) => {
    const state = { isCompleted: false, current: initValue };
    let subjectObserver = null;
    const stream = ksCreateStream(behaviour, observer => {
        subjectObserver = observer;
        subjectObserver.next(state.current);
        return { unsubscribe: () => (subjectObserver = null) };
    });
    return {
        subscribe: observer => {
            const { next, complete } = observerFromPartial(observer);
            if (state.isCompleted) {
                next(state.current);
                complete();
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