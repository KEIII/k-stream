import {
  CompleteFn,
  NextFn,
  Observer,
  Stream,
  ksCreateStream,
  noop,
  ksShare,
} from './core';

export type Subject<T> = Stream<T> & {
  readonly next: (value: T) => void;
  readonly complete: CompleteFn;
};

export const ksSubject = <T>(behaviour = ksShare): Subject<T> => {
  let isCompleted = false;
  let subjectObserver: Observer<T> | null = null;

  const next: NextFn<T> = (value: T) => {
    if (!isCompleted) {
      subjectObserver?.next(value);
    }
  };

  const complete: CompleteFn = () => {
    isCompleted = true;
    subjectObserver?.complete();
  };

  const stream = ksCreateStream<T>(behaviour, o => {
    subjectObserver = o;
    return { unsubscribe: noop };
  });

  return {
    subscribe: observer => {
      if (isCompleted) {
        observer.complete?.();
        return { unsubscribe: noop };
      } else {
        return stream.subscribe(observer);
      }
    },
    pipe: stream.pipe,
    behaviour: stream.behaviour,
    next,
    complete,
  };
};
