import {
  Complete,
  Next,
  Observer,
  Stream,
  ksShare,
  noopUnsubscribe,
} from './core';
import { isSome, none, Option, some } from './option';

export type Subject<A> = Stream<A> & {
  readonly next: Next<A>;
  readonly complete: Complete;
};

export const ksSubject = <A>(behaviour = ksShare): Subject<A> => {
  let isCompleted = false;
  let lastValue: Option<A> = none;
  const observersMap = new Map<symbol, Observer<A>>();

  const next: Next<A> = value => {
    if (isCompleted) {
      return console.warn(
        'Logic error: Ignore call `next` on completed stream.',
      );
    }
    lastValue = some(value);
    observersMap.forEach(observer => observer.next?.(value));
  };

  const complete: Complete = () => {
    if (isCompleted) {
      return console.warn('Logic error: attempt to execute twice');
    }
    isCompleted = true;
    observersMap.forEach(observer => observer.complete?.());
  };

  const self: Subject<A> = {
    subscribe: observer => {
      if (isCompleted) {
        console.warn('Logic error: Ignore call `next` on completed stream.');
        return noopUnsubscribe;
      }
      const subscribeId = Symbol();
      if (!isCompleted) {
        observersMap.set(subscribeId, observer);
      }
      return {
        unsubscribe: () => {
          observersMap.delete(subscribeId);
        },
      };
    },
    pipe: transformer => transformer(self),
    behaviour,
    complete,
    next,
    _unsafeLastValue: () => {
      return isSome(lastValue) ? lastValue.value : undefined;
    },
  };

  return self;
};
