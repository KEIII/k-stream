"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var core_1 = require("./core");
var ts_option_1 = require("./ts-option");
exports.ksChangeBehaviour = function (newBehaviour) {
    return function (stream) {
        return core_1.ksCreateStream(newBehaviour, stream.subscribe);
    };
};
/**
 * Apply projection with each value from source.
 */
exports.ksMap = function (project) {
    return function (stream) {
        return core_1.ksCreateStream(stream.behaviour, function (_a) {
            var next = _a.next, complete = _a.complete;
            return stream.subscribe({
                next: function (value) { return next(project(value)); },
                complete: complete,
            });
        });
    };
};
/**
 * Map emissions to constant value.
 */
exports.ksMapTo = function (value) {
    return function (stream) {
        return core_1.ksCreateStream(stream.behaviour, function (_a) {
            var next = _a.next, complete = _a.complete;
            return stream.subscribe({
                next: function () { return next(value); },
                complete: complete,
            });
        });
    };
};
/**
 * Transparently perform actions or side-effects, such as logging.
 */
exports.ksTap = function (tapPartialObserver) {
    return function (stream) {
        return core_1.ksCreateStream(stream.behaviour, function (_a) {
            var next = _a.next, complete = _a.complete;
            var tapObserver = core_1.observerFromPartial(tapPartialObserver);
            return stream.subscribe({
                next: function (value) {
                    tapObserver.next(value);
                    next(value);
                },
                complete: function () {
                    tapObserver.complete();
                    complete();
                },
            });
        });
    };
};
/**
 * Emit values that pass the provided condition.
 */
exports.ksFilter = function (select) {
    return function (stream) {
        return core_1.ksCreateStream(stream.behaviour, function (_a) {
            var next = _a.next, complete = _a.complete;
            return stream.subscribe({
                next: function (value) {
                    var o = select(value);
                    if (o._tag === "Some") {
                        next(o.some);
                    }
                },
                complete: complete,
            });
        });
    };
};
/**
 * Map to observable, complete previous inner observable, emit values.
 */
exports.ksSwitch = function (project) {
    return function (stream) {
        return core_1.ksCreateStream(stream.behaviour, function (_a) {
            var next = _a.next, complete = _a.complete;
            var projectSubscription = null;
            var projectCompleted = false;
            var mainCompleted = false;
            var tryComplete = function () {
                if (mainCompleted && projectCompleted) {
                    complete();
                }
            };
            var onProjectComplete = function () {
                projectCompleted = true;
                tryComplete();
            };
            var onMainComplete = function () {
                mainCompleted = true;
                tryComplete();
            };
            var tryUnsubscribeProject = function () {
                if (projectSubscription !== null) {
                    projectSubscription.unsubscribe();
                }
            };
            var onMainNext = function (value) {
                tryUnsubscribeProject();
                projectCompleted = false;
                projectSubscription = project(value).subscribe({
                    next: next,
                    complete: onProjectComplete,
                });
            };
            var mainSubscription = stream.subscribe({
                next: onMainNext,
                complete: onMainComplete,
            });
            return {
                unsubscribe: function () {
                    tryUnsubscribeProject();
                    mainSubscription.unsubscribe();
                },
            };
        });
    };
};
/**
 * Emit values until provided observable emits or completes.
 */
exports.ksTakeUntil = function (notifier) {
    return function (stream) {
        var newStream = core_1.ksCreateStream(stream.behaviour, function (_a) {
            var next = _a.next, complete = _a.complete;
            var notified = false;
            var isCompleted = false;
            var mainSubscription = stream.subscribe({
                next: next,
                complete: function () {
                    isCompleted = true;
                    complete();
                },
            });
            if (isCompleted) {
                return mainSubscription;
            }
            else {
                var terminate = function () {
                    if (!notified) {
                        notified = true;
                        complete();
                        mainSubscription.unsubscribe();
                        setTimeout(function () { return notifierSubscription_1.unsubscribe(); });
                    }
                };
                var notifierSubscription_1 = notifier.subscribe({
                    next: terminate,
                    complete: terminate,
                });
                return {
                    unsubscribe: function () {
                        notifierSubscription_1.unsubscribe();
                        mainSubscription.unsubscribe();
                    },
                };
            }
        });
        return __assign(__assign({}, newStream), { pipe: function () {
                throw "Disallows the application of operators after takeUntil. Operators placed after takeUntil can effect subscription leaks.";
            } });
    };
};
/**
 * Emit provided number of values before completing.
 */
exports.ksTake = function (count) {
    return function (stream) {
        return core_1.ksCreateStream(stream.behaviour, function (_a) {
            var next = _a.next, complete = _a.complete;
            var counter = 0;
            var tryNext = function (value) {
                next(value);
                if (++counter >= count) {
                    complete();
                    setTimeout(function () { return subscription.unsubscribe(); });
                }
            };
            var subscription = stream.subscribe({ next: tryNext, complete: complete });
            return subscription;
        });
    };
};
/**
 * Emit values until provided expression is false.
 */
exports.ksTakeWhile = function (predicate) {
    return function (stream) {
        return core_1.ksCreateStream(stream.behaviour, function (_a) {
            var next = _a.next, complete = _a.complete;
            return stream.subscribe({
                next: function (value) {
                    if (predicate(value)) {
                        next(value);
                    }
                    else {
                        complete();
                    }
                },
                complete: complete,
            });
        });
    };
};
/**
 * Delay emitted values by given time.
 */
exports.ksDelay = function (delay) {
    return function (stream) {
        return core_1.ksCreateStream(stream.behaviour, function (_a) {
            var next = _a.next, complete = _a.complete;
            var timers = new Map();
            var clearTimers = function () {
                var e_1, _a;
                try {
                    for (var _b = __values(timers.keys()), _c = _b.next(); !_c.done; _c = _b.next()) {
                        var t = _c.value;
                        clearTimeout(t);
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
                timers.clear();
            };
            var subscription = stream.subscribe({
                next: function (value) {
                    var t = setTimeout(function () {
                        next(value);
                        timers.delete(t);
                    }, delay);
                    timers.set(t);
                },
                complete: function () {
                    var t = setTimeout(function () {
                        complete();
                        timers.delete(t);
                    }, delay);
                    timers.set(t);
                },
            });
            return {
                unsubscribe: function () {
                    clearTimers();
                    subscription.unsubscribe();
                },
            };
        });
    };
};
/**
 * Discard emitted values that take less than the specified time between output.
 */
exports.ksDebounce = function (dueTime) {
    return function (stream) {
        return core_1.ksCreateStream(stream.behaviour, function (_a) {
            var next = _a.next, complete = _a.complete;
            var timeoutId;
            var lastValue = ts_option_1.None();
            var tryNext = function () {
                if (lastValue._tag === "Some") {
                    next(lastValue.some);
                    lastValue = ts_option_1.None();
                }
            };
            var debounceNext = function (value) {
                lastValue = ts_option_1.Some(value);
                clearTimeout(timeoutId);
                timeoutId = setTimeout(tryNext, dueTime);
            };
            var debounceComplete = function () {
                clearTimeout(timeoutId);
                tryNext();
                complete();
            };
            var subscription = stream.subscribe({
                next: debounceNext,
                complete: debounceComplete,
            });
            return {
                unsubscribe: function () {
                    tryNext();
                    clearTimeout(timeoutId);
                    subscription.unsubscribe();
                },
            };
        });
    };
};
/**
 * Emit first value then ignore for specified duration.
 */
exports.ksThrottle = function (duration) {
    return function (stream) {
        return core_1.ksCreateStream(stream.behaviour, function (_a) {
            var next = _a.next, complete = _a.complete;
            var executedTime = Number.MIN_SAFE_INTEGER;
            var lastValue = ts_option_1.None();
            var tryNext = function () {
                if (lastValue._tag === "Some") {
                    next(lastValue.some);
                    lastValue = ts_option_1.None();
                }
            };
            var throttleNext = function (value) {
                lastValue = ts_option_1.Some(value);
                var now = Date.now();
                var diff = now - executedTime;
                if (diff > duration) {
                    executedTime = now;
                    tryNext();
                }
            };
            var throttleComplete = function () {
                tryNext();
                complete();
            };
            return stream.subscribe({
                next: throttleNext,
                complete: throttleComplete,
            });
        });
    };
};
/**
 * Emit the previous and current values as an array.
 */
exports.ksPairwise = function () {
    return function (o) {
        return core_1.ksCreateStream(o.behaviour, function (_a) {
            var next = _a.next, complete = _a.complete;
            var prevValue = ts_option_1.None();
            return o.subscribe({
                next: function (value) {
                    if (prevValue._tag === "Some") {
                        next([prevValue.some, value]);
                    }
                    prevValue = ts_option_1.Some(value);
                },
                complete: complete,
            });
        });
    };
};
/**
 * Reduce over time.
 */
exports.ksScan = function (accumulator, seed) {
    return function (o) {
        return core_1.ksCreateStream(o.behaviour, function (_a) {
            var next = _a.next, complete = _a.complete;
            var acc = seed;
            return o.subscribe({
                next: function (value) {
                    acc = accumulator(acc, value);
                    next(acc);
                },
                complete: complete,
            });
        });
    };
};
//# sourceMappingURL=transformers.js.map