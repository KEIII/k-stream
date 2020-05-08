export declare type Some<T> = Readonly<{
    _tag: 'Some';
    some: T;
}>;
export declare type None = Readonly<{
    _tag: 'None';
}>;
export declare type Option<T> = Some<T> | None;
export declare const Some: <T>(some: T) => Option<T>;
export declare const None: <T>(_?: T | undefined) => Option<T>;
