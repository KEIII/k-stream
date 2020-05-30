import { CompleteFn, NextFn, Stream } from './core';
export declare type BehaviourSubject<T> = Stream<T> & {
    value: T;
    readonly next: NextFn<T>;
    readonly complete: CompleteFn;
};
export declare const ksBehaviourSubject: <T>(initValue: T, behaviour?: import("./core").KsBehaviour) => BehaviourSubject<T>;
