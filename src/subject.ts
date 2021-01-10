import {
  Complete,
  Next,
  Observer,
  Stream,
  ksCreateStream,
  noop,
  ksShare,
} from './core';

export type Subject<A> = Stream<A> & {
  readonly next: (value: A) => void;
  readonly complete: Complete;
};

export const ksSubject = <A>(behaviour = ksShare): Subject<A> => {
  let isCompleted = false;
  let subjectObserver: Observer<A> | null = null;

  const next: Next<A> = (value: A) => {
    if (!isCompleted) {
      subjectObserver?.next?.(value);
    }
  };

  const complete: Complete = () => {
    isCompleted = true;
    subjectObserver?.complete?.();
  };

  const stream = ksCreateStream<A>(behaviour, o => {
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
