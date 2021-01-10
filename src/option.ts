export type Some<A> = {
  readonly _tag: 'Some';
  readonly value: A;
};

export type None = {
  readonly _tag: 'None';
};

export type Option<A> = None | Some<A>;

export const isSome = <A>(fa: Option<A>): fa is Some<A> => fa._tag === 'Some';

export const isNone = <A>(fa: Option<A>): fa is None => fa._tag === 'None';

export const some = <A>(a: A): Option<A> => ({ _tag: 'Some', value: a });

export const none: Option<never> = { _tag: 'None' };
