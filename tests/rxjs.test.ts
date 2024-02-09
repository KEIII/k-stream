import {
  ksCombineLatest,
  ksConcat,
  ksMap,
  ksMapTo,
  ksMerge,
  ksOf,
  ksPairwise,
  ksPeriodic,
  ksSwitch,
  ksTake,
  ksTakeUntil,
  ksTap,
  ksTimeout,
  Scheduler,
} from '../src';
import { asapScheduler, combineLatest, concat, merge, of, timer } from 'rxjs';
import {
  map,
  mapTo,
  pairwise,
  switchMap,
  take,
  takeUntil,
  tap,
} from 'rxjs/operators';
import { stackOut } from './utils';

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

  const aa = stackOut(
    ksMerge(ksCombineLatest([a, a]), ksCombineLatest([a, a])),
  );
  const bb = stackOut<any>(merge(combineLatest([b, b]), combineLatest([b, b])));
  const aaa = await aa;
  const bbb = await bb;
  const size = Math.min(aaa.length, bbb.length);

  expect(aaa.slice(0, size)).toEqual(bbb.slice(0, size));
});
