# SDGoku

**Language:** [Русский](README.md) · English · [Azərbaycanca](README.az.md)

Sudoku where the digits are replaced by the icons of the 17 Sustainable Development Goals (SDGs). Every game uses 9 of the 17 goals, picked at random.

Version 0.1.0. Interface languages: Russian, English, Azerbaijani.

## What already works

- Puzzle generator with a unique solution, 4 difficulty levels (45 / 36 / 30 / 25 given cells).
- Daily puzzle: the same for everyone, derived from the date; day streak.
- Notes, undo, erase, 3 hints per game, a limit of 3 mistakes, timer and pause.
- Autosave of the current game and of progress on the device.
- Stats, 13 achievements, personal records, cards describing the goals.
- Sound and vibration (can be switched off in settings), light and dark theme following the system setting.
- Server module (Firebase): email sign-in, progress sync between devices, shared leaderboard, account deletion. **Switched off until a config is provided** (see "Server").

## Structure

```
www/                  the finished web app, no bundler needed
  index.html
  css/app.css         styling and the goal icon mapping
  js/config.js        version and Firebase config
  js/engine.js        sudoku generator and solver
  js/store.js         saving, stats, records, achievements
  js/cloud.js         Firebase: sign-in, sync, leaderboard
  js/audio.js         sounds and vibration
  js/app.js           interface and game logic
  js/i18n/*.js        translations and goal texts (ru, en, az)
  assets/sdg/         17 goal icons: goal-01.png … goal-17.png
  assets/fonts/       Oswald font (OFL licence inside)
  vendor/             Firebase SDK 13.3.0 (compat), loaded only when a config is set
firebase/firestore.rules   database security rules
tools/build-single.mjs     builds one HTML file (for sharing by link)
tests/                     automated tests
capacitor.config.json      wrapper settings for Android and iOS
```

## Run it in a browser

```
npm run serve        # http://localhost:8080
```

## Building for Android and iOS (Capacitor)

You need Node.js 20+, Android Studio, and for iOS a Mac with Xcode (or a cloud build service such as Codemagic or Ionic Appflow).

1. In `capacitor.config.json` replace `appId` with your own, for example `az.yourorganisation.sdgoku`. The identifier cannot be changed after the app is published.
2. Install the dependencies and add the platforms:
   ```
   npm install
   npx cap add android
   npx cap add ios        # Mac only
   npx cap sync
   ```
3. Android: `npx cap open android`, then Build → Generate Signed App Bundle (an .aab file for Google Play).
4. iOS: `npx cap open ios`, then Product → Archive in Xcode.
5. Run `npx cap sync` after every change in `www/`. Once the `android/` and `ios/` folders exist, add them to the repository: they hold the native project settings.
6. App icon and splash screen: when the logo is ready, put `assets/icon.png` (1024×1024) in place and generate the sizes with the `@capacitor/assets` package.

The Android Back button is already handled (the `@capacitor/app` plugin).

## Server: email sign-in, sync, shared leaderboard

1. Create a project in the Firebase console and add a web app to it.
2. Authentication → Sign-in method → enable Email/Password.
3. Create a Firestore Database and paste the rules from `firebase/firestore.rules`.
4. Copy the web app config into `www/js/config.js` in place of `firebase: null`.
5. Check it: Settings → Account → "Sign in with email"; after a win the result appears under Records → Leaderboard.

How the data is laid out:

- `users/{uid}`: the player's progress (stats, records, achievements, day streak). On sign-in the local and the server progress are merged, nothing is lost.
- `leaderboards/{board}/scores/{uid}`: the player's best result on a board. Boards: `easy`, `medium`, `hard`, `expert`, `daily-YYYY-MM-DD`.

Good to know:

- The result is calculated on the client, so a determined person can fake a record. The database rules only reject values that are plainly impossible. If the leaderboard becomes important, move the check to the server (Cloud Functions).
- If sign-in hangs at startup on iOS, remove `authDomain` from the config: email sign-in does not need it, and loading it inside the Capacitor wrapper sometimes gets in the way. The fallback is the `@capacitor-firebase/authentication` plugin.
- Progress without an account lives in the wrapper's `localStorage`. For reliability on iOS it is worth moving it to `@capacitor/preferences` (the place to change is the `read` and `write` functions in `js/store.js`).

## SDG icons and the UN rules

- `www/assets/sdg/` currently holds icons cut out of the poster we were sent (about 160 px). **Replace them with the official ones before publishing**, from the E-SDG-Icons-WEB archive on the UN materials page: https://www.un.org/sustainabledevelopment/news/communications-material/ . Keep the file names.
- The icons must not be redrawn or altered.
- Usage guidelines: https://www.un.org/sustainabledevelopment/wp-content/uploads/2023/09/E_SDG_Guidelines_Sep20238.pdf
  - Informational, non-commercial use needs no permission.
  - Ads, paid features, fundraising: written permission from the UN first (the request form is on the same page).
  - Organisations outside the UN system may not use the logo version with the UN emblem and may not combine the SDG colour wheel or the icons with their own logo. This also applies to the future app icon.
  - The UN asks for a link to https://www.un.org/sustainabledevelopment and a statement that the material has not been approved by the UN. Settings → About currently shows a paraphrase in our own words (the `about_text` key in the translations). Before publishing, put the official wording from the UN materials page there.
- The tiles are in English for every interface language. Sets in other languages can be wired in with separate rules in `css/app.css`, for example `html[lang="ru"] .g1 { background-image: … }`.

## Release checklist

Google Play:

- A developer account (paid registration). Personal accounts created after 13 November 2023 must run a closed test before release: at least 12 testers for 14 days in a row. Organisation accounts are not subject to this. Details: https://support.google.com/googleplay/android-developer/answer/14151465
- A privacy policy at a public link (the app collects an email address and game progress).
- The Data safety section: email address, user ID, game progress.
- Account deletion: already in the app (Settings → Account); a web link for deletion requests is needed as well.
- Age rating, description and screenshots in three languages.

App Store:

- Apple Developer Program membership (paid yearly), a Mac with Xcode or a cloud build.
- A privacy policy and the privacy labels in App Store Connect.
- In-app account deletion: done.

Store requirements change, so check the current ones before submitting.

## Tests

```
npm test                                   # engine: unique solution, levels, daily puzzle
node tools/build-single.mjs                # build dist/sdgoku.html
NODE_PATH=<node_modules with playwright> node tests/ui.test.cjs      # a full game in a phone-sized browser
NODE_PATH=<node_modules with playwright> node tests/cloud.test.cjs   # sign-in, sync, leaderboard against a mock server
```

## Not verified yet

- Android and iOS builds on real devices. Only the creation of the Capacitor project and the copy of `www/` into it have been checked.
- Work against a real Firebase project. The logic was tested on a mock, and the real SDK was checked for loading and for the presence of every method the game calls.
- The Azerbaijani translation needs proofreading by a native speaker. The names of goals 1–4 were checked against azerbaijan.un.org; the rest should be checked there too.

## Ideas for later

- 4×4 and 6×6 boards for beginners, an archive of past daily puzzles.
- Goal icons in the interface language.
- Server-side verification of leaderboard results.
