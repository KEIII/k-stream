import {
  CompleteFn,
  KsBehaviour,
  ksCreateStream,
  NextFn,
  noop,
  Observer,
  Stream,
  SubscribePartialFn,
} from "./core";

export type Subject<T> = Stream<T> & {
  value: T;
  readonly subscribe: SubscribePartialFn<T>;
  readonly complete: CompleteFn;
};

export const ksSubject = <T>(initValue: T): Subject<T> => {
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

  const stream = ksCreateStream<T>(KsBehaviour.PUBLISH_REPLAY, (o) => {
    observer = o;
    observer.next(initValue);
    return { unsubscribe: noop };
  });

  return {
    subscribe: (o) => {
      if (state.isCompleted) {
        if (o.next !== undefined) {
          o.next(state.current);
        }
        if (o.complete !== undefined) {
          o.complete();
        }
        return { unsubscribe: noop };
      } else {
        return stream.subscribe(o);
      }
    },
    pipe: stream.pipe,
    behaviour: stream.behaviour,
    complete,
    set value(value: T) {
      next(value);
    },
    get value() {
      return state.current;
    },
  };
};
