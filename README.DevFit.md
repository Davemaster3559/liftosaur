# DevFit for Android

Personal Android fork of [Liftosaur](https://github.com/astashov/liftosaur), based on upstream commit `6fa20584097ba57417848b1995bed4e1b51524f7`. Copyright and AGPL-3.0 notices remain in [LICENSE](LICENSE).

DevFit uses package `com.devfit.app` and installs alongside Liftosaur. The internal React Native component retains its upstream name so native registration remains compatible.

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
- `DevFitService` bundles 60 program templates. Normal training requires no account or network. Production `/api/` calls are rejected before transport. Public images, exercise demos and explicitly opened documentation can still use the network.
- Rollbar/AppsFlyer Android autolinking, Firebase push and advertising/billing permissions are disabled. Logging and analytics entry points are inert. Health Connect remains optional and uses the DevFit package and bundled privacy page.
- Settings configure a rolling cycle of 1–60 local calendar days and a session target. Home reports completed sessions, working sets, volume, exercise PRs, muscle sets/frequency, bodyweight change and recent estimated strength. Weekly insights remain available. Strength estimates compare the latest two completed sessions; they do not diagnose plateaus or predict custom scripts.
- Local persistence remains MMKV with the existing sharded format. An unreadable profile pauses saves and offers a raw recovery export before an explicitly confirmed reset.
- Workout cards show Last / Today / Next from actual logged sets, current targets and built-in progression configuration. Custom Liftoscript gets an honest generic explanation and a link to inspect the program; the engine remains authoritative.
- Cross-tab navigation keeps the tab container mounted while resetting its child stack, preventing stale Home route parameters from taking over a Graphs or Settings tap.

## Verification

```sh
npm run devfit:prepare
npm run check
npm run test:devfit
npm run test:devfit:render
```

The offline lifecycle test logs a set, reloads persisted in-progress data, finishes the workout, reopens history and verifies real progression without any network calls. Native render tests exercise set logging, graphs, cycle insights, program editing, backup and Health Connect settings without a subscription. These use mocked native bridges and do not prove OS behavior.

CI also compiles native Android, verifies APK identity/signature and checks that the JavaScript bundle is embedded. Native runtime behavior still needs testing on a device: offline onboarding, workout completion/progression, force-stop/reopen persistence, background timers and notification actions, Health Connect permission flows, import/export, and folded/unfolded layouts.

Use Settings → Export data to JSON regularly and before uninstalling. DevFit does not upload a cloud backup.
