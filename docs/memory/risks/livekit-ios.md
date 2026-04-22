# Risks — LiveKit audio on iOS Safari

## Open

### Autoplay blocked on iOS Safari
**Risk:** Mobile Safari requires a user gesture (tap) before starting audio playback. Our buyer-live screen wants to auto-connect to the LiveKit room and stream the seller's mic, but iOS will silently refuse until the user taps something.
**Owner:** Me.
**Trigger:** First iOS user on the live screen.
**Blocks:** M7 audio on mobile.
**Mitigation:** Tap-to-unmute overlay on first load on iOS. Detect via `navigator.mediaDevices` + user-agent. Show an "Enable audio" button over the stream component until tapped; on tap, start playback and hide the overlay.
**Status:** Planned for M7.

### Background tab audio suspension
**Risk:** iOS throttles audio in background tabs aggressively. A buyer who switches to another app or tab loses the stream; when they return, it may not resume. LiveKit reconnect works but takes ~2–5s.
**Owner:** Me.
**Trigger:** User testing.
**Blocks:** UX polish, not the feature.
**Mitigation:** Show reconnecting state + "reconnect" button.
**Status:** Planned for M7 polish.

### Bandwidth + data
**Risk:** Audio-only is cheap (~40 kbps Opus), but in a 2-hour auction that's ~36MB. Users on cellular should know.
**Owner:** Me.
**Trigger:** Launch.
**Blocks:** Nothing.
**Mitigation:** Show audio-enabled state prominently so users can mute. Maybe a "low-data mode" toggle in v2.
**Status:** Deferred.

---

## Archive

_(none)_
