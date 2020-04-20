"use strict";
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts_option_1 = require("./ts-option");
var KsBehaviour;
(function (KsBehaviour) {
    KsBehaviour[KsBehaviour["COLD"] = 0] = "COLD";
    KsBehaviour[KsBehaviour["SHARE"] = 1] = "SHARE";
    KsBehaviour[KsBehaviour["SHARE_REPLAY"] = 2] = "SHARE_REPLAY";
})(KsBehaviour = exports.KsBehaviour || (exports.KsBehaviour = {}));
exports.noop = function () { };
exports.observerFromPartial = function (o) {
    return {
        next: o.next !== undefined ? o.next : exports.noop,
        complete: o.complete !== undefined ? o.complete : exports.noop,
    };
};
var createShareStream = function (subscribeFn, replay) {
    var isCompleted = false;
    var lastValue = ts_option_1.None();
    var subscription = null;
    var observersMap = new Map();
    var shareNext = function (value) {
        var e_1, _a;
        if (isCompleted) {
            console.warn("Logic error: Ignore call next on completed stream.");
        }
        else {
            if (replay) {
                lastValue = ts_option_1.Some(value);
            }
            try {
                for (var _b = __values(observersMap.values()), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var next = _c.value.next;
                    next(value);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
    };
    var shareComplete = function () {
        var e_2, _a;
        if (isCompleted) {
            console.warn("Logic error: Ignore call complete on completed stream.");
        }
        else {
            isCompleted = true;
            try {
                for (var _b = __values(observersMap.values()), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var complete = _c.value.complete;
                    complete();
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
    };
    var subscribe = function (partialObserver) {
        if (isCompleted) {
            return { unsubscribe: exports.noop };
        }
        var observer = exports.observerFromPartial(partialObserver);
        if (replay && lastValue._tag === "Some") {
            observer.next(lastValue.some);
        }
        var subscribeId = Object.freeze({});
        var unsubscribe = function () {
            observersMap.delete(subscribeId);
            if (observersMap.size === 0) {
                if (replay) {
                    lastValue = ts_option_1.None();
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
                next: shareNext,
                complete: shareComplete,
            });
        }
        return { unsubscribe: unsubscribe };
    };
    var stream = {
        subscribe: subscribe,
        pipe: function (transformFn) { return transformFn(stream); },
        behaviour: replay ? KsBehaviour.SHARE_REPLAY : KsBehaviour.SHARE,
    };
    return stream;
};
var createColdStream = function (subscribeFn) {
    var subscribe = function (partialObserver) {
        var isCompleted = false;
        var observer = exports.observerFromPartial(partialObserver);
        return subscribeFn({
            next: function (value) {
                if (isCompleted) {
                    console.warn("Logic error: Ignore call next on completed stream.");
                }
                else {
                    observer.next(value);
                }
            },
            complete: function () {
                if (isCompleted) {
                    console.warn("Logic error: Ignore call complete on completed stream.");
                }
                else {
                    isCompleted = true;
                    observer.complete();
                }
            },
        });
    };
    var stream = {
        subscribe: subscribe,
        pipe: function (transformFn) { return transformFn(stream); },
        behaviour: KsBehaviour.COLD,
    };
    return stream;
};
exports.ksCreateStream = function (behaviour, subscribeFn) {
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
    }
};
/**
 * Combine transformers.
 */
exports.ksPipe = function (t1, t2) {
    return function (s) { return s.pipe(t1).pipe(t2); };
};
//# sourceMappingURL=core.js.map