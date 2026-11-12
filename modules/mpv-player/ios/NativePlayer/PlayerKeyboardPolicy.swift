import Foundation

/// The keys the native player answers on a hardware keyboard.
enum PlayerKey: Equatable {
	case space
	case leftArrow
	case rightArrow
	case upArrow
	case downArrow
	case f
	case m
	case escape
}

enum PlayerKeyAction: Equatable {
	case togglePlayPause
	case seekBackward
	case seekForward
	case volumeUp
	case volumeDown
	case toggleMute
	case toggleFullScreen
	case exitFullScreen
	case close
}

/// What is on screen when a key arrives, as far as the keyboard cares.
struct PlayerKeyboardState: Equatable {
	/// A prompt, a sheet, the lock mode or the error overlay is up. It owns
	/// every key, as it owns the touches: nothing may resume or move playback
	/// under it.
	var overlayOwnsInput = false
	/// The subtitle size panel is up. It is not modal, the controls under it
	/// keep working, but its slider takes the arrows.
	var subtitleScaleShown = false
	/// A finger is on the scrubber, and a key would fight the drag.
	var isScrubbing = false
	/// The stream is loaded and has a duration. Between two episodes it has
	/// neither, and a seek sent then lands in the next one.
	var canSeek = true
	/// In SyncPlay a seek is a request to the group.
	var syncPlayActive = false
	/// The Mac window is in full screen, where Escape leaves it before it
	/// closes the player.
	var windowFullScreen = false
}

/// Kept free of UIKit so `scripts/ios/test-player-keyboard-policy.sh` can run
/// it on macOS.
enum PlayerKeyboardPolicy {
	/// Whether the arrows are key commands, which repeat while held. In
	/// SyncPlay each repeat would ask the group for the same target until it
	/// answers, so the arrows are presses there, one seek per press.
	static func registersArrowCommands(in state: PlayerKeyboardState) -> Bool {
		!state.syncPlayActive && arrowsSeek(in: state)
	}

	/// What a key command does when it fires. A repeat fires from the command
	/// the arrow went down with, so each one is checked against the state of
	/// that moment.
	static func commandAction(for key: PlayerKey, in state: PlayerKeyboardState) -> PlayerKeyAction? {
		switch key {
		case .leftArrow, .rightArrow:
			guard registersArrowCommands(in: state) else { return nil }
			return seekAction(for: key)
		case .upArrow, .downArrow:
			guard registersVolumeCommands(in: state) else { return nil }
			return key == .upArrow ? .volumeUp : .volumeDown
		case .space, .f, .m, .escape:
			return nil
		}
	}

	/// Whether up and down are key commands. Volume is local even in SyncPlay,
	/// so they repeat there too.
	static func registersVolumeCommands(in state: PlayerKeyboardState) -> Bool {
		!state.overlayOwnsInput && !state.subtitleScaleShown && !state.isScrubbing
	}

	/// What a key press does, or nil to send it up the responder chain. A
	/// press with Shift, Control, Option or Command is someone else's shortcut.
	static func pressAction(for key: PlayerKey, modified: Bool, in state: PlayerKeyboardState) -> PlayerKeyAction? {
		guard !modified, !state.overlayOwnsInput, !state.isScrubbing else { return nil }
		switch key {
		case .space:
			// A press fires once, so a held space bar toggles once.
			return .togglePlayPause
		case .leftArrow, .rightArrow:
			// Outside SyncPlay the key command takes the arrows.
			guard state.syncPlayActive, arrowsSeek(in: state) else { return nil }
			return seekAction(for: key)
		case .upArrow, .downArrow:
			// Always key commands.
			return nil
		case .f:
			return .toggleFullScreen
		case .m:
			return .toggleMute
		case .escape:
			return state.windowFullScreen ? .exitFullScreen : .close
		}
	}

	private static func arrowsSeek(in state: PlayerKeyboardState) -> Bool {
		!state.overlayOwnsInput && !state.subtitleScaleShown && !state.isScrubbing && state.canSeek
	}

	private static func seekAction(for key: PlayerKey) -> PlayerKeyAction? {
		switch key {
		case .leftArrow: return .seekBackward
		case .rightArrow: return .seekForward
		default: return nil
		}
	}
}
