import { Either, SymbolEither, left, right } from '../src';

const unwrapBySwitchStatement = <T>(ma: Either<string, T>): T => {
  switch (ma[SymbolEither]) {
    case 'Left': {
      throw ma.left;
    }
    case 'Right': {
      return ma.right;
    }
    default: {
      // Unreachable: check that a switch block is exhaustive
      const _: never = ma;
      throw _;
    }
  }
};

const unwrapByIfStatement = <T>(ma: Either<string, T>): T => {
  if (ma[SymbolEither] === 'Right') return ma.right;
  throw ma.left;
};

describe('Either', () => {
  it('should unwrap right value', () => {
    expect(unwrapBySwitchStatement(right(42))).toEqual(42);
    expect(unwrapByIfStatement(right(42))).toEqual(42);
  });

  it('should unwrap left value', () => {
    expect(() => {
      return unwrapBySwitchStatement(left('some error'));
    }).toThrow('some error');
    expect(() => {
      return unwrapByIfStatement(left('some error'));
    }).toThrow('some error');
  });
});
