import { Complete, Next, Observer, Stream, noop, ksShare } from './core';

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
    return { unsubscribe: noop };
  });

  return {
    subscribe: observer => {
      if (isCompleted) {
        observer.complete?.();
        return { unsubscribe: noop };
      }
      return stream.subscribe(observer);
    },
    pipe: stream.pipe,
    behaviour: stream.behaviour,
    next,
    complete,
  };
};
