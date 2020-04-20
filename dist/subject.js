"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var core_1 = require("./core");
exports.ksSubject = function (initValue) {
    var behaviour = core_1.KsBehaviour.SHARE_REPLAY;
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
    var _a = core_1.ksCreateStream(behaviour, function (o) {
        observer = o;
        return { unsubscribe: function () { return (observer = null); } };
    }), subscribe = _a.subscribe, pipe = _a.pipe;
    return {
        subscribe: function (o) {
            if (o.next !== undefined) {
                o.next(state.current);
            }
            if (state.isCompleted && o.complete !== undefined) {
                o.complete();
            }
            return subscribe(o);
        },
        pipe: pipe,
        behaviour: behaviour,
        complete: complete,
        get isCompleted() {
            return state.isCompleted;
        },
        set value(value) {
            next(value);
        },
        get value() {
            return state.current;
        },
    };
};
//# sourceMappingURL=subject.js.map