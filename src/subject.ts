import {
  CompleteFn,
  KsBehaviour,
  ksCreateStream,
  NextFn,
  Observer,
  Stream,
  SubscribePartialFn,
} from "./core";

export type Subject<T> = Stream<T> & {
  value: T;
  readonly subscribe: SubscribePartialFn<T>;
  readonly complete: CompleteFn;
  readonly isCompleted: boolean;
};

export const ksSubject = <T>(initValue: T): Subject<T> => {
  const behaviour = KsBehaviour.SHARE_REPLAY;
  const state = { isCompleted: false, current: initValue };
  let observer: Observer<T> | null = null;

  const next: NextFn<T> = (value: T) => {
    if (!state.isCompleted) {
      state.current = value;
      if (observer !== null) {
        observer.next(value);
      }
    }
  };

  const complete: CompleteFn = () => {
    state.isCompleted = true;
    if (observer !== null) {
      observer.complete();
    }
  };

  const { subscribe, pipe } = ksCreateStream<T>(behaviour, (o) => {
    observer = o;
    return { unsubscribe: () => (observer = null) };
  });

  return {
    subscribe: (o) => {
      if (o.next !== undefined) {
        o.next(state.current);
      }
      if (state.isCompleted && o.complete !== undefined) {
        o.complete();
      }
      return subscribe(o);
    },
    pipe,
    behaviour,
    complete,
    get isCompleted() {
      return state.isCompleted;
    },
    set value(value: T) {
      next(value);
    },
    get value() {
      return state.current;
    },
  };
};
