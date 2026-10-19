# DevFit for Android

Personal Android fork of [Liftosaur](https://github.com/astashov/liftosaur), based on upstream commit `6fa20584097ba57417848b1995bed4e1b51524f7`. Copyright and AGPL-3.0 notices remain in [LICENSE](LICENSE).

DevFit uses package `com.devfit.app` and installs alongside Liftosaur. The internal React Native component retains its upstream name so native registration remains compatible.

## DevFit 0.3 experience

Today, Schedule, Progress and Me are the primary destinations. An active workout remains one tap away. The dark-first interface uses original DevFit surfaces, readable targets and large controls, with a light theme as well.

- **Today:** the session on today's anchored rotation date, estimated strength duration or programmed cardio duration, exercise order, recovery context and recent activity. A mismatch with the sequential program pointer offers Use today's session. Missing workouts never shifts the anchor.
- **Training:** one focused set controller, warmups before work, previous-result reuse, Last / Today / Next, plates, a set timeline and a session lineup. Workout tools retain the complete exercise grid, swaps, notes, supersets and target editors.
- **Clocks and logging:** Start opens the workout interval immediately. Pause freezes workout, rest, get-ready and timed work together; Resume excludes the paused duration and restores native timers. The same clock and Pause/Resume controls appear inside the cardio modal. Rest names its source exercise/set, previews the next target, and retains overtime. Explicit timeline edits preserve current rest; current sets can start new rest even when completed rapidly. Rep buttons change by one; weight buttons use existing equipment stacks, plates, units or the exercise's configured step. Weight setup opens the existing equipment editor. Raw progression calculations and manual loads remain unchanged.
- **Running and cardio:** time-first controls, actual segment labels, work and recovery totals, recorded duration and adherence. Explicit AMRAP, RPE, load and custom-state prompts remain supported. Distance, pace and GPS are not inferred.
- **Schedule:** a human-readable rotation with training, recovery, work and off days. Use Arrange rotation to assign existing program sessions; tap a day and choose Make this day today to anchor calendar dates. A dismissible setup card helps unanchored 14-day programs. Recovery days never count as missed. The last two rotations' missed sessions are classified by training type. Missed upper and lower work may offer optional Full-Body Catch-Up on an off training day. This creates an ad-hoc session using available program exercises and loads, with optional easy cardio; finishing it leaves the main program order intact.
- **Running:** numbered Run A/B labels classify consistently. The timer displays the actual description, planned segments and available continuous-run state target. Single running segments offer walk/jog phase changes using the existing clock. No default speed is forced. Incline Treadmill Walk and Stationary Bike are available exercises; the example rotation retains direct lateral raises. Existing user programs are never replaced.
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

Version 0.3.0 uses versionCode 3 and the same package, storage keys and signer as 0.2.0. CI checks the signing certificate against the downloaded v0.2 APK's SHA-256 certificate fingerprint `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. Install the update over v0.2. No destructive migration is needed: phase laps, rest intent, setup dismissal and catch-up provenance are optional validated fields. Old JSON profiles remain valid.

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

The offline lifecycle test seeds a profile with programs, custom exercises, measurements, equipment and schedule metadata, starts immediately, pauses, persists/reopens, resumes, finishes and verifies real progression with no network calls. Domain tests cover serialized clock freeze/resume, rest intent and cues, equipment stacks/small steps/plates, anchored dates, catch-up isolation, numbered running labels and phase persistence. Native interaction/render tests cover compact/unfolded Today → Start, edited keypad reps, rapid current sets, pause inside cardio, rest controls, equipment setup navigation, unilateral transitions, automatic intervals and Schedule/catch-up. These use mocked native bridges and do not prove OS behavior.

The v0.3 release passes TypeScript, scoped ESLint and view checks, 293 domain tests and 24 native interaction/render tests. The isolated web preview also compiles. A controllable browser was unavailable during this release, so fresh screenshot inspection is unverified.

CI also compiles native Android, verifies APK identity/signature and checks that the JavaScript bundle is embedded. Native runtime behavior still needs testing on a device: offline onboarding, workout completion/progression, force-stop/reopen persistence, background timers and notification actions, Health Connect permission flows, import/export, and folded/unfolded layouts.

Use Me → Back up everything · JSON regularly and before uninstalling. DevFit does not upload a cloud backup.
