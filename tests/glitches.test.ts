import { BehaviorSubject, combineLatest } from 'rxjs';
import { map, shareReplay, switchMap } from 'rxjs/operators';
import {
  ksBehaviourSubject,
  ksCombineLatest,
  ksMap,
  ksPeriodic,
  ksSwitch,
  ksTake,
} from '../src';
import { stackOut } from './utils';

describe('diamond problem (glitches)', () => {
  test('rxjs with display name', () => {
    const firstName = new BehaviorSubject('John');
    const lastName = new BehaviorSubject('Doe');
    const isFirstNameShort = firstName.pipe(
      map(n => n.length < 10),
      shareReplay(1),
    );
    const fullName = combineLatest([firstName, lastName]).pipe(
      map(([first, last]) => `${first} ${last}`),
      shareReplay(1),
    );
    const displayName = isFirstNameShort.pipe(
      switchMap(short => (short ? fullName : firstName)),
      shareReplay(1),
    );

    const view = jest.fn();
    const sub = displayName.subscribe({ next: view });
    expect(view.mock.calls.length).toBe(1);

    firstName.next('Joseph');
    expect(view.mock.calls.length).toBe(3);

    firstName.next('Jooooooooooooooseph');
    expect(view.mock.calls.length).toBe(4);

    sub.unsubscribe();
  });

  test('k-stream with display name', () => {
    const firstName = ksBehaviourSubject('John');
    const lastName = ksBehaviourSubject('Doe');
    const isFirstNameShort = firstName.pipe(ksMap(n => n.length < 10));
    const fullName = ksCombineLatest(firstName, lastName).pipe(
      ksMap(([first, last]) => `${first} ${last}`),
    );
    const displayName = isFirstNameShort.pipe(
      ksSwitch(short => (short ? fullName : firstName)),
    );

    const view = jest.fn();
    const { unsubscribe } = displayName.subscribe({ next: view });
    expect(view.mock.calls.length).toBe(1);
    expect(displayName.snapshot()).toBe('John Doe');

    firstName.next('Joseph');
    expect(view.mock.calls.length).toBe(2);
    expect(displayName.snapshot()).toBe('Joseph Doe');

    firstName.next('Jooooooooooooooseph');
    expect(view.mock.calls.length).toBe(5);
    expect(displayName.snapshot()).toBe('Jooooooooooooooseph');

    expect(view.mock.calls.map(args => args[0])).toEqual([
      'John Doe',
      'Joseph Doe',
      'Jooooooooooooooseph Doe',
      'Jooooooooooooooseph',
      'Jooooooooooooooseph',
    ]);

    unsubscribe();
  });

  test('alphabet glitches', async () => {
    const alphabet = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const a = ksPeriodic(0); // 0-----1-----2-----3-----4------
    const b = a.pipe(ksMap(i => alphabet[i])); // a-----b-----c-----d-----e------
    const c = a.pipe(ksMap(i => i * i)); // 0-----1-----4-----9-----16-----
    const d = ksCombineLatest(b, c)
      .pipe(ksMap(([_1, _2]) => `${_1}${_2}`))
      .pipe(ksTake(alphabet.length));
    expect(await stackOut(d)).toEqual([
      'a0',
      'b0',
      'b1',
      'c1',
      'c4',
      'd4',
      'd9',
      'e9',
    ]);
  });

  test('alphabet right way', async () => {
    const alphabet = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const a = ksPeriodic(1).pipe(ksTake(alphabet.length)); // 0-----1-----2-----3-----4----
    const d = a.pipe(ksMap(i => alphabet[i]!.concat(String(i * i)))); // a0----b1----c4----d9----e16--
    expect(await stackOut(d)).toEqual([
      'a0',
      'b1',
      'c4',
      'd9',
      'e16',
      'f25',
      'g36',
      'h49',
    ]);
  });
});
