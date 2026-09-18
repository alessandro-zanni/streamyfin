import { Platform } from "react-native";

/**
 * True in the Mac Catalyst build (EXPO_CATALYST=1, see plugins/withMacCatalyst.ts).
 * `Platform.isMacCatalyst` only exists on the iOS Platform type, hence the OS check.
 */
export const isMacCatalyst = Platform.OS === "ios" && Platform.isMacCatalyst;
