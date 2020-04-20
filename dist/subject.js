"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var core_1 = require("./core");
exports.ksSubject = function (initValue) {
    var state = { isCompleted: false, current: initValue };
    var observer = null;
    var next = function (value) {
        if (!state.isCompleted) {
            state.current = value;
            if (observer !== null) {
                observer.next(value);
            }
        }
    };
    var complete = function () {
        state.isCompleted = true;
        if (observer !== null) {
            observer.complete();
        }
    };
    var stream = core_1.ksCreateStream(core_1.KsBehaviour.PUBLISH_REPLAY, function (o) {
        observer = o;
        observer.next(initValue);
        return { unsubscribe: core_1.noop };
    });
    return {
        subscribe: function (o) {
            if (state.isCompleted) {
                if (o.next !== undefined) {
                    o.next(state.current);
                }
                if (o.complete !== undefined) {
                    o.complete();
                }
                return { unsubscribe: core_1.noop };
            }
            else {
                return stream.subscribe(o);
            }
        },
        pipe: stream.pipe,
        behaviour: stream.behaviour,
        complete: complete,
        set value(value) {
            next(value);
        },
        get value() {
            return state.current;
        },
    };
};
//# sourceMappingURL=subject.js.map