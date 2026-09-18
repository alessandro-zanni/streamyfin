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
- **Precompiled Expo modules and prebuilt React Native don't work.** The Expo
  xcframeworks have no Catalyst slice. React Native's `ReactNativeDependencies.framework`
  has one, but its resource bundles sit at the root of a versioned framework and codesign
  fails on embed with "bundle format is ambiguous". Both build from source on Catalyst,
  so the first build is slow.
- **Sentry picks the AppKit slice.** `[sdk=maccatalyst*]` never matches: Catalyst uses
  the `macosx` SDK. The fix rewrites the xcconfigs in `post_integrate`, because the app's
  aggregate xcconfig is written after `post_install`.
  getsentry/sentry-react-native#6755.
- **react-native-track-player** needs `import CoreAudio` on Catalyst (patch in `patches/`,
  lovegaoshi/react-native-track-player#91).
- **UIKit throws on iPhone-only controls in the Mac idiom.** `UIRefreshControl` crashes at
  mount, so use `components/common/RefreshControl` instead of React Native's.
  ActivityKit and `BGContinuedProcessingTask` are unavailable there too (hence the
  `!targetEnvironment(macCatalyst)` guards in `modules/background-downloader`).
- **Ad-hoc signed Release builds crash at launch** with "Library missing ... different
  Team IDs": Release enables the hardened runtime, whose library validation rejects
  ad-hoc frameworks. `ios:catalyst` passes `ENABLE_HARDENED_RUNTIME=NO`. A build signed
  with a real team does not need it.
- **The Expo dev menu opens on any long click in Debug.** Its three-finger long-press
  recognizer can't count fingers with a mouse. Turn it off with
  `defaults write com.fredrikburmester.streamyfin EXDevMenuTouchGestureEnabled -bool false`
  (⌘D still opens the menu).
- **MPVKit needs a `maccatalyst` slice** in the release zip. `make gpl platform=maccatalyst`
  in streamyfin/MPVKit builds it once `cFlags` carries the iOSSupport framework path
  (`vo_avfoundation.m` imports UIKit) and `create-combined-framework.sh` knows the slice.
