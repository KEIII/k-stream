import { CompleteFn, Stream } from './core';
export declare type Subject<T> = Stream<T> & {
    readonly next: (value: T) => void;
    readonly complete: CompleteFn;
};
export declare const ksSubject: <T>(behaviour?: import("./core").KsBehaviour) => Subject<T>;
