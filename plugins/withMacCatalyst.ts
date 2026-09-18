import fs from "node:fs";
import path from "node:path";
import {
  type ConfigPlugin,
  IOSConfig,
  withDangerousMod,
  withEntitlementsPlist,
  withPodfile,
  withPodfileProperties,
  withXcodeProject,
} from "expo/config-plugins";

/**
 * Expo config plugin that turns the iOS target into a Mac Catalyst app when
 * EXPO_CATALYST=1. Without the flag it does nothing, so iOS builds are unchanged.
 *
 * Catalyst is a destination of the same iOS target, not a separate project:
 * build with `-destination 'platform=macOS,variant=Mac Catalyst'`.
 * Modules without a Catalyst slice (Google Cast, the Live Activity widget) are
 * left out in app.config.ts, react-native.config.js and metro.config.js.
 *
 * Keep it first in app.json's plugin list: mods run in reverse registration
 * order, and this one has to strip entitlements that later plugins add
 * (expo-notifications sets aps-environment).
 */
const withMacCatalyst: ConfigPlugin = (config) => {
  if (process.env.EXPO_CATALYST !== "1") {
    return config;
  }

  // A fixed-size window is what makes the "Designed for iPad" build feel wrong.
  config.ios = { ...config.ios, requireFullScreen: false };

  // Both need a provisioning profile, so "Sign to Run Locally" builds would
  // fail. Cost on the Mac: no SSID-based local server switching and no Expo
  // push token (app/_layout.tsx already logs and moves on when it fails).
  config = withEntitlementsPlist(config, (config) => {
    delete config.modResults["com.apple.developer.networking.wifi-info"];
    delete config.modResults["aps-environment"];
    return config;
  });

  // Build Expo modules and React Native from source. Expo's precompiled
  // xcframeworks have no Catalyst slice, and React Native's prebuilt
  // ReactNativeDependencies.framework keeps its resource bundles at the root of
  // a versioned Mac framework, which codesign rejects as "bundle format is
  // ambiguous" when embedding it.
  config = withPodfileProperties(config, (config) => {
    config.modResults.EXPO_USE_PRECOMPILED_MODULES = "false";
    config.modResults["ios.buildReactNativeFromSource"] = "true";
    return config;
  });

  config = withPodfile(config, (config) => {
    let podfile = config.modResults.contents
      .replace(
        ":mac_catalyst_enabled => false",
        ":mac_catalyst_enabled => true",
      )
      // expo-camera's barcode scanner (DataScannerViewController) is iOS only.
      // Expo modules ignore react-native.config.js, so exclude it here.
      .replace(
        /^(\s*)use_expo_modules!\s*$/m,
        "$1use_expo_modules!(exclude: ['expo-camera'])",
      );
    const marker = "# withMacCatalyst";
    if (!podfile.includes(marker)) {
      podfile = podfile.replace(
        /^(\s*post_install do \|installer\|\n)/m,
        `$1    ${marker}
    # Xcode derives a pod's Catalyst target from IPHONEOS_DEPLOYMENT_TARGET via
    # the SDK's iOS->macOS version map. 15.1 (React Native's minimum) is not in
    # that map, so Xcode falls back to macOS 10.15 and rejects it. Raise pods
    # below the app's own target to it.
    app_target = podfile_properties['ios.deploymentTarget']
    installer.pods_project.targets.each do |t|
      t.build_configurations.each do |c|
        current = c.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current.nil? || Gem::Version.new(current) < Gem::Version.new(app_target)
          c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = app_target
        end
      end
    end
`,
      );
      // Runs in post_integrate, not post_install: the app's aggregate xcconfig
      // (Pods-Streamyfin) is written after post_install and would undo it.
      podfile += `
${marker}
# @sentry/react-native selects its Catalyst slice with [sdk=maccatalyst*], but
# no such SDK exists: Catalyst builds use macosx, so they get the AppKit slice
# and RNSentryInternal.swift fails to compile. This app never builds for native
# macOS, so point the macosx selector at the Catalyst slice.
# ponytail: slice names are hardcoded like in Sentry's sentry_utils.rb; drop
# this hook once getsentry/sentry-react-native#6755 is fixed.
post_integrate do |installer|
  Dir.glob(File.join(installer.sandbox.target_support_files_root, '**', '*.xcconfig')).each do |path|
    xcconfig = File.read(path)
    fixed = xcconfig.gsub('Sentry.xcframework/macos-arm64_arm64e_x86_64', 'Sentry.xcframework/ios-arm64_arm64e_x86_64-maccatalyst')
    File.write(path, fixed) if fixed != xcconfig
  end
end
`;
    }
    config.modResults.contents = podfile;
    return config;
  });

  config = withXcodeProject(config, (config) => {
    const project = config.modResults;
    const { buildConfigurationList } = project.getFirstTarget().firstTarget;
    const buildConfigs = IOSConfig.XcodeUtils.getBuildConfigurationsForListId(
      project,
      buildConfigurationList,
    );
    for (const [, buildConfig] of buildConfigs) {
      Object.assign(buildConfig.buildSettings, {
        SUPPORTS_MACCATALYST: "YES",
        SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD: "NO",
        TARGETED_DEVICE_FAMILY: '"1,2,6"',
      });
    }
    return config;
  });

  // The JS bundle is built by Xcode's build phase, so Metro has to see the
  // flag there too (same reason as EXPO_TV in withTVXcodeEnv).
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const envPath = path.join(
        config.modRequest.platformProjectRoot,
        ".xcode.env.local",
      );
      let content = "";
      try {
        content = fs.readFileSync(envPath, "utf-8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }
      const exportLine = "export EXPO_CATALYST=1";
      if (!content.includes(exportLine)) {
        if (content.length > 0 && !content.endsWith("\n")) content += "\n";
        fs.writeFileSync(envPath, `${content}${exportLine}\n`);
      }
      return config;
    },
  ]);
};

export default withMacCatalyst;
