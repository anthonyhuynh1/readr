import { describe, expect, it } from 'vitest';
import { shouldShowWordKaraoke } from '../utils/readerViewUtils';

describe('shouldShowWordKaraoke', () => {
  it('enables word karaoke only on the active row while playing', () => {
    expect(shouldShowWordKaraoke(true, true, 2, 2)).toBe(true);
    expect(shouldShowWordKaraoke(true, true, 1, 2)).toBe(false);
    expect(shouldShowWordKaraoke(true, false, 2, 2)).toBe(false);
    expect(shouldShowWordKaraoke(false, true, 2, 2)).toBe(false);
  });
});
