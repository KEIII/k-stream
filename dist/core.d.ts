export declare type Unsubscribable = {
    readonly unsubscribe: () => void;
};
export declare type NextFn<T> = (value: T) => void;
export declare type CompleteFn = () => void;
export declare type Observer<T> = {
    readonly next: NextFn<T>;
    readonly complete: CompleteFn;
};
export declare type SubscribeFn<T> = (observer: Observer<T>) => Unsubscribable;
export declare type SubscribePartialFn<T> = (partialObserver: Partial<Observer<T>>) => Unsubscribable;
export declare type TransformFn<T, O> = (stream: Stream<T>) => Stream<O>;
export declare type PipeFn<T> = <O>(transformFn: TransformFn<T, O>) => Stream<O>;
export declare type Observable<T> = {
    readonly subscribe: SubscribePartialFn<T>;
};
export declare type Stream<T> = Observable<T> & {
    readonly pipe: PipeFn<T>;
    readonly behaviour: KsBehaviour;
};
export declare enum KsBehaviour {
    COLD = 0,
    SHARE = 1,
    SHARE_REPLAY = 2
}
export declare const noop: () => void;
export declare const observerFromPartial: <T>(o: Partial<Observer<T>>) => Observer<T>;
export declare const ksCreateStream: <T>(behaviour: KsBehaviour, subscribeFn: SubscribeFn<T>) => Stream<T>;
/**
 * Combine transformers.
 */
export declare const ksPipe: <A, B, C>(t1: TransformFn<A, B>, t2: TransformFn<B, C>) => TransformFn<A, C>;
