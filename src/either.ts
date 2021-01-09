export type Left<E> = { _tag: 'Left'; left: E };

export type Right<A> = { _tag: 'Right'; right: A };

export type Either<E, A> = Left<E> | Right<A>;

export const left = <E = never, A = never>(e: E): Either<E, A> => {
  return { _tag: 'Left', left: e };
};

export const right = <E = never, A = never>(a: A): Either<E, A> => {
  return { _tag: 'Right', right: a };
};

export const isLeft = <E, A>(ma: Either<E, A>): ma is Left<E> => {
  return ma._tag === 'Left';
};

export const isRight = <E, A>(ma: Either<E, A>): ma is Right<A> => {
  return ma._tag === 'Right';
};
