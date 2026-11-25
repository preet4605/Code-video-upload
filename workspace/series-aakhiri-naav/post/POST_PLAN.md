# Posting plan: आख़िरी नाव Part 2A + 2B (nothing posted or pushed yet; needs Love's go)

## Files (all in /mnt/project-files/series-aakhiri-naav/post/)
| | ep2a | ep2b |
|---|---|---|
| Video to upload | ep2a/ep2a_post.mp4 (99.3 s, 29.9 MB) | ep2b/ep2b_post.mp4 (103.7 s, 32.2 MB) |
| Master (higher quality) | ../production/final/ep2a_final.mp4 | ../production/final/ep2b_final.mp4 |
| Caption | ep2a/caption.txt (lint READY) | ep2b/caption.txt (lint READY) |
| Cover (JPEG 1080x1920) | ep2a/cover.jpg (hands on the cabin window) | ep2b/cover.jpg (walker upside down under the water) |
Loudness of the upload copies: -14.6 LUFS, peak -2.5 / -2.4 dBFS. Both open with the choice recap and end with the A/B ask.

## Timing (IST, Thursday 26 Nov 2026)
- 2A at 9:00 PM, 2B at 10:00 PM. A first because the tie rule favours A.
- Why same evening: the intro and outro tell viewers the other branch exists; a one-day gap breaks that promise. No data shows the one-hour gap is better than other gaps.
- Vote closes Fri 27 Nov 10:00 PM. Count both reels' comments together, one vote per person, tie -> A.

## Hosting (do at ~8:30 PM, not before Love approves; the repo is public)
Push `*_post.mp4` and `cover.jpg` to Code-video-upload branch `claude/project-thread-4ki4nb` under `reels/ep2a/` and `reels/ep2b/`. Raw URL pattern: https://raw.githubusercontent.com/preet4605/Code-video-upload/claude/project-thread-4ki4nb/reels/ep2a/ep2a_post.mp4
Preflight: `curl -sI <url>` returns 200 and the Content-Length equals the local file size, for both video and cover.

## Post call (Windsor, account 17841480644262667)
`create_video_post`: video_url, caption (exact file text), cover_url, share_to_feed true. **Never retry the call, even on timeout.** Then `create_comment` with the vote comment below. Love pins it in the app (no pin API).

## Vote comment (same on both reels)
`VOTE: A = kandhe ka nishaan chhoo kar dekho · B = jheel ko pukaro. Part 2A aur 2B dono ke comments jodunga, 27 Nov raat 10 baje tak. Barabar hua toh A. Jeet wala Part 3 ka opening banega.`

## Confirm a post is live (Saajan lesson)
1. A Windsor reply with a media_id counts as posted. Save media_id and permalink.
2. On a timeout or error: do not retry. Windsor read data is cached (hourly at best), so an empty list in the first hour proves nothing. The real check is the Instagram app: profile, Reels tab.
3. Live means: permalink opens, plays to the end with sound, caption matches the file, cover is the one set, comments are on, vote comment is visible.
4. A duplicate is removed with `delete_media` only if Love says so.
5. Record both permalinks in memory and in this folder.
Open item: the Saajan post of 25 Nov does not appear in the Windsor list. That is not proof it failed. Check the profile in the app.

## After posting
- Read comments at the close with Windsor (verify field names with get_fields first), tally, tell Love, then build the ep3 opener (A or B) and the ep3 body.
- Compare average watch time of 2A/2B with ep1 (14 s of 55 s). If it is under ~20 s, test a version with the recap cut to 3 s; that conflicts with Love's recap rule, so Love decides.
