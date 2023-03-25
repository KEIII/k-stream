export const SymbolOption = Symbol('Option');

export type Some<A> = Readonly<{
  [SymbolOption]: 'Some';
  value: A;
}>;

export type None = Readonly<{
  [SymbolOption]: 'None';
}>;

export type Option<A> = None | Some<A>;

export const isSome = <A>(fa: Option<A>): fa is Some<A> =>
  fa[SymbolOption] === 'Some';

export const isNone = <A>(fa: Option<A>): fa is None =>
  fa[SymbolOption] === 'None';

export const some = <A>(a: A): Option<A> =>
  Object.freeze({
    [SymbolOption]: 'Some',
    value: a,
  });

export const none: Option<never> = Object.freeze({ [SymbolOption]: 'None' });
