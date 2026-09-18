// Learn more https://docs.expo.io/guides/customizing-metro
// getSentryExpoConfig wraps expo/metro-config's getDefaultConfig and adds
// debug-ID injection so uploaded source maps match released bundles.
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getSentryExpoConfig(__dirname);

// Add Hermes parser
config.transformer.hermesParser = true;

// When enabled, the optional code below will allow Metro to resolve
// and bundle source files with TV-specific extensions
// (e.g., *.ios.tv.tsx, *.android.tv.tsx, *.tv.tsx)
//
// Metro will still resolve source files with standard extensions
// as usual if TV-specific files are not found for a module.
//
if (process.env?.EXPO_TV === "1") {
  const originalSourceExts = config.resolver.sourceExts;
  const tvSourceExts = [
    ...originalSourceExts.map((e) => `tv.${e}`),
    ...originalSourceExts,
  ];
  config.resolver.sourceExts = tvSourceExts;
}

// Mac Catalyst builds don't link the Cast SDK (no Catalyst slice), and the real
// JS module throws at import time without its native side. Swap in a stub.
if (process.env?.EXPO_CATALYST === "1") {
  const castStub = require.resolve("./utils/google-cast.catalyst.ts");
  const upstreamResolve = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === "react-native-google-cast") {
      return { type: "sourceFile", filePath: castStub };
    }
    return (upstreamResolve ?? context.resolveRequest)(
      context,
      moduleName,
      platform,
    );
  };
}

// config.resolver.unstable_enablePackageExports = false;

module.exports = config;
