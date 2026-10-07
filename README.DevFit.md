# DevFit for Android

Personal Android fork of [Liftosaur](https://github.com/astashov/liftosaur), based on upstream commit `6fa20584097ba57417848b1995bed4e1b51524f7`. Copyright and AGPL-3.0 notices remain in [LICENSE](LICENSE).

DevFit uses package `com.devfit.app` and installs alongside Liftosaur. The internal React Native component retains its upstream name so native registration remains compatible.

## DevFit 0.2 experience

Today, Schedule, Progress and Me are the primary destinations. An active workout remains one tap away. The dark-first interface uses original DevFit surfaces, readable targets and large controls, with a light theme as well.

- **Today:** the actual next session, estimated strength duration or programmed cardio duration, exercise order, recovery context and recent activity.
- **Training:** one focused set controller, warmups before work, previous-result reuse, Last / Today / Next, plates, a set timeline and a session lineup. Workout tools retain the complete exercise grid, swaps, notes, supersets and target editors.
- **Running and cardio:** time-first controls, actual segment labels, work and recovery totals, recorded duration and adherence. Explicit AMRAP, RPE, load and custom-state prompts remain supported. Distance, pace and GPS are not inferred.
- **Schedule:** a human-readable rotation with training, recovery, work and off days. Use Arrange rotation to assign existing program sessions; tap a day and choose Make this day today to anchor calendar dates. Recovery needs no fake workout. Calendar placement does not change Liftoscript or engine progression; Train this session explicitly selects the program day.
- **Progress:** strength sets/volume/PRs, running and endurance counts, recorded versus programmed cardio time, muscle frequency, bodyweight and cautious strength estimates. Existing graphs and weekly insights remain available.
- **Completion and Me:** compact saved-session results and actual updated targets; prominent JSON backup/import and grouped local settings.

Compact screens use one column. Unfolded screens from 700 logical pixels use a useful primary/secondary split; larger text can return to one column. Resizing retains the active workout and edits.

The 14-day mixed upper/lower and running rotation is covered by an isolated example fixture. It is never installed into user data. Import your actual program and arrange its calendar; no missing weights, exercises or progression rules are invented.

## Build an APK

The **DevFit Android APK** GitHub Actions workflow builds on pushes to `devfit` and can be run manually. Its artifact contains `DevFit-android-<commit>.apk` and a SHA-256 checksum. Download and extract the artifact, open the APK on an ARM64 Android phone, and allow installation from the app used to open it.

For a local build, use Node 22, Java 17 and the Android SDK:

```sh
npm ci --no-audit --no-fund
npm run devfit:apk
```

Android components: platform 36, build tools 36.0.0, NDK 27.1.12297006. Gradle uses the project's wrapper. Linux/macOS may need `chmod +x android/gradlew`. The output is `android/app/build/outputs/apk/release/app-release.apk`.

The initial APK uses the public React Native template development signing key, downloaded from a pinned official template revision and verified by SHA-256. Keystore files stay out of Git. This avoids CI signing secrets and keeps test updates compatible. It is intended for personal testing. A production distribution needs a private signing key configured in the ignored `android/devfit-keystore.properties`; changing keys requires backing up data before uninstall/reinstall. Upstream signing properties are not used.

## Personal behavior

- Training, programs, Liftoscript, progression, history, PRs, custom exercises, timers, imports, graphs and plate algorithms retain their upstream implementations.
- `src/devfit/capabilities.ts` grants only explicitly listed **local** features. Original purchase verification and server entitlement code remain separate. No receipts, subscriptions or API access are fabricated.
- `src/devfit/config.ts` disables official cloud, billing, telemetry and OTA. Android permanently builds `DISABLE_OTA=true`. It always uses embedded JavaScript.
- Onboarding skips attribution questions. Automatic account signup and store review requests are disabled, and importing existing data does not trigger official purchase-token verification.
- `DevFitService` bundles 60 program templates. Normal training requires no account or network. Production `/api/` calls are rejected before transport. Public images, exercise demos and explicitly opened documentation can still use the network.
- Rollbar/AppsFlyer Android autolinking, Firebase push and advertising/billing permissions are disabled. Logging and analytics entry points are inert. Health Connect remains optional and uses the DevFit package and bundled privacy page.
- Settings configure a rolling cycle of 1–60 local calendar days and a session target. The default is 14 days. Progress reports working sets, volume, exercise PRs, muscle sets/frequency, bodyweight change and recent estimated strength. Cardio is excluded from strength volume and muscle sets. Strength estimates compare the latest two completed sessions, including a previous session before the reporting window; they do not diagnose plateaus or predict custom scripts.
- Local persistence remains MMKV with the existing sharded format. An unreadable profile pauses saves and offers a raw recovery export before an explicitly confirmed reset.
- Workout cards show Last / Today / Next from actual logged sets, current targets and built-in progression configuration. Custom Liftoscript gets an honest generic explanation and a link to inspect the program; the engine remains authoritative.
- Cross-tab navigation explicitly selects the nested destination while keeping the tab container mounted. Starting a new workout commits its data before navigation, preventing a transient missing-record redirect to Today.

## Verification

```sh
npm run devfit:prepare
npm run check
npm run test:devfit
npm run test:devfit:render
```

The offline lifecycle test logs a set, reloads persisted in-progress data, finishes the workout, reopens history and verifies real progression without any network calls. The domain suite has 275 tests, including the mixed rotation, recovery, DST dates, cardio totals, optional-settings JSON compatibility and actual saved progression targets. The 20 native interaction/render tests include Today → Start, edited keypad reps, rest controls, offline cardio recording, Schedule arrangement, retained grid performance, graphs and contextual Health Connect settings. These use mocked native bridges and do not prove OS behavior.

CI also compiles native Android, verifies APK identity/signature and checks that the JavaScript bundle is embedded. Native runtime behavior still needs testing on a device: offline onboarding, workout completion/progression, force-stop/reopen persistence, background timers and notification actions, Health Connect permission flows, import/export, and folded/unfolded layouts.

Use Me → Back up everything · JSON regularly and before uninstalling. DevFit does not upload a cloud backup.
