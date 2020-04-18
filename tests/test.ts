import { combineLatest, concat, forkJoin, merge, of, timer } from "rxjs";
import {
  map,
  mapTo,
  pairwise,
  switchMap,
  take,
  takeUntil,
  tap,
} from "rxjs/operators";
import { KsBehaviour, ksCreateStream, noop, SubscribeFn } from "../src/core";
import {
  ksChangeBehaviour,
  ksDebounce,
  ksFilter,
  ksMap,
  ksMapTo,
  ksPairwise,
  ksSwitch,
  ksTake,
  ksTakeUntil,
  ksTap,
  ksThrottle,
} from "../src/transformers";
import {
  ksCombineLatest,
  ksConcat,
  ksEmpty,
  ksForkJoin,
  ksFromPromise,
  ksInterval,
  ksMerge,
  ksOf,
  ksPeriodic,
  ksTimeout,
  ksToPromise,
} from "../src/factories";
import { None, Some } from "../src/ts-option";
import { Err, Ok } from "../src/ts-result";
import { ksSubject } from "../src/subject";

const getObservableOutput = <T>(observable: {
  subscribe: SubscribeFn<T>;
}): Promise<T[]> => {
  return new Promise<T[]>((resolve) => {
    const output: T[] = [];
    const subscription = observable.subscribe({
      next: (v) => output.push(v),
      complete: () => {
        resolve(output);
        setTimeout(() => subscription.unsubscribe());
      },
    });
  });
};

describe("ksFromPromise", () => {
  it("should create stream from promise and resolve", async () => {
    const random = Math.random();
    const out = await getObservableOutput(
      ksFromPromise<number, unknown>(Promise.resolve(random), KsBehaviour.COLD)
    );
    expect(out).toEqual([Ok(random)]);
  });

  it("should create stream from promise and reject", async () => {
    const random = Math.random();
    const out = await getObservableOutput(
      ksFromPromise<number, unknown>(Promise.reject(random), KsBehaviour.COLD)
    );
    expect(out).toEqual([Err(random)]);
  });

  it("should ignore result after unsubscribe", async () => {
    const promise = ksToPromise(ksTimeout(20, KsBehaviour.COLD));
    const stream = ksFromPromise(promise, KsBehaviour.COLD);
    let completed = false;
    stream.subscribe({ complete: () => (completed = true) }).unsubscribe();
    await promise;
    expect(completed).toBeFalsy();
  });
});

describe("ksToPromise", () => {
  it("should create promise from stream", async () => {
    const random = Math.random();
    const promise = ksToPromise(ksOf(random, KsBehaviour.COLD));
    expect(await promise).toEqual(Some(random));
  });
});

describe("KsBehaviour.COLD", () => {
  it("should ignore emits after complete", async () => {
    const s = ksCreateStream<number>(KsBehaviour.COLD, ({ next, complete }) => {
      next(1);
      complete();
      next(2);
      complete();
      return { unsubscribe: noop };
    });
    let result = 0;
    s.subscribe({ next: (v) => (result = v) });
    expect(result).toBe(1);
  });

  it("should emit different values", async () => {
    const numbers = [1, 2];
    const s = ksTimeout(0, KsBehaviour.COLD).pipe(ksMap(() => numbers.pop()));
    const a = getObservableOutput(s);
    const b = getObservableOutput(s);
    expect((await a)[0] !== (await b)[0]).toBeTruthy();
  });
});

describe("KsBehaviour.SHARE", () => {
  it("should create share stream", async () => {
    const s = ksOf(1, KsBehaviour.SHARE);
    expect(await getObservableOutput(s)).toEqual([1]);
  });

  it("should ignore emits after complete", async () => {
    const s = ksCreateStream<number>(
      KsBehaviour.SHARE,
      ({ next, complete }) => {
        next(1);
        complete();
        next(2);
        complete();
        return { unsubscribe: noop };
      }
    );
    let result = 0;
    s.subscribe({ next: (v) => (result = v) });
    expect(result).toBe(1);
  });

  it("should not emit after second subscribe", async () => {
    const s = ksOf(1, KsBehaviour.SHARE);
    let emitted = false;
    const s1 = s.subscribe({});
    const s2 = s.subscribe({ next: () => (emitted = true) });
    s1.unsubscribe();
    s2.unsubscribe();
    expect(emitted).toBeFalsy();
  });

  it("should emit same values", async () => {
    const numbers = [1, 2];
    const s = ksTimeout(0, KsBehaviour.SHARE).pipe(ksMap(() => numbers.pop()));
    const subscription = s.subscribe({});
    const a = getObservableOutput(s);
    const b = getObservableOutput(s);
    subscription.unsubscribe();
    expect(await a).toEqual(await b);
  });

  it("should not replay last value", async () => {
    const stream = ksInterval(100, KsBehaviour.SHARE);
    const sub = stream.subscribe({});
    const p = new Promise((resolve) => {
      setTimeout(() => {
        stream.pipe(ksTake(1)).subscribe({ next: resolve });
        sub.unsubscribe();
      }, 1000);
    });
    expect(await p).toEqual(9);
  });
});

describe("KsBehaviour.SHARE_REPLAY", () => {
  it("should replay last value", async () => {
    const stream = ksInterval(100, KsBehaviour.SHARE_REPLAY);
    const sub = stream.subscribe({});
    const p = new Promise((resolve) => {
      setTimeout(() => {
        stream.pipe(ksTake(1)).subscribe({ next: resolve });
        sub.unsubscribe();
      }, 1000);
    });
    expect(await p).toEqual(8);
  });
});

it("should map to value", async () => {
  const random = Math.random();
  const s = ksOf(0, KsBehaviour.SHARE).pipe(ksMapTo(random));
  expect(await getObservableOutput(s)).toEqual([random]);
});

it("should test tap", () => {
  const r = { v: 0, c: false };
  const s = ksOf(1, KsBehaviour.COLD).pipe(
    ksTap({ next: (v) => (r.v = v), complete: () => (r.c = true) })
  );
  s.subscribe({}).unsubscribe();
  expect(r).toEqual({ v: 1, c: true });
});

it("should complete after pipe", async () => {
  const random = Math.random();
  const s = getObservableOutput(
    ksOf(0, KsBehaviour.SHARE).pipe(ksMap(() => random))
  );
  expect(await s).toEqual(await s);
});

it("should change behaviour", async () => {
  const numbers = [1, 2];
  const s = ksTimeout(0, KsBehaviour.COLD)
    .pipe(ksChangeBehaviour(KsBehaviour.SHARE))
    .pipe(ksMap(() => numbers.pop()));
  const a = getObservableOutput(s);
  const b = getObservableOutput(s);
  expect(await a).toEqual(await b);
});

it("should filter skip odd (i.e emit only even)", async () => {
  const out = await getObservableOutput(
    ksPeriodic(0, KsBehaviour.COLD)
      .pipe(
        ksFilter((n) => {
          return !(n & 1) ? Some(n) : None<typeof n>();
        })
      )
      .pipe(ksTake(10))
  );
  expect(out).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18]);
});

it("should test periodic", async () => {
  const out = await getObservableOutput(
    ksPeriodic(0, KsBehaviour.COLD).pipe(ksTake(10))
  );
  expect(out).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

it("should create timeout", async () => {
  const out = await getObservableOutput(
    ksTimeout(1, KsBehaviour.COLD).pipe(ksTake(3))
  );
  expect(out).toEqual([0]);
});

it("should test forkJoin", async () => {
  const outA = getObservableOutput(
    ksForkJoin(
      ksPeriodic(1, KsBehaviour.COLD).pipe(ksTake(100)),
      ksPeriodic(10, KsBehaviour.COLD).pipe(ksTake(10))
    )
  );

  const outB = getObservableOutput<any>(
    forkJoin([timer(0, 1).pipe(take(100)), timer(0, 10).pipe(take(10))])
  );

  expect(await outA).toEqual(await outB);
});

describe("ksCombineLatest", () => {
  it("should combine latest", async () => {
    const limit = 100;
    const ms = 5;
    const s = ksPeriodic(ms, KsBehaviour.COLD).pipe(ksTake(limit));
    const r = timer(0, ms).pipe(take(limit));
    expect(await getObservableOutput(ksCombineLatest(s, s))).toEqual(
      await getObservableOutput(combineLatest([r, r]))
    );
  });
});

describe("ksThrottle", () => {
  it("should test throttling", async () => {
    const limit = 7;
    const ms = 250;
    const max = 600;

    const s = ksPeriodic(ms, KsBehaviour.COLD)
      .pipe(ksThrottle(max))
      .pipe(ksTake(limit));

    expect(await getObservableOutput(s)).toEqual([0, 3, 6, 9, 12, 15, 18]);
  });

  it("should main complete before throttle time", async () => {
    const random = Math.random();
    const s = ksOf(random, KsBehaviour.COLD).pipe(ksThrottle(100));
    expect(await getObservableOutput(s)).toEqual([random]);
  });
});

describe("ksDebounce", () => {
  it("should test debounce", async () => {
    const s = ksPeriodic(10, KsBehaviour.COLD)
      .pipe(ksTake(100))
      .pipe(ksDebounce(1000));

    expect(await getObservableOutput(s)).toEqual([99]);
  });
});

describe("ksSwitch", () => {
  it("should test switch", async () => {
    const project = (n: number) => {
      return ksConcat(ksOf(n, KsBehaviour.COLD), ksOf(n, KsBehaviour.COLD));
    };
    const s = ksPeriodic(1, KsBehaviour.COLD)
      .pipe(ksSwitch(project))
      .pipe(ksTake(10));
    expect(await getObservableOutput(s)).toEqual([
      0,
      0,
      1,
      1,
      2,
      2,
      3,
      3,
      4,
      4,
    ]);
  });

  it("should work like RxJS", async () => {
    const a = ksTimeout(0, KsBehaviour.COLD).pipe(
      ksSwitch(() => ksPeriodic(0, KsBehaviour.COLD).pipe(ksTake(10)))
    );
    const b = timer(0).pipe(switchMap(() => timer(0, 0).pipe(take(10))));
    expect(await getObservableOutput(a)).toEqual(await getObservableOutput(b));
  });

  it("should unsubscribe before project emits", async () => {
    const s = ksOf(0, KsBehaviour.COLD).pipe(ksSwitch(ksEmpty));
    expect(await getObservableOutput(s)).toEqual([]);
  });
});

describe("ksTakeUntil", () => {
  it("should complete main stream before notifier emits", async () => {
    const random = Math.random();
    const s = ksOf(random, KsBehaviour.COLD).pipe(
      ksTakeUntil(ksTimeout(1000, KsBehaviour.COLD))
    );
    expect(await getObservableOutput(s)).toEqual([random]);
  });

  it("should complete main stream after notifier emits", async () => {
    const stop = ksTimeout(2000, KsBehaviour.COLD);
    const s = ksPeriodic(100, KsBehaviour.COLD).pipe(ksTakeUntil(stop));
    expect((await getObservableOutput(s)).pop()).toBe(19);
  });

  it("should test notifier could emit multiple times", async () => {
    const stop = ksTimeout(2000, KsBehaviour.SHARE).pipe(
      ksSwitch(() => ksPeriodic(50, KsBehaviour.SHARE).pipe(ksTake(10)))
    );
    const a = getObservableOutput(
      ksPeriodic(50, KsBehaviour.COLD).pipe(ksTakeUntil(stop))
    );
    const b = getObservableOutput(stop);
    expect((await a).pop()).toBe(39);
    expect(await b).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("should properly unsubscribe", async () => {
    const s = ksOf(0, KsBehaviour.COLD).pipe(
      ksTakeUntil(ksOf(0, KsBehaviour.COLD))
    );
    expect(await getObservableOutput(s)).toEqual([0]);
  });

  it("should completes on empty", async () => {
    const s = ksInterval(1, KsBehaviour.COLD).pipe(ksTakeUntil(ksEmpty()));
    expect(await getObservableOutput(s)).toEqual([]);
  });

  it("should prevent pipe usage", () => {
    const f = () => {
      ksOf(0, KsBehaviour.COLD).pipe(ksTakeUntil(ksEmpty())).pipe(ksMapTo(0));
    };
    expect(f).toThrow();
  });
});

describe("ksTake", () => {
  it("should complete main stream before notifier emits", async () => {
    const random = Math.random();
    const s = ksOf(random, KsBehaviour.COLD).pipe(ksTake(1));
    expect(await getObservableOutput(s)).toEqual([random]);
  });

  it("should complete main stream after notifier emits", async () => {
    const s = ksPeriodic(100, KsBehaviour.COLD).pipe(ksTake(2));
    expect(await getObservableOutput(s)).toEqual([0, 1]);
  });
});

it("should works like RxJS (in some cases ;)", async () => {
  const ms = 4500;
  const random = Math.random();

  const a = ksPeriodic(10, KsBehaviour.COLD)
    .pipe(
      ksSwitch((n) => {
        return ksConcat(
          ksOf(n, KsBehaviour.COLD),
          ksTimeout(200, KsBehaviour.COLD).pipe(ksMapTo(random)).pipe(ksTake(1))
        );
      })
    )
    .pipe(ksMap((x) => x * x))
    .pipe(ksPairwise())
    .pipe(ksTap({}))
    .pipe(ksTakeUntil(ksTimeout(ms, KsBehaviour.COLD)));

  const b = timer(0, 10).pipe(
    switchMap((n) => {
      return concat(of(n), timer(200).pipe(mapTo(random), take(1)));
    }),
    map((x) => x * x),
    pairwise(),
    tap(() => {}),
    takeUntil(timer(ms))
  );

  const aa = getObservableOutput(
    ksMerge(ksCombineLatest(a, a), ksCombineLatest(a, a))
  );
  const bb = getObservableOutput<any>(
    merge(combineLatest([b, b]), combineLatest([b, b]))
  );
  const aaa = await aa;
  const bbb = await bb;
  const size = Math.min(aaa.length, bbb.length);

  expect(aaa.slice(0, size)).toEqual(bbb.slice(0, size));
});

describe("ksSubject", () => {
  it("should emit last value after subscribe", async () => {
    const r = { v: 0, c: false, emitted: false };
    const s = ksSubject(0);
    s.value++;
    s.value++;
    s.complete();
    s.subscribe({
      next: (v) => (r.v = v),
      complete: () => (r.c = true),
    }).unsubscribe();
    r.v = 0;
    r.c = false;
    s.subscribe({
      next: (v) => {
        r.v = v;
        r.emitted = true;
      },
      complete: () => (r.c = true),
    }).unsubscribe();
    expect(r).toEqual({ v: 2, c: true, emitted: true });
  });

  it("should test subject", async () => {
    const s = ksSubject(0);
    const p = getObservableOutput(s);
    for (let i = 1; i < 10; ++i) {
      s.value += i;
    }
    s.complete();
    expect(s.isCompleted).toBeTruthy();
    expect(await p).toEqual([0, 1, 3, 6, 10, 15, 21, 28, 36, 45]);
    expect(await getObservableOutput(s)).toEqual([45]);
  });

  it("should unsubscribe properly", () => {
    const s = ksSubject(0);
    let count = 0;
    const next = () => count++;
    s.value++;
    s.subscribe({ next }).unsubscribe();
    s.value++;
    s.subscribe({ next }).unsubscribe();
    s.value++;
    expect(count).toEqual(2);
  });

  it("should not emit values after complete", async () => {
    const s = ksSubject(1);
    s.complete();
    s.value = 2;
    expect(s.value).toBe(1);
    expect(await getObservableOutput(s)).toEqual([1]);
  });

  it("should emit same values on multiple subscription", async () => {
    const s = ksSubject(0);
    const a = getObservableOutput(s);
    const b = getObservableOutput(s);
    s.value++;
    s.value++;
    s.complete();
    expect(await a).toEqual(await b);
  });

  it("should accept partial observer", () => {
    expect(ksSubject(0).subscribe({}).unsubscribe()).toBeUndefined();
  });
});
