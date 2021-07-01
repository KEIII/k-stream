import {
  Complete,
  Next,
  Observer,
  Stream,
  ksShare,
  noopUnsubscribe,
} from './core';

export type Subject<A> = Stream<A> & {
  readonly next: (value: A) => void;
  readonly complete: Complete;
};

export const ksSubject = <A>(behaviour = ksShare): Subject<A> => {
  let isCompleted = false;
  let subjectObserver: Required<Observer<A>> | null = null;

  const next: Next<A> = value => {
    if (isCompleted) return;
    subjectObserver?.next(value);
  };

  const complete: Complete = () => {
    isCompleted = true;
    subjectObserver?.complete();
  };

  const stream = behaviour<A>(observer => {
    subjectObserver = observer;
    return noopUnsubscribe;
  });

  return {
    subscribe: observer => {
      if (isCompleted) {
        observer.complete?.();
        return noopUnsubscribe;
      }
      return stream.subscribe(observer);
    },
    pipe: stream.pipe,
    behaviour: stream.behaviour,
    next,
    complete,
  };
};
