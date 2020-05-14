import {
  CompleteFn,
  NextFn,
  Observer,
  Stream,
  ksCreateStream,
  noop,
  ksShare,
} from './core';

export type Emitter<T> = Stream<T> & {
  readonly next: (value: T) => void;
  readonly complete: CompleteFn;
};

export const ksEmitter = <T>(behaviour = ksShare): Emitter<T> => {
  let isCompleted = false;
  let emitterObserver: Observer<T> | null = null;

  const next: NextFn<T> = (value: T) => {
    if (!isCompleted) {
      emitterObserver?.next(value);
    }
  };

  const complete: CompleteFn = () => {
    isCompleted = true;
    emitterObserver?.complete();
  };

  const stream = ksCreateStream<T>(behaviour, o => {
    emitterObserver = o;
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
