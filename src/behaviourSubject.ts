import { Complete, ksShareReplay, Next, Observer } from './core';
import { Subject } from './subject';

export type BehaviourSubject<A> = Subject<A> & {
  readonly getValue: () => A;
};

export const ksBehaviourSubject = <A>(
  initValue: A,
  constructor = ksShareReplay,
): BehaviourSubject<A> => {
  let isCompleted = false;
  let currentValue = initValue;
  const observersMap = new Map<symbol, Observer<A>>();

  const next: Next<A> = value => {
    if (isCompleted) {
      return console.warn(
        'Logic error: Ignore call `next` on completed stream.',
      );
    }
    currentValue = value;
    observersMap.forEach(observer => observer.next?.(value));
  };

  const complete: Complete = () => {
    if (isCompleted) {
      return console.warn('Logic error: attempt to execute twice');
    }
    isCompleted = true;
    observersMap.forEach(observer => observer.complete?.());
  };

  const getValue = () => currentValue;

  const self: BehaviourSubject<A> = {
    subscribe: observer => {
      const subscribeId = Symbol();
      observer.next?.(currentValue);
      if (isCompleted) {
        observer.complete?.();
      } else {
        observersMap.set(subscribeId, observer);
      }
      return {
        unsubscribe: () => {
          observersMap.delete(subscribeId);
        },
      };
    },
    pipe: operator => operator(self),
    constructor: constructor,
    complete,
    next,
    getValue,
    snapshot: getValue,
  };

  return self;
};
