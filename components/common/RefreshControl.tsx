import {
  type RefreshControlProps,
  RefreshControl as RNRefreshControl,
} from "react-native";
import { isMacCatalyst } from "@/utils/platform";

/**
 * Drop-in for react-native's RefreshControl. UIKit throws when a UIRefreshControl
 * is attached in Mac Catalyst's Mac idiom, so the Mac build renders nothing:
 * there is no pull-to-refresh gesture on a Mac anyway.
 */
export const RefreshControl = (props: RefreshControlProps) =>
  isMacCatalyst ? null : <RNRefreshControl {...props} />;
