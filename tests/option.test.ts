import { Option, some, none } from '../src';

const unwrapBySwitchStatement = <T>(o: Option<T>): T | null => {
  switch (o._tag) {
    case 'Some': {
      return o.value;
    }
    case 'None': {
      return null;
    }
    default: {
      // Unreachable: check that a switch block is exhaustive
      const _: never = o;
      throw new Error(_);
    }
  }
};

const unwrapByIfStatement = <T>(o: Option<T>): T | null => {
  return o._tag === 'Some' ? o.value : null;
};

describe('Option', () => {
  it('should unwrap some value', () => {
    expect(unwrapBySwitchStatement(some(42))).toEqual(42);
    expect(unwrapByIfStatement(some(42))).toEqual(42);
  });

  it('should unwrap none value', () => {
    expect(unwrapBySwitchStatement(none)).toEqual(null);
    expect(unwrapByIfStatement(none)).toEqual(null);
  });
});
