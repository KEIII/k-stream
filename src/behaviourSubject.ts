import {
  CompleteFn,
  ksCreateStream,
  ksShareReplay,
  NextFn,
  noop,
  Observer,
  Stream,
} from './core';

export type BehaviourSubject<T> = Stream<T> & {
  value: T;
  readonly next: NextFn<T>;
  readonly complete: CompleteFn;
};

export const ksBehaviourSubject = <T>(
  initValue: T,
  behaviour = ksShareReplay,
): BehaviourSubject<T> => {
  const state = { isCompleted: false, current: initValue };
  let subjectObserver: Observer<T> | null = null;

  const stream = ksCreateStream<T>(behaviour, observer => {
    subjectObserver = observer;
    subjectObserver.next(state.current);
    return { unsubscribe: () => (subjectObserver = null) };
  });

  const next = (value: T) => {
    if (state.isCompleted) {
      console.warn('Logic error: Ignore call next on completed stream.');
    } else {
      state.current = value;
      if (subjectObserver !== null) {
        subjectObserver.next(value);
      }
    }
  };

  return {
    subscribe: observer => {
      if (state.isCompleted) {
        observer.next?.(state.current);
        observer.complete?.();
        return { unsubscribe: noop };
      } else {
        return stream.subscribe(observer);
      }
    },
    pipe: stream.pipe,
    behaviour: stream.behaviour,
    complete: () => {
      state.isCompleted = true;
      if (subjectObserver !== null) {
        subjectObserver.complete();
      }
    },
    next,
    set value(value: T) {
      next(value);
    },
    get value() {
      return state.current;
    },
  };
};
