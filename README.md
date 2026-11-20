# Vice Route 55

Vice Route 55 is an offline road atlas for the GTA VI platinum on PS5. Follow the three legs from the Chapter 1 balcony checkpoint to the 100% checklist and final cleanup, then use the 55-trophy register to save progress, plan sessions, and inspect the research behind each guide.

Serve the app from the repository root with `python3 -m http.server 8080 --bind 127.0.0.1 --directory app` and open `http://127.0.0.1:8080/`. In the Tracker, use `j` and `k` to move, `x` to toggle earned, and `/` to focus search from any view. The planner prioritizes stops within a session; it does not estimate individual unlock times.

Run `node verify-data.mjs` to check the trophy data. Once the real screenshots are in `screenshots/`, package with Node 22.18 or later:

```sh
MAKEFUN_OUTPUT_DIR=/tmp/trophy-out-acct2 node main.ts
```

[![make.fun](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/bounty/gta6-trophy-guide-01)
[![Rank](https://make.fun/badge/gta6-trophy-guide-01/Orochim25/gta6-trophy-guide-01-entry-acct2/rank.svg)](https://make.fun/bounty/gta6-trophy-guide-01)
[![Reward](https://make.fun/badge/gta6-trophy-guide-01/Orochim25/gta6-trophy-guide-01-entry-acct2/reward.svg)](https://make.fun/bounty/gta6-trophy-guide-01)
