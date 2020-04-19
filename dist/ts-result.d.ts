export declare type Ok<T> = Readonly<{
  _tag: "Ok";
  ok: T;
}>;
export declare type Err<E> = Readonly<{
  _tag: "Err";
  err: E;
}>;
export declare type Result<T, E> = Ok<T> | Err<E>;
export declare const Ok: <T, E>(ok: T) => Result<T, E>;
export declare const Err: <T, E>(err: E) => Result<T, E>;
