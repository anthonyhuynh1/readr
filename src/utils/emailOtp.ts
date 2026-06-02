/** Supabase email OTP length (hosted projects may use 6 or 8 digits). */
export const EMAIL_OTP_MIN_LENGTH = 6;
export const EMAIL_OTP_MAX_LENGTH = 10;

export function isValidEmailOtp(token: string): boolean {
  const code = token.trim();
  return new RegExp(
    `^\\d{${EMAIL_OTP_MIN_LENGTH},${EMAIL_OTP_MAX_LENGTH}}$`,
  ).test(code);
}

/** Enable Verify while the user is typing a numeric code within length bounds. */
export function canSubmitEmailOtp(token: string): boolean {
  const code = token.trim();
  if (!/^\d+$/.test(code)) return false;
  return code.length >= EMAIL_OTP_MIN_LENGTH && code.length <= EMAIL_OTP_MAX_LENGTH;
}
