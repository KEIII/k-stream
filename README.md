# Functional reactive stream library for TypeScript

K-Stream is ~~yet another~~ a library for reactive programming using Observables, to make it easier to compose asynchronous or callback-based code.

[![npm (scoped)](https://img.shields.io/npm/v/@keiii/k-stream?color=blue)](https://www.npmjs.com/package/@keiii/k-stream)
[![Coverage Status](https://coveralls.io/repos/github/KEIII/k-stream/badge.svg?branch=master)](https://coveralls.io/github/KEIII/k-stream?branch=master)

```sh
npm install @keiii/k-stream
```

## Usage

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

Create steam from your data source:

```typescript
const stream = ksShare<MouseEvent>(observer => {
  const handler = (e: MouseEvent) => observer.next(e);
  document.addEventListener('click', handler);
  return { unsubscribe: () => document.removeEventListener('click', handler) };
});
```

## Goals

- [RxJS](https://rxjs.dev/) like syntax
- “Hot” streams stay “Hot” after pipe usage (https://github.com/ReactiveX/rxjs/issues/1148)
- Type safe, no “any”
- [Either](https://gcanti.github.io/fp-ts/modules/Either.ts.html) data type as an alternative to throwing exceptions
