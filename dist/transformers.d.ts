import { KsBehaviour, Observer, Stream, TransformFn } from "./core";
import { Option } from "./ts-option";
export declare const ksChangeBehaviour: <T>(
  newBehaviour: KsBehaviour
) => TransformFn<T, T>;
/**
 * Apply projection with each value from source.
 */
export declare const ksMap: <T, O>(
  project: (value: T) => O
) => TransformFn<T, O>;
/**
 * Map emissions to constant value.
 */
export declare const ksMapTo: <T, O>(value: O) => TransformFn<T, O>;
/**
 * Transparently perform actions or side-effects, such as logging.
 */
export declare const ksTap: <T>(
  tapPartialObserver: Partial<Observer<T>>
) => TransformFn<T, T>;
/**
 * Emit values that pass the provided condition.
 */
export declare const ksFilter: <T, O extends T>(
  select: (value: T) => Option<O>
) => TransformFn<T, O>;
/**
 * Map to observable, complete previous inner observable, emit values.
 */
export declare const ksSwitch: <T, O>(
  project: (value: T) => Stream<O>
) => TransformFn<T, O>;
/**
 * Emit values until provided observable emits or completes.
 */
export declare const ksTakeUntil: <T>(
  notifier: Stream<unknown>
) => TransformFn<T, T>;
/**
 * Emit provided number of values before completing.
 */
export declare const ksTake: <T>(count: number) => TransformFn<T, T>;
/**
 * Emit values until provided expression is false.
 */
export declare const ksTakeWhile: <T>(
  predicate: (value: T) => boolean
) => TransformFn<T, T>;
/**
 * Delay emitted values by given time.
 */
export declare const ksDelay: <T>(delay: number) => TransformFn<T, T>;
/**
 * Discard emitted values that take less than the specified time between output.
 */
export declare const ksDebounce: <T>(dueTime: number) => TransformFn<T, T>;
/**
 * Emit first value then ignore for specified duration.
 */
export declare const ksThrottle: <T>(duration: number) => TransformFn<T, T>;
/**
 * Emit the previous and current values as an array.
 */
export declare const ksPairwise: <T>() => TransformFn<T, [T, T]>;
/**
 * Reduce over time.
 */
export declare const ksScan: <T, O>(
  accumulator: (acc: O, curr: T) => O,
  seed: O
) => TransformFn<T, O>;
