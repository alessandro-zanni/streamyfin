# Cloudflare cuts transcoded downloads, and HTTP/3 makes the cut fatal

**Date**: 2026-09-20
**Category**: downloads
**Key files**: `modules/background-downloader/ios/BackgroundDownloaderModule.swift`, `utils/jellyfin/media/getStreamUrl.ts`

## Detail

A server reached through a Cloudflare tunnel drops a transcoded download roughly 26
seconds in, every time. A direct download of the same size does not: `/Items/{id}/Download`
carries a `Content-Length`, while a transcode is a progressive stream of unknown length
(`accept-ranges: none`), and only the second one gets cut.

Where the cut comes from, established by elimination and worth not re-deriving:

- `cloudflared` logs `stream <n> canceled by remote with error code 0` at the same second
  the client fails, so the cancel arrives from Cloudflare's edge. Jellyfin logs nothing:
  its ffmpeg runs on, several times faster than the client downloads, and its own
  "kill timer" message comes ten seconds later, after the request is already gone.
- The same URL over Tailscale, straight to port 8096, streams fine.
- The protocol decides whether the download survives. Over HTTP/3 the client gets
  `-1017 cannot parse response`, which is not retryable, and the download dies. Over
  HTTP/2 it gets `-1005 network connection lost`, and `nsurlsessiond` recreates the task
  from resume data about a second later, so the download finishes despite being cut
  repeatedly. Turning HTTP/3 off in the Cloudflare zone does not stop the cut, it only
  makes it recoverable — and URLSession has no public API to refuse HTTP/3.

So a "download failed" report against a Cloudflare-fronted server is not necessarily an
app bug. Check whether the item was transcoded first: Jellyfin transcodes the whole video
when the chosen subtitle is an image format (PGS), because it has to burn it in.

The client-side evidence lives in the unified log, not in Metro:
`/usr/bin/log show --predicate 'process == "nsurlsessiond"'` prints the failing task with
its protocol and error code. (`log` alone is a zsh builtin and silently fails.)
