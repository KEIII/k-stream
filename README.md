# Functional reactive stream library for TypeScript
K-Stream is ~~yet another~~ a library for reactive programming using Observables, to make it easier to compose asynchronous or callback-based code.

[![npm (scoped)](https://img.shields.io/npm/v/@keiii/k-stream?color=blue)](https://www.npmjs.com/package/@keiii/k-stream) 
[![Coverage Status](https://coveralls.io/repos/github/KEIII/k-stream/badge.svg?branch=master)](https://coveralls.io/github/KEIII/k-stream?branch=master)

```sh
npm i @keiii/k-stream
```

## Usage
```typescript
import { ksPeriodic, ksShare, ksFilterMap, ksTake, some, none } from "@keiii/k-stream";

const stream = ksPeriodic(100, ksShare)
  .pipe(ksFilterMap(n => (n % 2 === 0 ? some(n) : none(n))))
  .pipe(ksTake(10));

stream.subscribe({
  next: console.log,
  complete: () => console.log('complete!'),
});
```
K-Steam provides helper function to create steam from your data source:
```typescript
const stream = ksCreateStream<MouseEvent>(ksShare, ({ next, complete }) => {
  const handler = (e: MouseEvent) => next(e);
  document.addEventListener("click", handler);
  return { unsubscribe: () => document.removeEventListener("click", handler) };
});
```

## Goals
- “Hot” streams stay “hot” after pipe usage (https://github.com/ReactiveX/rxjs/issues/1148)
- Type safe, no “any”
- Looks like RxJS syntax

## ToDo
- withLatestFrom
- audit
- repeat
- repeatWhen
- ...etc.
