import { Complete, ksShareReplay, Next, noop, Observer, Stream } from './core';

export type BehaviourSubject<A> = Stream<A> & {
  value: A;
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

  return {
    subscribe: observer => {
      if (state.isCompleted) {
        observer.next?.(state.current);
        observer.complete?.();
        return { unsubscribe: noop };
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
    set value(value: A) {
      next(value);
    },
    get value() {
      return state.current;
    },
  };
};
