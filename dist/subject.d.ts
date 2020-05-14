import { CompleteFn, Stream } from './core';
export declare type Subject<T> = Stream<T> & {
    value: T;
    readonly complete: CompleteFn;
};
export declare const ksSubject: <T>(initValue: T, behaviour?: import("./core").KsBehaviour) => Subject<T>;
