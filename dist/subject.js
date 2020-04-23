import { KsBehaviour, ksCreateStream, noop, observerFromPartial, } from "./core";
export const ksSubject = (initValue) => {
    const state = { isCompleted: false, current: initValue };
    let observer;
    const next = (value) => {
        if (!state.isCompleted) {
            state.current = value;
            observer.next(value);
        }
    };
    const complete = () => {
        state.isCompleted = true;
        observer.complete();
    };
    const stream = ksCreateStream(KsBehaviour.PUBLISH_REPLAY, (o) => {
        observer = o;
        observer.next(initValue);
        return { unsubscribe: noop };
    });
    return {
        subscribe: (o) => {
            if (state.isCompleted) {
                const { next, complete } = observerFromPartial(o);
                next(state.current);
                complete();
                return { unsubscribe: noop };
            }
            else {
                return stream.subscribe(o);
            }
        },
        pipe: stream.pipe,
        behaviour: stream.behaviour,
        complete,
        set value(value) {
            next(value);
        },
        get value() {
            return state.current;
        },
    };
};
//# sourceMappingURL=subject.js.map