import { KsBehaviour, Observable, Stream } from './core';
import { Option } from './ts-option';
import { Result } from './ts-result';
/**
 * Observable that immediately completes.
 */
export declare const ksEmpty: <T>() => Stream<T>;
/**
 * Emit variable amount of values in a sequence and then emits a complete notification.
 */
export declare const ksOf: <T>(value: T, behaviour?: KsBehaviour) => Stream<T>;
/**
 * Subscribe to observables in order as previous completes.
 */
export declare const ksConcat: <T1, T2>(stream1: Stream<T1>, stream2: Stream<T2>) => Stream<T1 | T2>;
/**
 * Turn multiple observables into a single observable.
 */
export declare const ksMerge: <T1, T2>(stream1: Stream<T1>, stream2: Stream<T2>) => Stream<T1 | T2>;
/**
 * After all observables emit, emit values as an array.
 */
export declare const ksZip: <T1, T2>(stream1: Stream<T1>, stream2: Stream<T2>) => Stream<[T1, T2]>;
export declare const ksTimeout: (ms: number, behaviour?: KsBehaviour) => Stream<number>;
export declare const ksInterval: (ms: number, behaviour?: KsBehaviour) => Stream<number>;
export declare const ksPeriodic: (ms: number, behaviour?: KsBehaviour) => Stream<number>;
/**
 * When any observable emits a value, emit the last emitted value from each.
 */
export declare const ksCombineLatest: <T1, T2>(stream1: Stream<T1>, stream2: Stream<T2>) => Stream<[T1, T2]>;
/**
 * When all observables complete, emit the last emitted value from each.
 */
export declare const ksForkJoin: <T1, T2>(stream1: Stream<T1>, stream2: Stream<T2>) => Stream<[T1, T2]>;
export declare const ksFromPromise: <T, E>(promise: Promise<T>, behaviour?: KsBehaviour) => Stream<Result<T, E>>;
export declare const ksToPromise: <T>(o: Observable<T>) => Promise<Option<T>>;
