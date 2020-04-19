import { CompleteFn, PipeFn, SubscribePartialFn } from "./core";
export declare type Subject<T> = {
  value: T;
  readonly subscribe: SubscribePartialFn<T>;
  readonly pipe: PipeFn<T>;
  readonly complete: CompleteFn;
  readonly isCompleted: boolean;
};
export declare const ksSubject: <T>(initValue: T) => Subject<T>;
