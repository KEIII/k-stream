import { CompleteFn, Stream, SubscribePartialFn } from "./core";
export declare type Subject<T> = Stream<T> & {
  value: T;
  readonly subscribe: SubscribePartialFn<T>;
  readonly complete: CompleteFn;
  readonly isCompleted: boolean;
};
export declare const ksSubject: <T>(initValue: T) => Subject<T>;
