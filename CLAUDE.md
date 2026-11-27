# Working rules for this repo

- The lead Claude session is the maintainer of `.claude/skills/reel-factory`: it plans, writes briefs, reviews (by eye and tests) and commits. It decides skill changes without asking the user.
- Workers: Sonnet subagents for implementation, Haiku subagents for research/lookups. The lead does not write skill code itself, apart from trivial git/file housekeeping.
- Human checkpoints in the reel workflow (script approval, visual approval, final watch) stay with the user.
- Never commit WAV/MP4 or other regenerable media; keep reel caches git-ignored.
