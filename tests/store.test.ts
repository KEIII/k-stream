import {
  ksBehaviourSubject,
  ksScan,
  ksSubject,
  BehaviourSubject,
  ksFilterMap,
  some,
  none,
  ksMap,
  Stream,
} from '../src';
import { Unsubscribable } from 'rxjs';

type Action<T, P> = { type: T; payload: P };

type Reducer<S, P> = (state: S, payload: P) => S;

type ReducersMap<S, R> = {
  [K in keyof R]: R[K] extends Reducer<S, infer P> ? Reducer<S, P> : never;
};

type StoreParameters<S, R extends ReducersMap<S, R>> = {
  initialState: S;
  reducers: R;
  effects: (
    ofType: OfType<S, R>,
    actions: ActionCreators<S, R>,
    stream: BehaviourSubject<S>,
  ) => Stream<
    {
      [K in keyof R]: R[K] extends Reducer<S, infer P> ? Action<K, P> : never;
    }[keyof R]
  >[];
};

type ActionDispatchers<S, R> = {
  [K in keyof R]: R[K] extends Reducer<S, infer P>
    ? (payload: P) => void
    : never;
};

type ActionCreators<S, R extends ReducersMap<S, R>> = {
  [K in keyof R]: R[K] extends Reducer<S, infer P>
    ? (payload: P) => Action<K, P>
    : never;
};

type OfType<S, R> = {
  [K in keyof R]: R[K] extends Reducer<S, infer P> ? Stream<P> : never;
};

type Store<S, R> = {
  stateStream: BehaviourSubject<S>;
  dispatch: ActionDispatchers<S, R>;
  teardown: () => void;
};

const ksOfType = <T, P>(type: T) => {
  return ksFilterMap((action: Action<T, P>) => {
    return action.type === type ? some(action.payload) : none;
  });
};

const ksCreateStore = <S, R extends ReducersMap<S, R>>({
  initialState,
  reducers,
  effects,
}: StoreParameters<S, R>): Store<S, R> => {
  const actionsStream = ksSubject<Action<keyof R, unknown>>();
  const stateStream = ksBehaviourSubject(initialState);
  const actionTypes = Object.keys(reducers) as (keyof R)[];

  const ofType = ((): OfType<S, R> => {
    const obj: any = {};
    actionTypes.forEach(type => {
      obj[type] = actionsStream.pipe(ksOfType(type));
    });
    return obj;
  })();

  const actions = ((): ActionCreators<S, R> => {
    const obj: any = {};
    actionTypes.forEach(type => {
      obj[type] = (payload: unknown) => {
        return { type, payload };
      };
    });
    return obj;
  })();

  const dispatch = ((): ActionDispatchers<S, R> => {
    const obj: any = {};
    actionTypes.forEach(type => {
      obj[type] = (payload: unknown) => {
        actionsStream.next({ type, payload });
      };
    });
    return obj;
  })();

  const reducer = <P>(state: S, { type, payload }: Action<keyof R, P>): S => {
    return reducers[type](state, payload);
  };

  const subscriptions: Unsubscribable[] = [];

  subscriptions.push(
    actionsStream
      .pipe(ksScan(reducer, initialState))
      .subscribe({ next: stateStream.next }),
  );

  effects(ofType, actions, stateStream).forEach(effect => {
    subscriptions.push(effect.subscribe({ next: actionsStream.next }));
  });

  return {
    stateStream,
    dispatch,
    teardown: () => {
      let subscription: Unsubscribable | undefined;
      while ((subscription = subscriptions.pop())) {
        subscription.unsubscribe();
      }
    },
  };
};

describe('store', () => {
  it('should create redux like store', () => {
    const initialState = { count: 0 };
    type State = typeof initialState;
    const store = ksCreateStore({
      initialState,
      reducers: {
        increment: (state: State, payload: number) => ({
          count: state.count + payload,
        }),
        decrement: (state: State, payload: string) => ({
          count: state.count - Number(payload),
        }),
      },
      effects: (ofType, actions, stream) => [
        ofType.increment.pipe(
          ksMap(() => {
            return Math.random() > 0.5
              ? actions.decrement(String(stream.value.count))
              : { type: 'decrement', payload: String(stream.value.count) };
          }),
        ),
      ],
    });
    store.dispatch.increment(2);
    store.dispatch.decrement('3');
    expect(store.stateStream.value).toEqual({ count: -3 });
    store.teardown();
  });
});
