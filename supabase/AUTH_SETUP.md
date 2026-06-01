# Supabase auth setup (Phase 2)

Readr uses **email OTP** — a 6-digit code typed in the app. Two dashboard steps unlock production sign-in.

## 1. OTP email template (required)

Supabase’s default Magic Link email does **not** show the numeric code.

Follow [`email-templates/README.md`](./email-templates/README.md): paste `magic-link-otp.html` into **Authentication → Email Templates → Magic Link**.

## 2. Custom SMTP (recommended for real use)

Supabase’s built-in mailer is rate-limited (~2–4 emails/hour). For testing with teammates or production:

1. **Authentication → SMTP Settings** → enable custom SMTP
2. Use [Resend](https://resend.com), SendGrid, or similar
3. Set sender domain and credentials per provider docs
4. Send a test OTP from the app

Without custom SMTP, use **Continue without signing in** in dev (`__DEV__` only). Dev bookmarks stay on-device only.

## 3. Redirect URLs (optional link fallback)

If users tap the email link instead of typing the code:

**Authentication → URL Configuration → Redirect URLs**

- `readr://auth/callback`
- `exp://**` (Expo Go)
- Your LAN Expo URL if shown on the auth screen, e.g. `exp://192.168.x.x:8081/--/auth/callback`

## 4. Verify sign-in + bookmarks

1. Sign out if using dev guest (Profile shows “Local dev session”)
2. Enter email → receive 6-digit code → **Verify & Sign In** (should show “Signed in.”)
3. Open Gatsby → highlight a sentence → bookmark
4. Sign out and back in on another device/simulator — bookmark should sync via `user_highlights`

## Env vars

See [`.env.example`](../.env.example). App needs `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` only. Never put `SUPABASE_SERVICE_ROLE_KEY` in the app.

## API keys after a leak

Supabase now uses **Publishable** and **Secret** keys instead of rotatable legacy JWT keys.

**Dashboard → Project Settings → API Keys**

| `.env` variable | Dashboard key |
|-----------------|---------------|
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | **Publishable** (`sb_publishable_...`) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** (`sb_secret_...`) — seed scripts only |

After disabling legacy keys, old `eyJ...` anon and service_role values return **“Legacy API keys are disabled”**. Replace both env values with the new keys, then run `npm run supabase:check`.

Restart Expo after changing `EXPO_PUBLIC_*` vars.
