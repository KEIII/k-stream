import {
  BehaviorSubject,
  combineLatest,
  concat,
  forkJoin,
  merge,
  of,
  timer,
  asapScheduler,
} from 'rxjs';
import {
  map,
  mapTo,
  pairwise,
  shareReplay,
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
  some,
  ksSubject,
  right,
  left,
  isRight,
  isLeft,
  _lazy,
  SubscriberRequired,
  ksNever,
  Scheduler,
  noopUnsubscribe,
  ksRepeat,
  ksRepeatWhen,
  ksRetryWhen,
  ksWithLatestFrom,
  ksAudit,
  Stream,
  Either,
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
        _observable.unsubscribe();
        resolve(output);
      },
    });
  });
};

describe('_lazy', () => {
  it('should return noopUnsubscribe', () => {
    const s = _lazy(ksOf(42));
    s.unsubscribe();
    expect(s.subscribe({})).toBe(noopUnsubscribe);
  });

  it('should always teardown before starting the next cycle', () => {
    const result: unknown[] = [];
    const s = _lazy(
      ksCold(() => {
        return { unsubscribe: () => result.push('teardown') };
      }),
    );
    s.subscribe({ next: value => result.push(value) });
    s.subscribe({ next: value => result.push(value) }).unsubscribe();
    s.subscribe({ next: value => result.push(value) });
    expect(result).toEqual(['teardown', 'teardown', 'teardown']);
  });
});

describe('ksNever', () => {
  it('should create a cold observable that never emits ', () => {
    let x;
    ksNever.subscribe({ next: (v: never) => (x = v) }).unsubscribe();
    expect(x).toBeUndefined();
  });

  it('should return the same instance every time', () => {
    expect(ksNever).toBe(ksNever);
  });
});

describe('ksFromPromise', () => {
  it('should create stream from promise and resolve', async () => {
    const random = Math.random();
    const out = await stackOut(
      ksFromPromise<number, unknown>(Promise.resolve(random)),
    );
    expect(out).toEqual([right(random)]);
    expect(isRight(out[0]!)).toBeTruthy();
    expect(isLeft(out[0]!)).toBeFalsy();
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
      return noopUnsubscribe;
    });
    let result = 0;
    const { unsubscribe } = s.subscribe({ next: v => (result = v) });
    expect(result).toBe(1);
    unsubscribe();
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
    const { unsubscribe } = s.subscribe({});
    expect(s._unsafeLastValue()).toBeUndefined();
    unsubscribe();
  });

  it('should stop emitting values after unsubscribe', async () => {
    const s = ksTimeout(0, ksCold).pipe(
      ksTap({
        next: () => {
          unsubscribe();
        },
      }),
    );
    let x = 1;
    const { unsubscribe } = s.subscribe({ next: v => (x = v) });
    await stackOut(ksTimeout(10));
    expect(x).toBe(1);
    unsubscribe();
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
      return noopUnsubscribe;
    });
    let result = 0;
    const { unsubscribe } = s.subscribe({ next: v => (result = v) });
    expect(result).toBe(1);
    unsubscribe();
  });

  it('should not emit after second subscribe', async () => {
    const s = ksOf(1, ksShare);
    let emitted = false;
    const sub1 = s.subscribe({});
    const sub2 = s.subscribe({ next: () => (emitted = true) });
    sub1.unsubscribe();
    sub2.unsubscribe();
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
    const { unsubscribe } = s.subscribe({});
    expect(s._unsafeLastValue()).toBeUndefined();
    unsubscribe();
  });

  it('should deal with circular dependencies', async () => {
    const a = ksOf(42, ksShareReplay);
    const b = a
      .pipe(ksSwitch(() => a))
      .pipe(ksSwitch(() => a))
      .pipe(ksSwitch(() => a))
      .pipe(ksSwitch(() => a));
    expect(await stackOut(b)).toEqual([42, 42]);
  });

  it('should stop emitting values after unsubscribe', async () => {
    const s = ksTimeout(0, ksShare).pipe(
      ksTap({
        next: () => {
          unsubscribe();
        },
      }),
    );
    let x = 1;
    const { unsubscribe } = s.subscribe({ next: v => (x = v) });
    await stackOut(ksTimeout(10));
    expect(x).toBe(1);
    unsubscribe();
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
    sub.unsubscribe();
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
    const { unsubscribe } = s.subscribe({});
    expect(s._unsafeLastValue()).toEqual(42);
    unsubscribe();
  });

  it('should try to emit last value with blank observer', async () => {
    const s = ksPeriodic(0, ksShareReplay).pipe(ksTake(2));
    const sub1 = s.subscribe({});
    const sub2 = s.subscribe({});
    expect(await stackOut(s)).toEqual([0, 1]);
    sub1.unsubscribe();
    sub2.unsubscribe();
  });

  it('should reset completed stream after all unsubscribes', async () => {
    let result: unknown = null;
    let counter = 0;
    const stream = ksShareReplay<number>(o => {
      o.next(++counter);
      o.complete();
      return noopUnsubscribe;
    });
    const next = (x: number) => (result = x);
    const sub1 = stream.subscribe({ next }); // counter = 1
    const sub2 = stream.subscribe({ next }); // counter = 1
    sub1.unsubscribe();
    sub2.unsubscribe();
    stream.subscribe({ next }).unsubscribe(); // counter = 2
    expect(result).toBe(2);
  });

  it('should replay value on completed stream', async () => {
    const s = ksShareReplay(o => {
      o.next(1);
      o.complete();
      return noopUnsubscribe;
    });
    s.subscribe({});
    expect(await stackOut(s)).toEqual([1]);
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
    expect((await stackOut(s))[0]!()).toBe(random);
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

  it('should unsubscribe after create new subscription on projected stream', async () => {
    let count = 0;
    const a = ksShareReplay(o => {
      o.next(++count);
      o.complete();
      return noopUnsubscribe;
    });
    const b = ksSubject();
    const { unsubscribe } = b
      .pipe(ksSwitch(() => a.pipe(ksMap(x => x))))
      .subscribe({});
    b.next(null);
    b.next(null);
    unsubscribe();
    expect(count).toBe(1);
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
  it('should be empty', () => {
    expect(ksTake(-1)).toBe(ksEmpty);
    expect(ksTake(0)).toBe(ksEmpty);
  });

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

  const ksAsapScheduler: Scheduler = {
    schedule: handler => {
      let on = true;
      Promise.resolve(() => on && handler());
      return { unsubscribe: () => (on = false) };
    },
  };

  const a = ksPeriodic(16, undefined, ksAsapScheduler)
    .pipe(
      ksSwitch(n => {
        return ksConcat(
          ksOf(n),
          ksTimeout(200, undefined, ksAsapScheduler)
            .pipe(ksMapTo(random))
            .pipe(ksTake(1)),
        );
      }),
    )
    .pipe(ksMap(x => x * x))
    .pipe(ksPairwise())
    .pipe(ksTap({}))
    .pipe(ksTakeUntil(ksTimeout(ms)));

  const b = timer(0, 16, asapScheduler).pipe(
    switchMap(n => {
      return concat(
        of(n),
        timer(200, asapScheduler).pipe(mapTo(random), take(1)),
      );
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
  it('should test empty observer', () => {
    const s = ksBehaviourSubject(1);
    const sub = s.subscribe({});
    s.next(2);
    s.complete();
    sub.unsubscribe();
  });

  it('should emit last value after subscribe', async () => {
    const r = { v: 0, c: false, emitted: false };
    const s = ksBehaviourSubject(0);
    s.next(s.getValue() + 1);
    s.next(s.getValue() + 1);
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
      s.next(s.getValue() + i);
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
    s.next(s.getValue() + 1);
    s.subscribe({ next }).unsubscribe();
    s.next(s.getValue() + 1);
    s.subscribe({ next }).unsubscribe();
    s.next(s.getValue() + 1);
    expect(count).toEqual(2);
  });

  it('should not emit values after complete', async () => {
    const s = ksBehaviourSubject(1);
    const a = stackOut(s);
    s.complete();
    s.complete();
    s.next(2);
    expect(s.getValue()).toBe(1);
    expect(await a).toEqual([1]);
  });

  it('should test subscribe blank observer after complete', async () => {
    const s = ksBehaviourSubject(1);
    s.complete();
    const { unsubscribe } = s.subscribe({});
    expect(await stackOut(s)).toEqual([1]);
    unsubscribe();
  });

  it('should emit same values on multiple subscription', async () => {
    const s = ksBehaviourSubject(0);
    const a = stackOut(s);
    const b = stackOut(s);
    s.next(s.getValue() + 1);
    s.next(s.getValue() + 1);
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

  it('should stop emitting values after unsubscribe', async () => {
    const a = ksBehaviourSubject<number>(0);
    const s = a.pipe(ksDelay(0)).pipe(
      ksTap({
        next: () => {
          unsubscribe();
        },
      }),
    );
    let x = 1;
    const { unsubscribe } = s.subscribe({ next: v => (x = v) });
    await stackOut(ksTimeout(10));
    expect(x).toBe(1);
    unsubscribe();
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
  });

  it('should test initial last value', () => {
    expect(ksSubject()._unsafeLastValue()).toBeUndefined();
  });

  it('should test empty observer', () => {
    const s = ksSubject();
    const sub = s.subscribe({});
    s.next(1);
    s.complete();
    sub.unsubscribe();
  });

  it('should stop emitting values after unsubscribe', async () => {
    const a = ksSubject<number>();
    const s = a.pipe(
      ksTap({
        next: () => {
          unsubscribe();
        },
      }),
    );
    let x = 1;
    const { unsubscribe } = s.subscribe({ next: v => (x = v) });
    a.next(0);
    expect(x).toBe(1);
    unsubscribe();
  });

  it('should ignore next value on completed subject', async () => {
    const s = ksSubject();
    s.next(42);
    s.complete();
    s.complete();
    s.next(43);
    expect(s.subscribe({})).toBe(noopUnsubscribe);
    expect(s._unsafeLastValue()).toBe(42);
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

describe('ksPairwise', () => {
  it('should emit the previous and current values as an array', async () => {
    const s = ksCold(({ next, complete }) => {
      next(1);
      next(2);
      next(3);
      complete();
      return noopUnsubscribe;
    }).pipe(ksPairwise());
    expect(await stackOut(s)).toEqual([
      [1, 2],
      [2, 3],
    ]);
  });
});

describe('ksRepeat', () => {
  it('should consider negative count as no repeat, and return EMPTY', async () => {
    const s = ksOf(42).pipe(ksRepeat(-1));
    expect(await stackOut(s)).toEqual([]);
  });

  it('should complete without emit when count is zero', async () => {
    const s = ksOf(42).pipe(ksRepeat(0));
    expect(await stackOut(s)).toEqual([]);
  });

  it('should emit source once when count is one', async () => {
    const s = ksOf(42).pipe(ksRepeat(1));
    expect(await stackOut(s)).toEqual([42]);
  });

  it('should repeats an observable on completion', async () => {
    const s = ksOf(42).pipe(ksRepeat(3));
    expect(await stackOut(s)).toEqual([42, 42, 42]);
  });

  it('should always teardown before starting the next cycle', async () => {
    const results: unknown[] = [];
    const source = ksCold<number>(observer => {
      Promise.resolve().then(() => {
        observer.next(1);
        Promise.resolve().then(() => {
          observer.next(2);
          Promise.resolve().then(() => {
            observer.complete();
          });
        });
      });
      return {
        unsubscribe: () => {
          results.push('teardown');
        },
      };
    });

    await new Promise<void>(resolve => {
      const sub = source.pipe(ksRepeat(3)).subscribe({
        next: value => results.push(value),
        complete: () => {
          sub.unsubscribe();
          resolve();
        },
      });
    });

    expect(results).toEqual([
      1,
      2,
      'teardown',
      1,
      2,
      'teardown',
      1,
      2,
      'teardown',
    ]);
  });

  it('should always teardown before starting the next cycle, even when synchronous', () => {
    const results: unknown[] = [];
    const source = ksCold<number>(observer => {
      observer.next(1);
      observer.next(2);
      observer.complete();
      return {
        unsubscribe: () => {
          results.push('teardown');
        },
      };
    });
    source
      .pipe(ksRepeat(3))
      .subscribe({
        next: value => results.push(value),
        complete: () => results.push('complete'),
      })
      .unsubscribe();

    expect(results).toEqual([
      1,
      2,
      'teardown',
      1,
      2,
      'teardown',
      1,
      2,
      'complete',
      'teardown',
    ]);
  });
});

describe('ksRepeatWhen', () => {
  it('should repeat when notified via returned notifier on complete', async () => {
    let retried = 0;
    const s = ksConcat(ksOf(1), ksOf(2)).pipe(
      ksRepeatWhen(notifications => {
        return notifications
          .pipe(ksTakeWhile(() => retried <= 2))
          .pipe(ksTap({ next: () => retried++ }));
      }),
    );
    expect(await stackOut(s)).toEqual([1, 2, 1, 2, 1, 2, 1, 2]);
  });
});

describe('ksRetryWhen', () => {
  it('should retry when notified via returned notifier', async () => {
    let retried = 0;
    const s = ksConcat(ksOf(1), ksConcat(ksOf(2), ksOf(3)))
      .pipe(ksMap(n => (n === 3 ? left(String(n)) : right(n))))
      .pipe(
        ksRetryWhen(errors => {
          return errors.pipe(
            ksMap(error => (++retried < 2 ? none : some(error))),
          );
        }),
      );
    expect(await stackOut(s)).toEqual([
      right(1),
      right(2),
      right(1),
      right(2),
      left('3'),
    ]);
  });

  it('should skip errors sync', async () => {
    const attempts = [
      [left(0)],
      [left(1), right(2), left(3), right(4)],
      [right(5)],
    ];

    const s = ksCold<Either<number, number>>(o => {
      attempts.shift()?.forEach(o.next);
      o.complete();
      return noopUnsubscribe;
    }).pipe(ksRetryWhen(errors => errors.pipe(ksMapTo(none))));

    expect(await stackOut(s)).toEqual([right(2), right(4)]);
  });

  it('should skip errors async', async () => {
    const attempts = [
      [left(0)],
      [left(1), right(2), left(3), right(4)],
      [right(5)],
    ];

    const s = ksCold<Either<number, number>>(o => {
      const a = (attempts.shift() ?? []).map(x => {
        return new Promise<CallableFunction>(resolve => {
          setTimeout(() => resolve(() => o.next(x)), 100);
        });
      });
      a.push(
        new Promise<CallableFunction>(resolve => {
          setTimeout(() => resolve(() => o.complete()), 100);
        }),
      );
      (async () => {
        for await (const f of a) f();
      })();
      return noopUnsubscribe;
    }).pipe(ksRetryWhen(errors => errors.pipe(ksMapTo(none))));

    expect(await stackOut(s)).toEqual([right(5)]);
  });
});

describe('ksWithLatestFrom', () => {
  it('should combine events from cold observables', async () => {
    const a = ksCold<number>(({ next, complete }) => {
      next(1);
      next(2);
      complete();
      return noopUnsubscribe;
    });
    const b = ksCold<string>(({ next, complete }) => {
      next('a');
      next('b');
      complete();
      return noopUnsubscribe;
    });
    const c = ksCold<string>(({ next, complete }) => {
      next('c');
      next('d');
      complete();
      return noopUnsubscribe;
    });
    const s = a.pipe(ksWithLatestFrom(b)).pipe(ksWithLatestFrom(c));
    expect(await stackOut(s)).toEqual([
      [[1, 'b'], 'd'],
      [[2, 'b'], 'd'],
    ]);
  });
});

describe('ksAudit', () => {
  it('should ignore for time based on provided observable, then emit most recent value.', async () => {
    const s = ksInterval(50)
      .pipe(ksTakeWhile(x => x < 40))
      .pipe(ksAudit(n => ksInterval(n * 10)));
    expect(await stackOut(s)).toEqual([
      0, 1, 2, 3, 4, 5, 7, 9, 11, 14, 17, 21, 26, 32, 39,
    ]);
  });

  it('should emit no values if durations are EMPTY', async () => {
    const s = ksConcat(ksOf(1), ksOf(2))
      .pipe(ksAudit(ksEmpty))
      .pipe(ksTakeUntil(ksTimeout(1000)));
    expect(await stackOut(s)).toEqual([]);
  });
});

describe('performance', () => {
  it('maximum call stack size exceeded', () => {
    const m = ksMap((x: number) => x + 1);
    let s = ksOf(0);
    const max = 2_521;
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

describe('diamond problem (glitches)', () => {
  test('rxjs with display name', () => {
    const firstName = new BehaviorSubject('John');
    const lastName = new BehaviorSubject('Doe');
    const isFirstNameShort = firstName.pipe(
      map(n => n.length < 10),
      shareReplay(1),
    );
    const fullName = combineLatest([firstName, lastName]).pipe(
      map(([first, last]) => `${first} ${last}`),
      shareReplay(1),
    );
    const displayName = isFirstNameShort.pipe(
      switchMap(short => (short ? fullName : firstName)),
      shareReplay(1),
    );

    const view = jest.fn();
    const sub = displayName.subscribe({ next: view });
    expect(view.mock.calls.length).toBe(1);

    firstName.next('Joseph');
    expect(view.mock.calls.length).toBe(3);

    firstName.next('Jooooooooooooooseph');
    expect(view.mock.calls.length).toBe(4);

    sub.unsubscribe();
  });

  test('k-stream with display name', () => {
    const firstName = ksBehaviourSubject('John');
    const lastName = ksBehaviourSubject('Doe');
    const isFirstNameShort = firstName.pipe(ksMap(n => n.length < 10));
    const fullName = ksCombineLatest(firstName, lastName).pipe(
      ksMap(([first, last]) => `${first} ${last}`),
    );
    const displayName = isFirstNameShort.pipe(
      ksSwitch(short => (short ? fullName : firstName)),
    );

    const view = jest.fn();
    const { unsubscribe } = displayName.subscribe({ next: view });
    expect(view.mock.calls.length).toBe(1);
    expect(displayName._unsafeLastValue()).toBe('John Doe');

    firstName.next('Joseph');
    expect(view.mock.calls.length).toBe(2);
    expect(displayName._unsafeLastValue()).toBe('Joseph Doe');

    firstName.next('Jooooooooooooooseph');
    expect(view.mock.calls.length).toBe(5);
    expect(displayName._unsafeLastValue()).toBe('Jooooooooooooooseph');

    expect(view.mock.calls.map(args => args[0])).toEqual([
      'John Doe',
      'Joseph Doe',
      'Jooooooooooooooseph Doe',
      'Jooooooooooooooseph',
      'Jooooooooooooooseph',
    ]);

    unsubscribe();
  });

  test('alphabet glitches', async () => {
    const alphabet = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const a = ksPeriodic(0); // 0-----1-----2-----3-----4------
    const b = a.pipe(ksMap(i => alphabet[i])); // a-----b-----c-----d-----e------
    const c = a.pipe(ksMap(i => i * i)); // 0-----1-----4-----9-----16-----
    const d = ksCombineLatest(b, c)
      .pipe(ksMap(([_1, _2]) => `${_1}${_2}`))
      .pipe(ksTake(alphabet.length));
    expect(await stackOut(d)).toEqual([
      'a0',
      'b0',
      'b1',
      'c1',
      'c4',
      'd4',
      'd9',
      'e9',
    ]);
  });

  test('alphabet right way', async () => {
    const alphabet = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const a = ksPeriodic(1).pipe(ksTake(alphabet.length)); // 0-----1-----2-----3-----4----
    const d = a.pipe(ksMap(i => alphabet[i]!.concat(String(i * i)))); // a0----b1----c4----d9----e16--
    expect(await stackOut(d)).toEqual([
      'a0',
      'b1',
      'c4',
      'd9',
      'e16',
      'f25',
      'g36',
      'h49',
    ]);
  });
});

describe('Monad laws', () => {
  const equivalence = async <T>(a: Stream<T>, b: Stream<T>) => {
    expect(await stackOut(a)).toEqual(await stackOut(b));
  };

  it('Left identity', async () => {
    const a = Math.random();
    const ma = ksOf(a);
    const f = (x: number) => ksOf(x * 2);
    await equivalence(ma.pipe(ksSwitch(f)), f(a));
  });

  it('Right identity', async () => {
    const ma = ksOf(Math.random());
    await equivalence(ma.pipe(ksSwitch(ksOf)), ma);
  });

  it('Associativity', async () => {
    const ma = ksOf(2);
    const f = (x: number) => ksOf(x * 4);
    const g = (x: number) => ksOf(x * 6);
    await equivalence(
      ma.pipe(ksSwitch(f)).pipe(ksSwitch(g)),
      ma.pipe(ksSwitch(x => f(x).pipe(ksSwitch(g)))),
    );
  });
});
