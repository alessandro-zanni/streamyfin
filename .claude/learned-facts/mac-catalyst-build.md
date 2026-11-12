# Mac Catalyst build: what breaks and where it is handled

**Date**: 2026-09-18
**Category**: build
**Key files**: `plugins/withMacCatalyst.ts`, `react-native.config.js`, `metro.config.js`, `utils/platform.ts`

## Detail

The Mac build is the iOS target with `SUPPORTS_MACCATALYST=YES`, opt-in through
`EXPO_CATALYST=1`. Without the flag the plugin is a no-op, so the iOS prebuild is
identical to the one without it. It uses the Mac idiom (`TARGETED_DEVICE_FAMILY` 6),
not the scaled iPad idiom. Each item below is a build or runtime failure that happened
before the fix was in:

- **`pod install` needs the flag too.** `react-native.config.js` reads `EXPO_CATALYST`, so
  a bare `pod install` relinks Google Cast and the build fails on `GoogleCast/GoogleCast.h`.
  Run `EXPO_CATALYST=1 pod install`, or `bun run prebuild:catalyst`.
- **Expo modules ignore `react-native.config.js`.** Excluding one on Catalyst takes
  `use_expo_modules!(exclude: [...])` in the Podfile (expo-camera: `DataScannerViewController`
  is iOS only).
- **iOS 15.1 is missing from the SDK's iOS->macOS version map** (`SDKSettings.json`,
  `iOSMac_macOS`). A pod at React Native's 15.1 minimum gets macOS 10.15 and Xcode rejects
  it. Setting `MACOSX_DEPLOYMENT_TARGET` does nothing, because Catalyst derives it from
  `IPHONEOS_DEPLOYMENT_TARGET`. The plugin raises pods to the app's target.
- **Expo modules build from source, React Native stays prebuilt.** The Expo
  xcframeworks have no Catalyst slice. React Native's prebuilt `React` and
  `ReactNativeDependencies` frameworks have one, but it is a versioned Mac bundle with loose
  copies at its root and a real `Versions/Current` directory, so codesign fails on embed
  ("unsealed contents present in the root directory", "bundle format is ambiguous"). The
  plugin rebuilds that layout in `post_install`. React Native built from source is not an
  option since 0.88: NitroModules cannot build the `cxxreact` clang module on Catalyst
  (`OS_SIGNPOST_*`, `is_dynamic` errors), with or without Swift explicit modules.
- **Sentry picks the AppKit slice.** `[sdk=maccatalyst*]` never matches: Catalyst uses
  the `macosx` SDK. The fix rewrites the xcconfigs in `post_integrate`, because the app's
  aggregate xcconfig is written after `post_install`.
  getsentry/sentry-react-native#6755.
- **react-native-track-player** needs `import CoreAudio` on Catalyst: in the library
  since lovegaoshi/react-native-track-player#91, no patch needed.
- **Reanimated imports AppKit whenever it exists** (`REAReducedMotion.h`), and on
  Catalyst it does: AppKit brings QuickDraw, whose `Rect` and `Point` clash with React
  Native's. `patches/react-native-reanimated@*.patch` imports it only without UIKit.
- **UIKit throws on iPhone-only controls in the Mac idiom.** `UIRefreshControl` crashes at
  mount, so use `components/common/RefreshControl` instead of React Native's.
  ActivityKit and `BGContinuedProcessingTask` are unavailable there too (hence the
  `!targetEnvironment(macCatalyst)` guards in `modules/background-downloader`).
- **The Mac idiom moves the navigation bar into the window's NSToolbar** and drops
  every custom-view bar button item on the way, so all `headerLeft`/`headerRight`
  buttons vanish (downloads, settings, the item page's download button) while the
  title survives. `patches/react-native-screens@*.patch` sets
  `navigationBar.preferredBehavioralStyle = .pad` in `RNSNavigationController`, which
  keeps the bar in the window like on iPad.
- **The Mac idiom draws a SwiftUI `Menu` as an AppKit pop-up button**, an empty bezel
  over the React Native label passed to `@expo/ui`'s `Menu`. `PlatformDropdown` adds
  `buttonStyle("plain")` on Catalyst; any other `Menu` with a custom label needs it too.
- **Unsandboxed, Documents is the user's `~/Documents`.** Downloads, trickplay folders
  and `mmkv/` landed loose among their files. The plugin turns on the App Sandbox
  (network client and server: the companion pairing listens on a port), so data lives
  in `~/Library/Containers/maccatalyst.com.fredrikburmester.streamyfin/Data/`. The
  bundle id gets the `maccatalyst.` prefix (`DERIVE_MACCATALYST_PRODUCT_BUNDLE_IDENTIFIER`)
  because the App Store iPhone build also runs on Apple silicon Macs, and with the same
  id both would share one container.
- **`expo prebuild` without `--clean` still regenerated all of `ios/`**, wiping `Pods`,
  `ios/build` and the hand-edited MPVKit line in the Podfile. After any prebuild run
  `EXPO_CATALYST=1 pod install` and expect the Expo modules to build from source again.
- **A background download is not in the container's `tmp`.** `nsurlsessiond` writes it to
  `Data/Library/Caches/com.apple.nsurlsessiond/Downloads/<bundle id>/CFNetworkDownload_*.tmp`,
  so that is where to look to tell a live transfer from a stalled one — an empty `tmp` proves
  nothing.
- **`UIApplication.isIdleTimerDisabled` does nothing on the Mac.** It raises no error
  and takes no power assertion (check with `pmset -g assertions`). The native player
  (`NativePlayerViewController.setKeepAwake`) also holds a ProcessInfo activity there.
  The same goes for `expo-keep-awake`, which sets that flag.
- **Keyboard input during playback is the native player's job.** The `useKeyEventListener`
  in `components/video-player/controls/Controls.tsx` is not mounted while
  `NativePlayerViewController` is up, so the keys live in its `keyCommands`.
- **The native player's controls are reshaped for the mouse on the Mac** (all behind
  `targetEnvironment(macCatalyst)` in `modules/mpv-player/ios/NativePlayer`): the arrows
  button, a double click and F toggle the window's full screen through
  `MacWindowFullScreen` (KVC on `NSApplication`'s key window and `toggleFullScreen:`: UIKit
  has no API for it), zoom to fill moves to the More menu and sizes the layer like on tvOS
  (`zoomAwareLayerFrame`), a click plays or pauses, the mouse moving shows the controls
  (`UIHoverGestureRecognizer`) and the cursor hides with them (`UIPointerStyle.hidden()`),
  and the swipes, the 2x hold and the brightness slider are off.
- **Ad-hoc signed Release builds crash at launch** with "Library missing ... different
  Team IDs": Release enables the hardened runtime, whose library validation rejects
  ad-hoc frameworks. `ios:catalyst` passes `ENABLE_HARDENED_RUNTIME=NO`. A build signed
  with a real team does not need it.
- **The Expo dev menu opens on any long click in Debug.** Its three-finger long-press
  recognizer can't count fingers with a mouse. Turn it off with
  `defaults write maccatalyst.com.fredrikburmester.streamyfin EXDevMenuTouchGestureEnabled -bool false`
  (⌘D still opens the menu).
- **MPVKit needs a `maccatalyst` slice** in the release zip. `make gpl platform=maccatalyst`
  in streamyfin/MPVKit builds it once `cFlags` carries the iOSSupport framework path
  (`vo_avfoundation.m` imports UIKit) and `create-combined-framework.sh` knows the slice.
- **macOS 27 requires the scene lifecycle.** Without `UIApplicationSceneManifest` the app
  traps at launch in `_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`. Expo
  SDK 58's template adopts it on every platform (`SceneDelegate.swift`), so the plugin adds
  nothing. Measuring the window with `CGWindowListCopyWindowInfo` while the app is in the
  background under Stage Manager reports the side thumbnail (~170×190 pt), not the window.
