import {
  CompleteFn,
  ksCreateStream,
  ksShareReplay,
  noop,
  Observer,
  Stream,
} from './core';

export type Subject<T> = Stream<T> & {
  value: T;
  readonly complete: CompleteFn;
};

export const ksSubject = <T>(
  initValue: T,
  behaviour = ksShareReplay,
): Subject<T> => {
  const state = { isCompleted: false, current: initValue };
  let subjectObserver: Observer<T> | null = null;

  const stream = ksCreateStream<T>(behaviour, observer => {
    subjectObserver = observer;
    subjectObserver.next(state.current);
    return { unsubscribe: () => (subjectObserver = null) };
  });

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
    set value(value: T) {
      if (state.isCompleted) {
        console.warn('Logic error: Ignore call next on completed stream.');
      } else {
        state.current = value;
        if (subjectObserver !== null) {
          subjectObserver.next(value);
        }
      }
    },
    get value() {
      return state.current;
    },
  };
};
