import { CompleteFn, KsBehaviour, Stream } from './core';
export declare type Subject<T> = Stream<T> & {
    value: T;
    readonly complete: CompleteFn;
};
export declare const ksSubject: <T>(initValue: T, behaviour?: KsBehaviour) => Subject<T>;
