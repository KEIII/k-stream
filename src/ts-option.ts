export type Some<T> = Readonly<{ _tag: "Some"; some: T }>;

export type None = Readonly<{ _tag: "None" }>;

export type Option<T> = Some<T> | None;

export const Some = <T>(some: T): Option<T> => {
  return Object.freeze({ _tag: "Some", some });
};

export const None = <T>(): Option<T> => {
  return Object.freeze({ _tag: "None" });
};
