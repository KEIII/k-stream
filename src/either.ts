export const SymbolEither = Symbol('Either');

export type Left<E> = Readonly<{
  [SymbolEither]: 'Left';
  left: E;
}>;

export type Right<A> = Readonly<{
  [SymbolEither]: 'Right';
  right: A;
}>;

export type Either<E, A> = Left<E> | Right<A>;

export const left = <E = never, A = never>(e: E): Either<E, A> => {
  return Object.freeze({ [SymbolEither]: 'Left', left: e });
};

export const right = <E = never, A = never>(a: A): Either<E, A> => {
  return Object.freeze({ [SymbolEither]: 'Right', right: a });
};

export const isLeft = <E, A>(ma: Either<E, A>): ma is Left<E> => {
  return ma[SymbolEither] === 'Left';
};

export const isRight = <E, A>(ma: Either<E, A>): ma is Right<A> => {
  return ma[SymbolEither] === 'Right';
};
