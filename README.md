# Functional reactive stream library for TypeScript

K-Stream is a library for reactive programming using Observables, to make it easier to compose asynchronous or callback-based code.

![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
[![npm (scoped)](https://img.shields.io/npm/v/@keiii/k-stream?color=blue)](https://www.npmjs.com/package/@keiii/k-stream)
[![Coverage Status](https://coveralls.io/repos/github/KEIII/k-stream/badge.svg?branch=master)](https://coveralls.io/github/KEIII/k-stream?branch=master)

## Install

```sh
npm install @keiii/k-stream
```

## Goals

- [RxJS](https://rxjs.dev/) like syntax
- “Hot” streams stay “Hot” after pipe usage (https://github.com/ReactiveX/rxjs/issues/1148)
- Type safe, no “any”
- [Either](https://gcanti.github.io/fp-ts/modules/Either.ts.html) data type as an alternative to throwing exceptions

## Example of usage

```typescript
import {
  ksPeriodic,
  ksShare,
  ksFilterMap,
  ksTake,
  some,
  none,
} from '@keiii/k-stream';

// emit value each 100ms
// accept only even and convert to binary string
// take only 10 values
const stream = ksPeriodic(100, ksShare)
  .pipe(
    ksFilterMap(n => {
      if (n % 2 === 0) {
        return some(n.toString(2).padStart(8, '0'));
      } else {
        return none; // skip
      }
    }),
  )
  .pipe(ksTake(10));

stream.subscribe({
  next: console.log,
  complete: () => console.log('complete!'),
});
```

### Create steam from your data source

```typescript
const stream = ksShare<MouseEvent>(observer => {
  const handler = (e: MouseEvent) => observer.next(e);
  document.addEventListener('click', handler);
  return { unsubscribe: () => document.removeEventListener('click', handler) };
});
```

### React Hook

```tsx
export function useStream<T>(stream: BehaviourSubject<T>): T;
export function useStream<T>(stream: Stream<T>): T | null;
export function useStream<T>(stream: Stream<T>): T | null {
  const valueRef = useRef<T>(stream.snapshot());
  const streamRef = useRef(stream);

  // Handle dynamic stream replacement: sync refs during render (avoids tearing in Concurrent Mode)
  if (streamRef.current !== stream) {
    streamRef.current = stream;
    valueRef.current = stream.snapshot();
  }

  return useSyncExternalStore(
    useCallback(
      (onStoreChange: () => void) =>
        stream.subscribe({
          next: (value) => {
            valueRef.current = value;
            onStoreChange();
          },
        }).unsubscribe,
      [stream]
    ),
    useCallback(() => valueRef.current, []),
    stream.snapshot
  );
}

const counter$ = ksBehaviourSubject(0);
const increment = () => counter$.next(counter$.snapshot() + 1);
const decrement = () => counter$.next(counter$.snapshot() - 1);

function Counter() {
  return (
    <>
      <button onClick={increment}>+1</button>
      <div>{useStream(counter$)}</div>
      <button onClick={decrement}>-1</button>
    </>
  );
}
```

### Create pipeable operator

```typescript
import {
  Option,
  Stream,
  PipeableOperator,
  ksConcat,
  ksMap,
  ksOf,
  ksScan,
  ksSwitch,
  none,
  some,
} from '@keiii/k-stream';

export type LoadingState<T> = {
  loading: boolean;
  response: Option<T>;
};

const initialState: LoadingState<never> = {
  loading: false,
  response: none,
};

const patch = <A>(
  currentState: LoadingState<A>,
  patchState: Partial<LoadingState<A>>,
): LoadingState<A> => {
  return {
    ...currentState,
    ...patchState,
  };
};

const loadingTrue = ksOf({ loading: true } as const);

const loadedResponse = <A>(b: A): LoadingState<A> => {
  return {
    loading: false,
    response: some(b),
  };
};

/**
 * Transform a stream of requests into a stream of a state with loading indicator.
 */
export const ksLoading = <A, B>(
  project: (a: A) => Stream<B>,
): PipeableOperator<A, LoadingState<B>> => {
  return stream => {
    return stream
      .pipe(
        ksSwitch(a => {
          return ksConcat(
            loadingTrue, // set the loading indicator as "true" before loading
            project(a).pipe(ksMap(loadedResponse)), // and concatenate with response
          );
        }),
      )
      .pipe(
        ksScan<Partial<LoadingState<B>>, LoadingState<B>>(patch, initialState),
      );
  };
};
```

