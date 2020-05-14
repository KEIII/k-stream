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
    readonly lastValue?: T;
};
export declare type KsBehaviour = <T>(subscribeFn: SubscribeFn<T>) => Stream<T>;
export declare const noop: () => void;
/**
 * Create source on each subscription.
 */
export declare const ksCold: KsBehaviour;
/**
 * Share source among multiple subscribers.
 */
export declare const ksShare: KsBehaviour;
/**
 * Share source and replay last emissions on subscription.
 */
export declare const ksShareReplay: KsBehaviour;
export declare const ksCreateStream: <T>(b: KsBehaviour, f: SubscribeFn<T>) => Stream<T>;
/**
 * Combine transformers.
 */
export declare const ksPipe: <A, B, C>(t1: TransformFn<A, B>, t2: TransformFn<B, C>) => TransformFn<A, C>;
