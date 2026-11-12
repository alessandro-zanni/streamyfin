#if targetEnvironment(macCatalyst)
import UIKit

/// The Mac window's full screen. UIKit has no API for it on Mac Catalyst, so
/// this asks the app's AppKit window, which answers the same
/// `toggleFullScreen:` as the green button. The app has a single scene, so the
/// key window is the player's.
enum MacWindowFullScreen {
	/// NSWindowStyleMaskFullScreen.
	private static let fullScreenStyleMask: UInt = 1 << 14

	private static var nsWindow: NSObject? {
		guard let app = NSClassFromString("NSApplication") as? NSObject.Type else { return nil }
		let shared = app.value(forKey: "sharedApplication") as? NSObject
		return (shared?.value(forKey: "keyWindow") ?? shared?.value(forKey: "mainWindow")) as? NSObject
	}

	static func isFullScreen() -> Bool {
		guard let mask = nsWindow?.value(forKey: "styleMask") as? UInt else { return false }
		return mask & fullScreenStyleMask != 0
	}

	static func toggle() {
		_ = nsWindow?.perform(NSSelectorFromString("toggleFullScreen:"), with: nil)
	}
}
#endif
