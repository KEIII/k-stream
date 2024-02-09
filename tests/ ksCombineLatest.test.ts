import { ksCombineLatest, ksNever } from '../src';

describe('ksCombineLatest', () => {
  it('should return ksNever for empty inputs', () => {
    expect(ksCombineLatest([])).toBe(ksNever);
  });
});
