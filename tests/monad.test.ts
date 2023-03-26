import { ksOf, ksSwitch, Stream } from '../src';
import { stackOut } from './utils';

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
