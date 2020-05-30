import { None, Option, Some, Stream, ksCreateStream } from './index';
import { ksEmpty } from './factories';

export const ksCombineLatestArr = <T>(
  streams: Array<Stream<T>>,
): Stream<T[]> => {
  const len = streams.length;

  if (len === 0) {
    return ksEmpty();
  }

  return ksCreateStream(streams[0].behaviour, ({ next, complete }) => {
    const completed: boolean[] = Array(len).fill(false);
    const values: Option<T>[] = Array(len).fill(None<T>());

    const tryNext = () => {
      const r: T[] = [];
      for (const v of values) {
        if (v._tag === 'Some') r.push(v.some);
      }
      if (r.length === len) {
        next(r);
      }
    };

    const tryComplete = () => {
      if (completed.filter(c => !c).length === 0) {
        complete();
      }
    };

    const subscriptions = streams.map((stream, idx) => {
      return stream.subscribe({
        next: value => {
          values[idx] = Some(value);
          tryNext();
        },
        complete: () => {
          completed[idx] = true;
          tryComplete();
        },
      });
    });

    return {
      unsubscribe: () => subscriptions.forEach(s => s.unsubscribe()),
    };
  });
};
