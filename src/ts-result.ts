export type Ok<T> = Readonly<{ _tag: 'Ok'; ok: T }>;

export type Err<E> = Readonly<{ _tag: 'Err'; err: E }>;

export type Result<T, E> = Ok<T> | Err<E>;

export const Ok = <T, E>(ok: T): Result<T, E> => {
  return Object.freeze({ _tag: 'Ok', ok });
};

export const Err = <T, E>(err: E): Result<T, E> => {
  return Object.freeze({ _tag: 'Err', err });
};
