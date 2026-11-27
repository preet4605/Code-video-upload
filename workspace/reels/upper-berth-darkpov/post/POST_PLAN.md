# Posting plan: Upar Wali Berth (dark-POV v4)

Status: planned, NOT posted. Needs the user's go at two points (hosting push, post call).

## Files (workspace/reels/upper-berth-darkpov/post/)
| File | Notes |
|---|---|
| upar-wali-berth_post.mp4 | 68.7 s, 1080x1920, 30 fps, H.264 2-pass 3.2 Mbps + AAC 192k, faststart, 28 MB. -14.3 LUFS, peak -1.6 dBFS. SSIM 0.989 vs master (out/upper-berth.mp4, 91.5 MB). Not committed (media rule). |
| cover.jpg | Frame at 37.8 s: pale-face reveal, red "S7 02:00" HUD. |
| caption.txt | ig-caption lint READY (1 ask, 5 tags, search terms "train horror story", "hindi horror kahani"). |
| ../CREDITS.txt | All 7 sounds CC0/public domain (earshot renders): no credit required. |
QA: master_and_qa verdict SHIP with one disclosed waiver (visual loop not fully converged; reason in ../qa.json).

## When
Fri 28 Nov 2026, 9:00 PM IST (15:30 UTC): matches "roz raat 9 baje" and the account's horror slot.
No other horror post the same evening.

## Hosting (needs the user's explicit OK: public repo, separate branch)
Windsor create_video_post needs a public video_url and cover_url.
1. At ~8:30 PM IST, push post/upar-wali-berth_post.mp4 and post/cover.jpg to a hosting branch, e.g. `reels-hosting`, under reels/upar-wali-berth/ (only these two files; this is the one exception to the no-media rule, kept off the work branch).
2. Raw URL: https://raw.githubusercontent.com/preet4605/Code-video-upload/reels-hosting/reels/upar-wali-berth/upar-wali-berth_post.mp4 (and cover.jpg).
3. Preflight: `curl -sI <url>` returns 200 and Content-Length equals the local size, for both files.

## Post (Windsor, instagram account 17841480644262667 = doomsday_penguin)
1. create_video_post: video_url, caption = exact text of caption.txt, cover_url, share_to_feed true.
2. NEVER retry the call, even on timeout (a retry can double-post).
3. Optional first comment: none needed (no link, no vote).

## Confirm it is live
1. A Windsor reply with a media_id counts as posted: save media_id + permalink in this file.
2. On timeout/error: do not retry. Windsor reads are cached (this plan: no on-demand refresh), so an empty list proves nothing. Check the Instagram app: profile > Reels.
3. Live = permalink opens, plays to the end with sound, caption matches, cover is the face frame, comments on.

## After posting
- Delete the hosting files/branch after Instagram has ingested the video (a few hours), unless the user wants them kept.
- Record media_id, permalink and post time below.

## Log
- (empty)
