# Supabase email template (required for OTP sign-in)

Supabase's **default Magic Link template only shows a clickable link** — it does not display the numeric sign-in code, even though Supabase generates one.

Codes are usually **6 or 8 digits** depending on your project settings.

## One-time setup (~2 minutes)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project
2. Go to **Authentication** → **Email Templates** → **Magic Link**
3. Replace the body with the contents of [`magic-link-otp.html`](./magic-link-otp.html)
4. Save

After this, sign-in emails will show:

```
Enter this code in the app: 123456
```

## Redirect URLs (for link fallback)

If users tap the link instead of typing the code, add these under **Authentication** → **URL Configuration** → **Redirect URLs**:

- `readr://auth/callback`
- `exp://**` (Expo Go during development)

Also add the exact URL shown on the auth screen if Expo Go gives you something like `exp://192.168.x.x:8081/--/auth/callback`.

## Reference

- [Supabase: Passwordless email logins](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Supabase: Email templates](https://supabase.com/docs/guides/auth/auth-email-templates)
