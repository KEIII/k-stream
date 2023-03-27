import { none, some, ksFilterMap, ksPeriodic, ksTake, ksShare } from '../src';

const getLogOut = (f: () => void) => {
  return new Promise(resolve => {
    const org = console.log;
    const logs: unknown[] = [];
    const logger = (v: unknown) => {
      if (v === 'complete!') {
        console.log = org;
        resolve(logs);
      } else {
        logs.push(v);
      }
    };
    console.log = jest.fn(logger);
    f();
  });
};

it('should test example', async () => {
  const p = getLogOut(() => {
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
  });
  expect(await p).toEqual([
    '00000000',
    '00000010',
    '00000100',
    '00000110',
    '00001000',
    '00001010',
    '00001100',
    '00001110',
    '00010000',
    '00010010',
  ]);
});
