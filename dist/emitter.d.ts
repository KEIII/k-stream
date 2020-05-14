import { CompleteFn, Stream } from './core';
export declare type Emitter<T> = Stream<T> & {
    readonly next: (value: T) => void;
    readonly complete: CompleteFn;
};
export declare const ksEmitter: <T>(behaviour?: import("./core").KsBehaviour) => Emitter<T>;
