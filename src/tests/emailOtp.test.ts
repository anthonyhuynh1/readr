import { describe, expect, it } from 'vitest';
import { canSubmitEmailOtp, isValidEmailOtp } from '../utils/emailOtp';

describe('emailOtp', () => {
  it('accepts 6- and 8-digit codes', () => {
    expect(isValidEmailOtp('123456')).toBe(true);
    expect(isValidEmailOtp('12345678')).toBe(true);
    expect(isValidEmailOtp('12345')).toBe(false);
    expect(isValidEmailOtp('12345678901')).toBe(false);
  });

  it('allows submit once minimum length reached', () => {
    expect(canSubmitEmailOtp('12345')).toBe(false);
    expect(canSubmitEmailOtp('123456')).toBe(true);
    expect(canSubmitEmailOtp('12345678')).toBe(true);
  });
});
