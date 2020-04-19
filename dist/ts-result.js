"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Ok = function (ok) {
    return Object.freeze({ _tag: "Ok", ok: ok });
};
exports.Err = function (err) {
    return Object.freeze({ _tag: "Err", err: err });
};
//# sourceMappingURL=ts-result.js.map