"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var core_1 = require("./core");
var transformers_1 = require("./transformers");
var ts_option_1 = require("./ts-option");
var ts_result_1 = require("./ts-result");
/**
 * Observable that immediately completes.
 */
exports.ksEmpty = function () {
    return core_1.ksCreateStream(0 /* COLD */, function (_a) {
        var complete = _a.complete;
        complete();
        return { unsubscribe: core_1.noop };
    });
};
/**
 * Emit variable amount of values in a sequence and then emits a complete notification.
 */
exports.ksOf = function (value, behaviour) {
    return core_1.ksCreateStream(behaviour, function (_a) {
        var next = _a.next, complete = _a.complete;
        next(value);
        complete();
        return { unsubscribe: core_1.noop };
    });
};
/**
 * Subscribe to observables in order as previous completes.
 */
exports.ksConcat = function (stream1, stream2) {
    return core_1.ksCreateStream(stream1.behaviour, function (_a) {
        var next = _a.next, complete = _a.complete;
        var subscription1 = null;
        var subscription2 = stream1.subscribe({
            next: next,
            complete: function () {
                subscription1 = stream2.subscribe({ next: next, complete: complete });
            },
        });
        var tryUnsubscribeFirst = function () {
            if (subscription1 !== null) {
                subscription1.unsubscribe();
            }
        };
        return {
            unsubscribe: function () {
                subscription2.unsubscribe();
                tryUnsubscribeFirst();
            },
        };
    });
};
/**
 * Turn multiple observables into a single observable.
 */
exports.ksMerge = function (stream1, stream2) {
    return core_1.ksCreateStream(stream1.behaviour, function (_a) {
        var next = _a.next, complete = _a.complete;
        var completed1 = false;
        var completed2 = false;
        var tryComplete = function () {
            if (completed1 && completed2) {
                complete();
            }
        };
        var subscription1 = stream1.subscribe({
            next: next,
            complete: function () {
                completed1 = true;
                tryComplete();
            },
        });
        var subscription2 = stream2.subscribe({
            next: next,
            complete: function () {
                completed2 = true;
                tryComplete();
            },
        });
        return {
            unsubscribe: function () {
                subscription1.unsubscribe();
                subscription2.unsubscribe();
            },
        };
    });
};
/**
 * After all observables emit, emit values as an array.
 */
exports.ksZip = function (stream1, stream2) {
    return core_1.ksCreateStream(stream1.behaviour, function (_a) {
        var next = _a.next, complete = _a.complete;
        var completed1 = false;
        var completed2 = false;
        var queue1 = [];
        var queue2 = [];
        var tryNext = function () {
            if (queue1.length > 0 && queue2.length > 0) {
                next([queue1.shift(), queue2.shift()]);
            }
        };
        var tryComplete = function () {
            if ((completed1 && queue1.length === 0) ||
                (completed2 && queue2.length === 0)) {
                complete();
            }
        };
        var subscription1 = stream1.subscribe({
            next: function (value) {
                queue1.push(value);
                tryNext();
            },
            complete: function () {
                completed1 = true;
                tryComplete();
            },
        });
        var subscription2 = stream2.subscribe({
            next: function (value) {
                queue2.push(value);
                tryNext();
            },
            complete: function () {
                completed2 = true;
                tryComplete();
            },
        });
        return {
            unsubscribe: function () {
                subscription1.unsubscribe();
                subscription2.unsubscribe();
            },
        };
    });
};
exports.ksTimeout = function (ms, behaviour) {
    return core_1.ksCreateStream(behaviour, function (_a) {
        var next = _a.next, complete = _a.complete;
        var handler = function () {
            next(0);
            complete();
        };
        var timeoutId = setTimeout(handler, ms);
        return { unsubscribe: function () { return clearInterval(timeoutId); } };
    });
};
exports.ksInterval = function (ms, behaviour) {
    return core_1.ksCreateStream(behaviour, function (_a) {
        var next = _a.next;
        var count = 0;
        var handler = function () { return next(count++); };
        var intervalId = setInterval(handler, ms);
        return { unsubscribe: function () { return clearInterval(intervalId); } };
    });
};
exports.ksPeriodic = function (ms, behaviour) {
    return exports.ksConcat(exports.ksOf(0, behaviour), exports.ksInterval(ms, behaviour).pipe(transformers_1.ksMap(function (n) { return n + 1; })));
};
/**
 * When any observable emits a value, emit the last emitted value from each.
 */
exports.ksCombineLatest = function (stream1, stream2) {
    return core_1.ksCreateStream(stream1.behaviour, function (_a) {
        var next = _a.next, complete = _a.complete;
        var completed1 = false;
        var completed2 = false;
        var value1 = ts_option_1.None();
        var value2 = ts_option_1.None();
        var tryNext = function () {
            if (value1._tag === "Some" && value2._tag === "Some") {
                return next([value1.some, value2.some]);
            }
        };
        var tryComplete = function () {
            if (completed1 && completed2) {
                complete();
            }
        };
        var subscription1 = stream1.subscribe({
            next: function (value) {
                value1 = ts_option_1.Some(value);
                tryNext();
            },
            complete: function () {
                completed1 = true;
                tryComplete();
            },
        });
        var subscription2 = stream2.subscribe({
            next: function (value) {
                value2 = ts_option_1.Some(value);
                tryNext();
            },
            complete: function () {
                completed2 = true;
                tryComplete();
            },
        });
        return {
            unsubscribe: function () {
                subscription1.unsubscribe();
                subscription2.unsubscribe();
            },
        };
    });
};
/**
 * When all observables complete, emit the last emitted value from each.
 */
exports.ksForkJoin = function (stream1, stream2) {
    return core_1.ksCreateStream(stream1.behaviour, function (_a) {
        var next = _a.next, complete = _a.complete;
        var completed1 = false;
        var completed2 = false;
        var value1 = ts_option_1.None();
        var value2 = ts_option_1.None();
        var tryComplete = function () {
            if (completed1 &&
                completed2 &&
                value1._tag === "Some" &&
                value2._tag === "Some") {
                next([value1.some, value2.some]);
                complete();
            }
        };
        var subscription1 = stream1.subscribe({
            next: function (value) { return (value1 = ts_option_1.Some(value)); },
            complete: function () {
                completed1 = true;
                tryComplete();
            },
        });
        var subscription2 = stream2.subscribe({
            next: function (value) { return (value2 = ts_option_1.Some(value)); },
            complete: function () {
                completed2 = true;
                tryComplete();
            },
        });
        return {
            unsubscribe: function () {
                subscription1.unsubscribe();
                subscription2.unsubscribe();
            },
        };
    });
};
exports.ksFromPromise = function (promise, behaviour) {
    return core_1.ksCreateStream(behaviour, function (_a) {
        var next = _a.next, complete = _a.complete;
        var on = true;
        promise
            .then(function (value) {
            if (on) {
                next(ts_result_1.Ok(value));
                complete();
            }
        })
            .catch(function (err) {
            if (on) {
                next(ts_result_1.Err(err));
                complete();
            }
        });
        return { unsubscribe: function () { return (on = false); } };
    });
};
exports.ksToPromise = function (o) {
    return new Promise(function (resolve) {
        var result = ts_option_1.None();
        var s = o.subscribe({
            next: function (value) { return (result = ts_option_1.Some(value)); },
            complete: function () {
                resolve(result);
                setTimeout(function () { return s.unsubscribe(); });
            },
        });
    });
};
//# sourceMappingURL=factories.js.map