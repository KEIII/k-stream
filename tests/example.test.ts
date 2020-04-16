import { ksPeriodic as periodic } from "../src/factories";
import { KsBehaviour as Behaviour } from "../src/core";
import { ksFilter as filter, ksTake as take } from "../src/transformers";
import { Some, None } from "../src/ts-option";

const getLogOut = (fn: () => void) => {
  return new Promise((resolve) => {
    const org = console.log;
    const logs: unknown[] = [];
    const logger = (v: unknown) => {
      if (v === "complete!") {
        console.log = org;
        resolve(logs);
      } else {
        logs.push(v);
      }
    };
    console.log = jest.fn(logger);
    fn();
  });
};

it("should test example", async () => {
  const p = getLogOut(() => {
    const stream = periodic(100, Behaviour.SHARE_REPLAY)
      .pipe(filter((n) => (n % 2 === 0 ? Some(n) : None<typeof n>())))
      .pipe(take(10));

    stream.subscribe({
      next: console.log,
      complete: () => console.log("complete!"),
    });
  });
  expect(await p).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18]);
});
