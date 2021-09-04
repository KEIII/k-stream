import {
  Complete,
  ksShareReplay,
  Next,
  noopUnsubscribe,
  Observer,
  Stream,
} from './core';

export type BehaviourSubject<A> = Stream<A> & {
  readonly getValue: () => A;
  readonly next: Next<A>;
  readonly complete: Complete;
};

export const ksBehaviourSubject = <A>(
  initValue: A,
  behaviour = ksShareReplay,
): BehaviourSubject<A> => {
  const state = { isCompleted: false, current: initValue };
  let subjectObserver: Required<Observer<A>> | null = null;

  const stream = behaviour<A>(observer => {
    subjectObserver = observer;
    subjectObserver.next(state.current);
    return { unsubscribe: () => (subjectObserver = null) };
  });

  const next: Next<A> = value => {
    if (state.isCompleted) {
      return console.warn(
        'Logic error: Ignore call `next` on completed stream.',
      );
    }
    state.current = value;
    subjectObserver?.next(value);
  };

  const getValue = () => state.current;

  return {
    subscribe: observer => {
      if (state.isCompleted) {
        observer.next?.(state.current);
        observer.complete?.();
        return noopUnsubscribe;
      }
      return stream.subscribe(observer);
    },
    pipe: stream.pipe,
    behaviour: stream.behaviour,
    complete: () => {
      state.isCompleted = true;
      subjectObserver?.complete();
    },
    next,
    getValue,
    _unsafeLastValue: getValue,
  };
};
