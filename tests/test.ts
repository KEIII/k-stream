import { combineLatest, concat, forkJoin, merge, of, timer } from 'rxjs';
import {
  map,
  mapTo,
  pairwise,
  switchMap,
  take,
  takeUntil,
  tap,
} from 'rxjs/operators';
import {
  ksChangeBehaviour,
  ksCold,
  ksCombineLatest,
  ksConcat,
  ksDebounce,
  ksDelay,
  ksEmpty,
  ksFilterMap,
  ksForkJoin,
  ksFromPromise,
  ksInterval,
  ksMap,
  ksMapTo,
  ksMerge,
  ksOf,
  ksPairwise,
  ksPeriodic,
  ksScan,
  ksShare,
  ksShareReplay,
  ksBehaviourSubject,
  ksSwitch,
  ksTake,
  ksTakeUntil,
  ksTakeWhile,
  ksTap,
  ksThrottle,
  ksTimeout,
  ksToPromise,
  ksZip,
  none,
  noop,
  some,
  ksSubject,
  right,
  left,
  isRight,
  isLeft,
  _lazy,
  SubscriberRequired,
} from '../src';

const stackOut = <A>(observable: {
  subscribe: SubscriberRequired<A>;
}): Promise<A[]> => {
  return new Promise<A[]>(resolve => {
    const output: A[] = [];
    const _observable = _lazy(observable);
    _observable.subscribe({
      next: v => output.push(v),
      complete: () => {
        resolve(output);
        _observable.unsubscribe(); // not necessary but increase test coverage ;)
      },
    });
  });
};

describe('ksFromPromise', () => {
  it('should create stream from promise and resolve', async () => {
    const random = Math.random();
    const out = await stackOut(
      ksFromPromise<number, unknown>(Promise.resolve(random)),
    );
    expect(out).toEqual([right(random)]);
    expect(isRight(out[0])).toBeTruthy();
    expect(isLeft(out[0])).toBeFalsy();
  });

  it('should create stream from promise and reject', async () => {
    const random = Math.random();
    const out = await stackOut(
      ksFromPromise<number, unknown>(Promise.reject(random)),
    );
    expect(out).toEqual([left(random)]);
  });

  it('should ignore resolved result after unsubscribe', async () => {
    const stream = ksFromPromise(Promise.resolve());
    const promise = ksToPromise(stream);
    let x = 0;
    stream.subscribe({ next: () => (x = 1) }).unsubscribe();
    await promise;
    expect(x).toBe(0);
  });

  it('should ignore rejected result after unsubscribe', async () => {
    const stream = ksFromPromise(Promise.reject());
    const promise = ksToPromise(stream);
    let x = 0;
    stream.subscribe({ next: () => (x = 1) }).unsubscribe();
    await promise;
    expect(x).toBe(0);
  });
});

describe('ksToPromise', () => {
  it('should create promise from stream', async () => {
    const random = Math.random();
    const promise = ksToPromise(ksOf(random));
    expect(await promise).toEqual(some(random));
  });
});

describe('ksCold', () => {
  it('should ignore emits after complete', async () => {
    const s = ksCold<number>(({ next, complete }) => {
      next(1);
      complete();
      next(2);
      complete();
      return { unsubscribe: noop };
    });
    let result = 0;
    s.subscribe({ next: v => (result = v) });
    expect(result).toBe(1);
  });

  it('should emit different values', async () => {
    const numbers = [1, 2];
    const s = ksTimeout(0).pipe(ksMap(() => numbers.pop()));
    const a = stackOut(s);
    const b = stackOut(s);
    expect((await a)[0] !== (await b)[0]).toBeTruthy();
  });

  it('should not return last emitted value', () => {
    const s = ksOf(42, ksCold);
    s.subscribe({});
    expect(s.lastValue).toBeUndefined();
  });
});

describe('ksShare', () => {
  it('should create share stream', async () => {
    const s = ksOf(1, ksShare);
    expect(await stackOut(s)).toEqual([1]);
  });

  it('should ignore emits after complete', async () => {
    const s = ksShare<number>(({ next, complete }) => {
      next(1);
      complete();
      next(2);
      complete();
      return { unsubscribe: noop };
    });
    let result = 0;
    s.subscribe({ next: v => (result = v) });
    expect(result).toBe(1);
  });

  it('should not emit after second subscribe', async () => {
    const s = ksOf(1, ksShare);
    let emitted = false;
    const s1 = s.subscribe({});
    const s2 = s.subscribe({ next: () => (emitted = true) });
    s1.unsubscribe();
    s2.unsubscribe();
    expect(emitted).toBeFalsy();
  });

  it('should emit same values', async () => {
    const numbers = [1, 2];
    const s = ksTimeout(0, ksShare).pipe(ksMap(() => numbers.pop()));
    const subscription = s.subscribe({});
    const a = stackOut(s);
    const b = stackOut(s);
    subscription.unsubscribe();
    expect(await a).toEqual(await b);
  });

  it('should not replay last value', async () => {
    const stream = ksInterval(100, ksShare);
    const sub = stream.subscribe({});
    const p = new Promise(resolve => {
      setTimeout(() => {
        stream.pipe(ksTake(1)).subscribe({ next: resolve });
        sub.unsubscribe();
      }, 1_000);
    });
    expect(await p).toEqual(9);
  });

  it('should not affect original stream', async () => {
    const a = ksPeriodic(100, ksShare)
      .pipe(ksMap(n => n + n))
      .pipe(ksTake(10));
    const b = a.pipe(ksMap(n => n * n));
    const sa = stackOut(a);
    const sb = stackOut(b);
    expect(await sa).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18]);
    expect(await sb).toEqual([4, 16, 36, 64, 100, 144, 196, 256, 324]);
  });

  it('should not return last emitted value', () => {
    const s = ksOf(42, ksShare);
    s.subscribe({});
    expect(s.lastValue).toBeUndefined();
  });
});

describe('ksShareReplay', () => {
  it('should replay last value', async () => {
    const stream = ksInterval(100, ksShareReplay);
    const sub = stream.subscribe({});
    const p = new Promise(resolve => {
      setTimeout(() => {
        stream.pipe(ksTake(1)).subscribe({ next: resolve });
        sub.unsubscribe();
      }, 1_000);
    });
    expect(await p).toEqual(8);
  });

  it('should not affect original stream', async () => {
    const a = ksPeriodic(100, ksShareReplay)
      .pipe(ksMap(n => n + n))
      .pipe(ksTake(10));
    const b = a.pipe(ksMap(n => n * n));
    const sa = stackOut(a);
    const sb = stackOut(b);
    expect(await sa).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18]);
    expect(await sb).toEqual([0, 4, 16, 36, 64, 100, 144, 196, 256, 324]);
  });

  it('should return last emitted value', () => {
    const s = ksOf(42, ksShareReplay);
    s.subscribe({});
    expect(s.lastValue).toEqual(42);
  });

  it('should try to emit last value with blank observer', async () => {
    const s = ksPeriodic(0, ksShareReplay).pipe(ksTake(2));
    s.subscribe({});
    s.subscribe({});
    expect(await stackOut(s)).toEqual([0, 1]);
  });
});

describe('ksTimeout', () => {
  it('should clear timeout after unsubscribe', async () => {
    const p = new Promise(resolve => {
      ksTimeout(0)
        .subscribe({ next: () => resolve(0) })
        .unsubscribe();
      setTimeout(() => {
        resolve(1);
      }, 10);
    });
    expect(await p).toBe(1);
  });
});

describe('ksMap', () => {
  it('should apply projection with each value from source', async () => {
    const random = Math.random();
    const s = ksOf(random, ksShare).pipe(ksMap(n => () => n));
    expect((await stackOut(s))[0]()).toBe(random);
  });
});

describe('ksMapTo', () => {
  it('should map to value', async () => {
    const random = Math.random();
    const s = ksOf(0, ksShare).pipe(ksMapTo(random));
    expect(await stackOut(s)).toEqual([random]);
  });
});

describe('ksTap', () => {
  it('should test tap', () => {
    const r = { v: 0, c: false };
    const s = ksOf(1)
      .pipe(
        ksTap({
          next: v => (r.v = v),
          complete: () => (r.c = true),
        }),
      )
      .pipe(ksTap({}));
    s.subscribe({}).unsubscribe();
    expect(r).toEqual({ v: 1, c: true });
  });
});

it('should complete after pipe', async () => {
  const random = Math.random();
  const s = stackOut(ksOf(0, ksShare).pipe(ksMap(() => random)));
  expect(await s).toEqual(await s);
});

it('should change behaviour', async () => {
  const numbers = [1, 2];
  const s = ksTimeout(0)
    .pipe(ksChangeBehaviour(ksShare))
    .pipe(ksMap(() => numbers.pop()));
  const a = stackOut(s);
  const b = stackOut(s);
  expect(await a).toEqual(await b);
});

it('should filter skip odd (i.e emit only even)', async () => {
  const out = await stackOut(
    ksPeriodic(0)
      .pipe(ksFilterMap(n => (!(n & 1) ? some(n) : none)))
      .pipe(ksTake(10)),
  );
  expect(out).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18]);
});

it('should test periodic', async () => {
  const out = await stackOut(ksPeriodic(0).pipe(ksTake(10)));
  expect(out).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

it('should create timeout', async () => {
  const out = await stackOut(ksTimeout(1).pipe(ksTake(3)));
  expect(out).toEqual([0]);
});

it('should test forkJoin', async () => {
  const outA = stackOut(
    ksForkJoin(
      ksPeriodic(1).pipe(ksTake(100)),
      ksPeriodic(10).pipe(ksTake(10)),
    ),
  );

  const outB = stackOut<any>(
    forkJoin([timer(0, 1).pipe(take(100)), timer(0, 10).pipe(take(10))]),
  );

  expect(await outA).toEqual(await outB);
});

describe('ksCombineLatest', () => {
  it('should combine latest', async () => {
    const limit = 100;
    const ms = 5;
    const s = ksPeriodic(ms).pipe(ksTake(limit));
    const a = await stackOut(ksCombineLatest(s, s));
    const rxjsStream = timer(0, ms).pipe(take(limit));
    const b = await stackOut(combineLatest([rxjsStream, rxjsStream]));
    expect(a).toEqual(b);
  });
});

describe('ksThrottle', () => {
  it('should test throttling', async () => {
    const limit = 7;
    const ms = 250;
    const max = 600;

    const s = ksPeriodic(ms).pipe(ksThrottle(max)).pipe(ksTake(limit));

    expect(await stackOut(s)).toEqual([0, 3, 6, 9, 12, 15, 18]);
  });

  it('should main complete before throttle time', async () => {
    const random = Math.random();
    const s = ksOf(random).pipe(ksThrottle(100));
    expect(await stackOut(s)).toEqual([random]);
  });
});

describe('ksDebounce', () => {
  it('should test debounce', async () => {
    const s = ksPeriodic(10).pipe(ksTake(100)).pipe(ksDebounce(1_000));

    expect(await stackOut(s)).toEqual([99]);
  });
});

describe('ksConcat', () => {
  it('should unsubscribe properly', async () => {
    const a = ksPeriodic(20)
      .pipe(
        ksSwitch(() => {
          return ksConcat(ksOf(0), ksTimeout(100).pipe(ksMapTo(1)));
        }),
      )
      .pipe(ksTake(50));
    const b = timer(0, 20).pipe(
      switchMap(() => concat(of(0), timer(100).pipe(mapTo(1)))),
      take(50),
    );
    const aa = stackOut(a);
    const bb = stackOut(b);
    expect(await aa).toEqual(await bb);
  });

  it('should unsubscribe before first stream has been completed', () => {
    const x = ksConcat(ksInterval(100), ksEmpty()).subscribe({}).unsubscribe();
    expect(x).toBeUndefined();
  });
});

describe('ksMerge', () => {
  it('should unsubscribe', () => {
    const x = ksMerge(ksEmpty(), ksEmpty()).subscribe({}).unsubscribe();
    expect(x).toBeUndefined();
  });
});

describe('ksSwitch', () => {
  it('should test switch', async () => {
    const project = (n: number) => {
      return ksConcat(ksOf(n), ksOf(n));
    };
    const s = ksPeriodic(1).pipe(ksSwitch(project)).pipe(ksTake(10));
    expect(await stackOut(s)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it('should work like RxJS', async () => {
    const a = ksTimeout(0).pipe(ksSwitch(() => ksPeriodic(0).pipe(ksTake(10))));
    const b = timer(0).pipe(switchMap(() => timer(0, 0).pipe(take(10))));
    expect(await stackOut(a)).toEqual(await stackOut(b));
  });

  it('should unsubscribe before project emits', async () => {
    const s = ksOf(0).pipe(ksSwitch(ksEmpty));
    expect(await stackOut(s)).toEqual([]);
  });
});

describe('ksTakeUntil', () => {
  it('should complete main stream before notifier emits', async () => {
    const random = Math.random();
    const s = ksOf(random).pipe(ksTakeUntil(ksTimeout(1_000)));
    expect(await stackOut(s)).toEqual([random]);
  });

  it('should complete main stream after notifier emits', async () => {
    const stop = ksTimeout(2_000);
    const s = ksPeriodic(100).pipe(ksTakeUntil(stop));
    expect((await stackOut(s)).pop()).toBe(19);
  });

  it('should test notifier could emit multiple times', async () => {
    const stop = ksTimeout(2_000, ksShare).pipe(
      ksSwitch(() => ksPeriodic(50, ksShare).pipe(ksTake(10))),
    );
    const a = stackOut(ksPeriodic(50).pipe(ksTakeUntil(stop)));
    const b = stackOut(stop);
    expect((await a).pop()).toBe(39);
    expect(await b).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('should properly unsubscribe', async () => {
    const s = ksOf(0).pipe(ksTakeUntil(ksOf(0)));
    expect(await stackOut(s)).toEqual([0]);
  });

  it('should completes on empty', async () => {
    const s = ksInterval(1).pipe(ksTakeUntil(ksEmpty()));
    expect(await stackOut(s)).toEqual([]);
  });

  it('should prevent pipe usage', () => {
    const f = () => {
      ksOf(0).pipe(ksTakeUntil(ksEmpty())).pipe(ksMapTo(0));
    };
    expect(f).toThrow();
  });
});

describe('ksTake', () => {
  it('should complete main stream before notifier emits', async () => {
    const random = Math.random();
    const s = ksOf(random).pipe(ksTake(1));
    expect(await stackOut(s)).toEqual([random]);
  });

  it('should complete main stream after notifier emits', async () => {
    const s = ksPeriodic(100).pipe(ksTake(5));
    expect(await stackOut(s)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('ksTakeWhile', () => {
  it('should emits until provided expression is false', async () => {
    const s = ksPeriodic(0).pipe(ksTakeWhile(n => n < 9));
    expect(await stackOut(s)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

it('should works like RxJS (in some cases ;)', async () => {
  const ms = 4500;
  const random = Math.random();

  const a = ksPeriodic(10)
    .pipe(
      ksSwitch(n => {
        return ksConcat(
          ksOf(n),
          ksTimeout(200).pipe(ksMapTo(random)).pipe(ksTake(1)),
        );
      }),
    )
    .pipe(ksMap(x => x * x))
    .pipe(ksPairwise())
    .pipe(ksTap({}))
    .pipe(ksTakeUntil(ksTimeout(ms)));

  const b = timer(0, 10).pipe(
    switchMap(n => {
      return concat(of(n), timer(200).pipe(mapTo(random), take(1)));
    }),
    map(x => x * x),
    pairwise(),
    tap(() => {}),
    takeUntil(timer(ms)),
  );

  const aa = stackOut(ksMerge(ksCombineLatest(a, a), ksCombineLatest(a, a)));
  const bb = stackOut<any>(merge(combineLatest([b, b]), combineLatest([b, b])));
  const aaa = await aa;
  const bbb = await bb;
  const size = Math.min(aaa.length, bbb.length);

  expect(aaa.slice(0, size)).toEqual(bbb.slice(0, size));
});

describe('ksBehaviourSubject', () => {
  it('should emit last value after subscribe', async () => {
    const r = { v: 0, c: false, emitted: false };
    const s = ksBehaviourSubject(0);
    s.value++;
    s.value++;
    s.complete();
    s.subscribe({
      next: v => (r.v = v),
      complete: () => (r.c = true),
    }).unsubscribe();
    r.v = 0;
    r.c = false;
    s.subscribe({
      next: v => {
        r.v = v;
        r.emitted = true;
      },
      complete: () => (r.c = true),
    }).unsubscribe();
    expect(r).toEqual({ v: 2, c: true, emitted: true });
  });

  it('should test behaviour subject', async () => {
    const s = ksBehaviourSubject(-1);
    s.next(0);
    const a = stackOut(s);
    for (let i = 1; i < 10; ++i) {
      s.value += i;
    }
    const b = stackOut(s);
    s.complete();
    expect(await a).toEqual([0, 1, 3, 6, 10, 15, 21, 28, 36, 45]);
    expect(await b).toEqual([45]);
    expect(await stackOut(s)).toEqual([45]);
  });

  it('should unsubscribe properly', () => {
    const s = ksBehaviourSubject(0);
    let count = 0;
    const next = () => count++;
    s.value++;
    s.subscribe({ next }).unsubscribe();
    s.value++;
    s.subscribe({ next }).unsubscribe();
    s.value++;
    expect(count).toEqual(2);
  });

  it('should not emit values after complete', async () => {
    const s = ksBehaviourSubject(1);
    const a = stackOut(s);
    s.complete();
    s.value = 2;
    expect(s.value).toBe(1);
    expect(await a).toEqual([1]);
  });

  it('should test subscribe blank observer after complete', async () => {
    const s = ksBehaviourSubject(1);
    s.complete();
    s.subscribe({});
    expect(await stackOut(s)).toEqual([1]);
  });

  it('should emit same values on multiple subscription', async () => {
    const s = ksBehaviourSubject(0);
    const a = stackOut(s);
    const b = stackOut(s);
    s.value++;
    s.value++;
    s.complete();
    expect(await a).toEqual(await b);
  });

  it('should accept partial observer', () => {
    expect(ksBehaviourSubject(0).subscribe({}).unsubscribe()).toBeUndefined();
  });

  it('should emit current value after subscribe', async () => {
    const s = ksBehaviourSubject(5)
      .pipe(ksMap(n => n * n))
      .pipe(ksTake(1));
    expect(await stackOut(s)).toEqual([25]);
  });
});

describe('ksSubject', () => {
  it('should test subject', async () => {
    const s = ksSubject();
    s.next(0);
    const a = stackOut(s);
    for (let i = 1; i < 10; ++i) {
      s.next(i);
    }
    const b = stackOut(s);
    s.complete();
    expect(await a).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(await b).toEqual([]);
    expect(await stackOut(s)).toEqual([]);
  });

  it('should test subscribe after complete', async () => {
    const s = ksSubject();
    s.complete();
    s.subscribe({});
    s.subscribe({ next: noop, complete: noop });
    s.next(42);
    expect(await stackOut(s)).toEqual([]);
  });
});

describe('ksDelay', () => {
  it('should delay emitted values by given time', async () => {
    const delay = 100;
    const accuracy = 10;
    const now = ksMap(() => Date.now());
    const org = ksPeriodic(100, ksShareReplay).pipe(now).pipe(ksTake(10));
    const delayed = org.pipe(ksDelay(delay)).pipe(now);
    const zipped = ksZip(org, delayed);
    for (const [a, b] of await stackOut(zipped)) {
      const diff = b - a;
      expect(diff).toBeGreaterThanOrEqual(delay - accuracy);
      expect(diff).toBeLessThanOrEqual(delay + accuracy);
    }
  });

  it('should unsubscribe before delay', () => {
    const s = ksPeriodic(0, ksShare).pipe(ksDelay(1_000));
    expect(s.subscribe({}).unsubscribe()).toBeUndefined();
  });
});

describe('ksZip', () => {
  it('should zip values', async () => {
    const a = ksPeriodic(20).pipe(ksTake(10));
    const b = ksPeriodic(10).pipe(ksTake(20));
    expect(await stackOut(ksZip(a, b))).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
      [5, 5],
      [6, 6],
      [7, 7],
      [8, 8],
      [9, 9],
    ]);
    expect(await stackOut(ksZip(b, a))).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
      [5, 5],
      [6, 6],
      [7, 7],
      [8, 8],
      [9, 9],
    ]);
  });

  it('should properly unsubscribe', () => {
    const s = ksOf(0);
    expect(ksZip(s, s).subscribe({}).unsubscribe()).toBeUndefined();
  });
});

describe('ksScan', () => {
  it('should calculate sum', async () => {
    const s = ksPeriodic(0)
      .pipe(ksScan((acc, curr) => [...acc, curr], <number[]>[]))
      .pipe(ksTake(10));
    expect(await stackOut(s)).toEqual([
      [0],
      [0, 1],
      [0, 1, 2],
      [0, 1, 2, 3],
      [0, 1, 2, 3, 4],
      [0, 1, 2, 3, 4, 5],
      [0, 1, 2, 3, 4, 5, 6],
      [0, 1, 2, 3, 4, 5, 6, 7],
      [0, 1, 2, 3, 4, 5, 6, 7, 8],
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    ]);
  });
});

describe('performance', () => {
  it('maximum call stack size exceeded', () => {
    const m = ksMap((x: number) => x + 1);
    let s = ksOf(0);
    const max = 2_576;
    for (let i = 0; i < max; i++) {
      s = s.pipe(m);
    }
    let result = 0;
    s.subscribe({ next: value => (result = value) }).unsubscribe();
    expect(result).toBe(max);
  });

  it('rxjs: maximum call stack size exceeded', () => {
    const m = map((x: number) => x + 1);
    let s = of(0);
    const max = 1_000;
    for (let i = 0; i < max / 8; i++) {
      s = s.pipe(m, m, m, m, m, m, m, m);
    }
    let result = 0;
    s.subscribe({ next: value => (result = value) }).unsubscribe();
    expect(result).toBe(max);
  });
});
