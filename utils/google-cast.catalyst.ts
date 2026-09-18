/**
 * Stand-in for `react-native-google-cast` on Mac Catalyst, wired in by
 * metro.config.js when EXPO_CATALYST=1. The Cast SDK has no Catalyst slice, so
 * the native module is not linked and the real package throws at import time.
 *
 * Only the surface the app imports is covered: every hook reports "no cast
 * session", which leaves the cast paths in PlayButton, now-playing and
 * useMusicCast unreachable. The enums are the package's own plain-JS values.
 */
import CastState from "react-native-google-cast/src/types/CastState";
import MediaHlsSegmentFormat from "react-native-google-cast/src/types/MediaHlsSegmentFormat";
import MediaHlsVideoSegmentFormat from "react-native-google-cast/src/types/MediaHlsVideoSegmentFormat";
import MediaStreamType from "react-native-google-cast/src/types/MediaStreamType";
import PlayServicesState from "react-native-google-cast/src/types/PlayServicesState";

export type { default as MediaTrack } from "react-native-google-cast/src/types/MediaTrack";

export {
  CastState,
  MediaHlsSegmentFormat,
  MediaHlsVideoSegmentFormat,
  MediaStreamType,
  PlayServicesState,
};

const noop = async () => {};

export const CastContext = {
  getPlayServicesState: async () => PlayServicesState.SUCCESS,
  showPlayServicesErrorDialog: noop,
  showCastDialog: noop,
  showExpandedControls: noop,
  getSessionManager: () => null,
  getDiscoveryManager: () => null,
};
export default CastContext;

export const CastButton = () => null;
export const useCastState = () => CastState.NO_DEVICES_AVAILABLE;
export const useCastDevice = () => null;
export const useDevices = () => [];
export const useMediaStatus = () => null;
export const useRemoteMediaClient = () => null;
