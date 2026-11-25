# Doomsday Horror: 10 reels

Made 2026-11-24 from the plan "Profile Audit + 10 Horror Reels Plan". Folder number = the plan's reel number. Each folder has the MP4, script.md (spoken lines + IG caption + hashtags), qa_report.json, contact sheets and source/.

| Post date (plan) | Folder | Reel | Length | QA |
|---|---|---|---|---|
| Wed 25 Nov | reel-01 | Raat 2 Baje, Part 3 | 51s | SHIP |
| Thu 26 Nov | reel-02 | Ranga, Part 2 | 52s | SHIP |
| Fri 27 Nov | reel-04 | Chudail ko pehchanne ke 3 tareeke | 39s | SHIP |
| Sat 28 Nov | reel-05 | 3:33 pe Mummy ka call | 36s | SHIP |
| Sun 29 Nov | reel-06 | Highway pe lift mat dena | 45s | SHIP |
| Mon 30 Nov | reel-03 | Lift mein 13 ka button | 45s | SHIP |
| Tue 1 Dec | reel-07 | Aaine mein der se jhapki | 36s | SHIP |
| Wed 2 Dec | reel-08 | Hostel mein ek bed zyada | 38s | SHIP |
| Thu 3 Dec | reel-09 | Peepal ke neeche mat sona | 43s | SHIP |
| Fri 4 Dec | reel-10 | Teen baar khatkhatana (finale) | 43s | SHIP |

SHIP = no measured defect (flashes, freeze, black, dead air, loudness -14 LUFS, voice 16-18 LU over the music bed). It does not check pronunciation or taste.

Listen-check before posting (a speech-to-text pass flagged these):
- reel-08: "अट्ठाईस" (28) in the very first line was transcribed as "18". The same word later in the reel was transcribed correctly.
- reel-07: "reflection" spoken in Hindi came out garbled in the transcript.
- reel-01: "छत से" (chhat se) slurred in line 2.
- reel-06: "हाथ" (haath) heard as "aad/raat" in places.

Rebuild one reel: tools/build_vo.mjs <reel-dir>, then tools/make.sh <reel-dir> (needs the code-video-studio skill next to tools/ as skill/, and KALPA_API_KEY).
