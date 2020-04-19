# Functional reactive stream library for TypeScript
K-Steam is ~~yet another~~ a library for reactive programming using Observables, to make it easier to compose asynchronous or callback-based code.

[![Build Status](https://travis-ci.com/KEIII/k-stream.svg?branch=master)](https://travis-ci.com/KEIII/k-stream) [![Coverage Status](https://coveralls.io/repos/github/KEIII/k-stream/badge.svg?branch=master)](https://coveralls.io/github/KEIII/k-stream?branch=master)

## Usage
```typescript
import { ksPeriodic as periodic } from "./factories";
import { KsBehaviour as Behaviour } from "./core";
import { ksFilter as filter, ksTake as take } from "./transformers";
import { Some, None } from "./ts-option";

const stream = periodic(100, Behaviour.SHARE_REPLAY)
  .pipe(filter((n) => (n % 2 === 0 ? Some(n) : None<typeof n>())))
  .pipe(take(10));

stream.subscribe({
  next: console.log,
  complete: () => console.log("complete!"),
});
```
K-Steam provides helper function to create steam from your data source:
```typescript
const stream = ksCreateStream<MouseEvent>(KsBehaviour.SHARE, ({ next, complete }) => {
  const handler = (e: MouseEvent) => next(e);
  document.addEventListener("click", handler);
  return { unsubscribe: () => document.removeEventListener("click", handler) };
});
```

## Goals
- “Hot” streams stay “hot” after pipe usage
- Do not lose type information
- RxJS similar

## ToDo
- withLatestFrom
- scan
- audit
- ...etc.
