# SIcoinX Mobile (React Native / Expo)

The SIcoinX customer wallet app for Android, iOS and the web preview. It replaces the earlier Flutter app and shares
its accounts with the website: users sign in with **Firebase Authentication** (project `sicoinx`), and wallet data
comes from the same Express API (`apps/api`) the website uses.

**Stack:** Expo SDK 58 · React Native 0.88 · React 19 · Expo Router (file-based routes) · TypeScript (strict) ·
Firebase JS SDK (Auth) · `decimal.js` for exact money math · `expo-secure-store` (keystore-backed session).

## How the backend fits together

```
                 ┌──────────────────────── Firebase (project "sicoinx") ────────────────────────┐
 SIcoinX app ──▶ │ Authentication  sign-in, register, reset password, verify email, change pw   │
                 │ Firestore       users/{uid} profile + role (same document the website reads)  │
                 │ Analytics       screen / purchase / KYC events (native builds)                │
                 └───────────────────────────────────────────────────────────────────────────────┘
        │  Authorization: Bearer <Firebase ID token>   (fresh on every request, auto-refreshed)
        ▼
 Express API (apps/api)  verifies the token against Google's keys, links it to the SI Coin account
                         (wallet, KYC, orders, transfers, support tickets, notifications)
```

- Accounts are **shared with the website**: the same email and password work on both.
- The API links a Firebase account to an existing SI Coin account by email **only when Firebase reports that email as
  verified**; otherwise the app shows the *Verify your email* screen. This prevents anyone claiming someone else's
  account by registering their address.
- Roles are never chosen by the app: `firestore.rules` only lets a user create a plain `USER` profile.

## Features

| Area | What it does |
| --- | --- |
| Auth | Sign in, register (with Terms/Privacy links), forgot password, email-verification gate, session restore on launch, **sign out** (works on Android, iOS and web), automatic sign-out when the session expires |
| Account | Profile card, edit name, **change password** (re-authenticates), resend / re-check email verification, KYC status, notifications, help & legal links, about, sign out |
| Wallet | Greeting header, balance hero card with hide/show, INR/USD valuation, buy/sell/send/**receive**, reference rates, KYC prompt, recent activity, pull-to-refresh, frozen-wallet notice |
| Notifications | Inbox with unread badge on the home bell, mark one / all as read |
| Buy | Rate-based total, quick amounts, min/max limits from the server, Razorpay **sandbox** checkout, receipt |
| Sell | Bank payout request with IFSC/account validation, available-balance check |
| Send | To another SIcoinX user (email / wallet ID) or a connected app (YouPeak, YouPeak Shop) |
| Activity | Filterable, paginated ledger with transaction receipts |
| Verify (KYC) | Status (pending / approved / rejected with reason), document photo upload |
| Support | Create tickets, read the conversation, reply |

## Run it

```bash
# 1. Start the API (repo root, separate terminal)
npm run setup          # first time only: install, build, migrate, seed
npm run dev -w apps/api

# 2. Configure Firebase (once): copy the template and fill in the web config of project "sicoinx"
cd apps/mobile
cp .env.example .env   # the same values as VITE_FIREBASE_* in apps/web/.env

# 3. Install and start the app
npm install
npx expo start -c      # press "a" (Android), "i" (iOS), "w" (web), or scan the QR with Expo Go
```

`.env` is git-ignored. **Restart Metro with `-c` whenever `.env` changes**: Expo bakes `EXPO_PUBLIC_*` values into the bundle.

In development the app finds the API automatically: it uses the same machine that serves Metro, on port 5000,
so a phone on the same Wi-Fi works with no setup. To point at another server, set `EXPO_PUBLIC_API_URL`
(origin or full `/api/v1` URL). **Release builds require `EXPO_PUBLIC_API_URL` and the `EXPO_PUBLIC_FIREBASE_*`
values** (set them in `eas.json` `env` or as EAS environment variables) and should use HTTPS.

Create a customer account with **Create an account** in the app, or sign in with an existing website account. Staff
accounts are provisioned with `scripts/firebase/create-staff.mjs`.

## Firebase

Project `sicoinx`.

- **Authentication + Firestore profile** use the Firebase JS SDK, so they work on native builds and the web preview with
  no extra native code. The session is stored in the OS keystore on devices (`src/lib/secureStorage.ts`) and in the
  browser on web.
- **Pin `firebase` to the same version as `@react-native-firebase/app`'s dependency** (`13.1.0`). If two versions are
  installed, Metro bundles two copies of `@firebase/app` and the app crashes at start-up with
  *"Component auth has not been registered yet"*. Check with `npm ls @firebase/app` (it must show one version).
- **Analytics** uses React Native Firebase and needs a **development build**, not Expo Go (it is a no-op on web and in
  Expo Go). Config lives in `google-services.json` (referenced from `app.json`); the Android package must equal its
  `package_name` (`sicoinx.app`). **Don't edit `android/` by hand.**

  ```bash
  npx expo run:android        # local build, needs Android Studio + SDK
  # or a cloud build: npx eas-cli@latest build --profile development --platform android
  npx expo start --dev-client # then open the installed development build
  ```
- Events are sent through `src/lib/analytics.ts` (never throws, no personal data): `screen_view` per route, `login`,
  `sign_up`, `purchase`, `sell_request`, `coin_transfer`, `kyc_submitted`, `support_ticket_created`; the user id is the
  opaque server UUID. Watch them live in Firebase **DebugView**.
- iOS is not configured: add `GoogleService-Info.plist` (`ios.googleServicesFile`) from the Firebase console first.
- The live Firestore rules must be the ones in `firestore.rules` (publish them in the Firebase console, or
  `firebase deploy --only firestore:rules`); with Firebase's default locked rules the profile document cannot be read.

## Quality checks

```bash
npm run typecheck      # tsc --noEmit
npx eslint .           # lint
npm test               # unit tests (money math, validation, API client, token refresh, secure storage, Firestore helper)
npm run test:e2e       # integration tests against a running API (registers throw-away users via the API's own sign-in)
npx expo-doctor        # dependency / config health
```

## Project layout

```
src/app/            Expo Router routes: sign-in, register, forgot-password, verify-email,
                    (app)/(tabs)/{index,history,kyc,support,account}, buy, sell, transfer,
                    notifications, edit-profile, change-password, about, ticket/[id]
src/api/            fetch client (timeouts, token refresh retry, safe JSON parsing, typed errors), endpoints, types
src/auth/           SessionProvider (Firebase session ↔ SI Coin account), Firebase auth actions
src/components/     UI building blocks (Button, Card, ListRow, ConfirmDialog, AuthShell, Headers, …)
src/lib/            Firebase init, secure storage, Firestore profile helper, money, formatting, validation
```

## Notes

- **Sign out uses a custom confirmation dialog**, not `Alert.alert`: React Native's `Alert` buttons never fire on the web
  preview, which made sign-out silently do nothing there.
- **Payments are sandbox only.** When the API runs without live Razorpay keys it hands the app a matching
  payment id and signature, and the app confirms the simulated payment. If the server is configured with live
  keys the app says so instead of pretending to charge: opening real Razorpay Checkout needs the native
  Razorpay SDK, which requires a development build and is not integrated yet.
- `android/` and `ios/` are generated by Expo (Continuous Native Generation) and are git-ignored. Create builds
  with `npx expo run:android|ios` or Expo's cloud build service.
- Bundle identifier / Android package is `sicoinx.app`. The Android package must match `google-services.json`; change both together.
