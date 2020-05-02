export const Ok = (ok) => {
    return Object.freeze({ _tag: 'Ok', ok });
};
export const Err = (err) => {
    return Object.freeze({ _tag: 'Err', err });
};
//# sourceMappingURL=ts-result.js.map