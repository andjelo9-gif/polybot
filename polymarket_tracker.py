#!/usr/bin/env python3
"""
Polymarket copy-bet tracker.

Polls the public Polymarket Data API for the trade activity of a list of
tracked wallets. When at least ALERT_THRESHOLD distinct wallets place the
same bet (same market + same outcome + same side) within TIME_WINDOW_HOURS,
sends a notification to Discord.

No API keys needed for Polymarket (Data API is public).
Config via environment variables or the CONFIG block below.

Usage:
    pip install requests
    python polymarket_tracker.py            # run forever (polls every POLL_SECONDS)
    python polymarket_tracker.py --once     # single check (for cron / n8n / task scheduler)
    python polymarket_tracker.py --test     # send a test notification and exit
"""

import argparse
import json
import os
import sys
import time
from collections import defaultdict
from pathlib import Path

import requests

# Windows consoles default to cp1252, which can't print the emoji in alerts
for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        stream.reconfigure(encoding="utf-8", errors="replace")

# ─────────────────────────── CONFIG ───────────────────────────

# Wallet addresses (0x...) of the profiles to track. Find them on a profile
# page URL: https://polymarket.com/profile/<address>
TRACKED_WALLETS = [
    "0x204f72f35326db932158cba6adff0b9a1da95e14",
    "0x94f199fb7789f1aef7fff6b758d6b375100f4c7a",
    "0xe90bec87d9ef430f27f9dcfe72c34b76967d5da2",
    "0x507e52ef684ca2dd91f90a9d26d149dd3288beae",
    "0xc2e7800b5af46e6093872b177b7a5e7f0563be51",
    "0x006cc834cc092684f1b56626e23bedb3835c16ea",
    "0xefbc5fec8d7b0acdc8911bdd9a98d6964308f9a2",
    "0x019782cab5d844f02bafb71f512758be78579f3c",
    "0x9495425feeb0c250accb89275c97587011b19a27",
    "0x36a3f17401e395ef4cb1b7f42bcdb8ab8e15fafb",
    "0x2005d16a84ceefa912d4e380cd32e7ff827875ea",
    "0xf0318c32136c2db7fec88b84869aee6a1106c80c",
    "0xe549581668a5751c1972d3ad2d1991d900bd2d54",
    "0xc8ec6d4cef5c5fe8409ef69303c37f05b678e8f1",
    "0x5c3a1a602848565bb16165fcd460b00c3d43020b",
    "0x83255595ba1fadd2e734cb30a0fb8110301a19cc",
    "0x6d20c35f65d9899b6d6b74f8466e824580f9a165",
    "0x3f6e93d1e2c2846a357276e29e7e9147e29c18d9",
    "0x447d7eb8ecb8930e7b5f353b4298e2562d905eea",
    "0x8b3234f9027f4e994e949df4b48b90ab79015950",
]

ALERT_THRESHOLD = 3        # distinct wallets on the same bet
TIME_WINDOW_HOURS = 24     # trades must fall within this window (tune later)
POLL_SECONDS = 60          # how often to poll in continuous mode
MIN_USDC_SIZE = 0          # ignore trades smaller than this (USD); 0 = keep all

# Discord: create a webhook in your server (Channel settings → Integrations)
# and provide it via the DISCORD_WEBHOOK_URL environment variable.
DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL", "")

# Numeric Discord user ID to ping in every alert (empty = no ping).
DISCORD_MENTION_USER_ID = os.getenv("DISCORD_MENTION_USER_ID", "")

# Companion web app (Vercel). When configured, the wallet list comes from the
# app's DB and every signal is recorded there for win/loss tracking.
APP_API_URL = os.getenv("APP_API_URL", "").rstrip("/")
TRACKER_API_SECRET = os.getenv("TRACKER_API_SECRET", "")

STATE_FILE = Path(os.getenv("STATE_FILE", "tracker_state.json"))

# ──────────────────────────────────────────────────────────────

DATA_API = "https://data-api.polymarket.com"
env_wallets = os.getenv("TRACKED_WALLETS", "")
if env_wallets:
    TRACKED_WALLETS = [w.strip().lower() for w in env_wallets.split(",") if w.strip()]
else:
    TRACKED_WALLETS = [w.lower() for w in TRACKED_WALLETS]


def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except (json.JSONDecodeError, OSError):
            pass
    return {"trades": {}, "alerted": []}


def save_state(state: dict) -> None:
    STATE_FILE.write_text(json.dumps(state))


def fetch_trades(wallet: str, since: int) -> list[dict]:
    """Fetch TRADE activity for a wallet since a unix timestamp.

    The API rejects offset > 3000, so at most 3500 trades come back per
    wallet (newest first). For hyperactive wallets the oldest trades in
    the window are dropped, which is fine for recent-match detection.
    """
    trades, offset = [], 0
    while True:
        r = requests.get(
            f"{DATA_API}/activity",
            params={
                "user": wallet,
                "type": "TRADE",
                "start": since,
                "limit": 500,
                "offset": offset,
                "sortBy": "TIMESTAMP",
                "sortDirection": "DESC",
            },
            timeout=30,
        )
        r.raise_for_status()
        batch = r.json()
        trades.extend(batch)
        if len(batch) < 500 or offset >= 3000:
            break
        offset += 500
    return trades


def bet_key(trade: dict) -> str:
    """Same bet = same market + outcome + side."""
    return f"{trade['conditionId']}|{trade['outcomeIndex']}|{trade['side']}"


def detect_matches(state: dict, window_start: int) -> list[dict]:
    """Group stored trades by bet, return groups with >= ALERT_THRESHOLD wallets."""
    groups = defaultdict(dict)  # key -> {wallet: trade}
    for t in state["trades"].values():
        if t["timestamp"] >= window_start:
            k = bet_key(t)
            w = t["proxyWallet"].lower()
            # keep the earliest trade per wallet per bet
            if w not in groups[k] or t["timestamp"] < groups[k][w]["timestamp"]:
                groups[k][w] = t

    matches = []
    for k, wallets in groups.items():
        if len(wallets) >= ALERT_THRESHOLD:
            # dedupe: alert once per bet + wallet-set
            alert_id = k + "|" + ",".join(sorted(wallets))
            if alert_id not in state["alerted"]:
                state["alerted"].append(alert_id)
                matches.append({"key": k, "trades": list(wallets.values())})
    # keep alerted list bounded
    state["alerted"] = state["alerted"][-2000:]
    return matches


def format_alert(match: dict) -> str:
    t0 = match["trades"][0]
    n = len(match["trades"])
    lines = [
        f"🚨 {n} tracked profiles placed the same bet",
        f"Market: {t0['title']}",
        f"Bet: {t0['side']} \"{t0['outcome']}\"",
        f"Link: https://polymarket.com/event/{t0['eventSlug']}",
        "",
    ]
    for t in sorted(match["trades"], key=lambda x: x["timestamp"]):
        who = t.get("name") or t.get("pseudonym") or t["proxyWallet"][:10]
        ts = time.strftime("%Y-%m-%d %H:%M Lisbon", time.localtime(t["timestamp"]))
        odds = 1 / t["price"] if t["price"] else 0.0
        lines.append(f"• {who}: ${t['usdcSize']:.2f} @ {odds:.2f} ({ts})")
    return "\n".join(lines)


def notify(message: str) -> None:
    if DISCORD_MENTION_USER_ID:
        message = f"<@{DISCORD_MENTION_USER_ID}> " + message
    if not DISCORD_WEBHOOK_URL:
        print("[alert - no notifier configured]\n" + message)
        return
    try:
        requests.post(DISCORD_WEBHOOK_URL, json={"content": message[:1990]}, timeout=15)
    except requests.RequestException as e:
        print(f"[warn] Discord notify failed: {e}", file=sys.stderr)


def app_configured() -> bool:
    return bool(APP_API_URL and TRACKER_API_SECRET)


def fetch_tracked_wallets() -> list[str]:
    """Wallet list from the web app, falling back to the local config."""
    if app_configured():
        try:
            r = requests.get(
                f"{APP_API_URL}/api/tracker/wallets",
                headers={"x-tracker-secret": TRACKER_API_SECRET},
                timeout=15,
            )
            r.raise_for_status()
            wallets = r.json()["wallets"]
            if wallets:
                return wallets
        except (requests.RequestException, KeyError, ValueError) as e:
            print(f"[warn] wallet fetch from app failed, using local list: {e}",
                  file=sys.stderr)
    return TRACKED_WALLETS


def record_signal(match: dict) -> None:
    """Store an alert in the web app for win/loss tracking. Never fatal."""
    if not app_configured():
        return
    t0 = match["trades"][0]
    payload = {
        "condition_id": t0["conditionId"],
        "outcome_index": t0["outcomeIndex"],
        "side": t0["side"],
        "outcome_name": t0.get("outcome"),
        "title": t0.get("title"),
        "event_slug": t0.get("eventSlug"),
        "trades": [
            {
                "wallet": t["proxyWallet"],
                "price": t["price"],
                "usdc_size": t["usdcSize"],
                "timestamp": t["timestamp"],
            }
            for t in match["trades"]
        ],
    }
    try:
        r = requests.post(
            f"{APP_API_URL}/api/tracker/signals",
            headers={"x-tracker-secret": TRACKER_API_SECRET},
            json=payload,
            timeout=15,
        )
        r.raise_for_status()
    except requests.RequestException as e:
        print(f"[warn] failed to record signal in app: {e}", file=sys.stderr)


def run_check(state: dict) -> None:
    now = int(time.time())
    window_start = now - TIME_WINDOW_HOURS * 3600

    for wallet in fetch_tracked_wallets():
        try:
            for t in fetch_trades(wallet, window_start):
                if t.get("usdcSize", 0) < MIN_USDC_SIZE:
                    continue
                state["trades"][t["transactionHash"] + t.get("asset", "")] = t
        except requests.RequestException as e:
            print(f"[warn] fetch failed for {wallet}: {e}", file=sys.stderr)

    # drop trades outside the window
    state["trades"] = {
        k: t for k, t in state["trades"].items() if t["timestamp"] >= window_start
    }

    for match in detect_matches(state, window_start):
        msg = format_alert(match)
        print(msg)
        notify(msg)
        record_signal(match)

    save_state(state)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true", help="single check, then exit")
    parser.add_argument("--test", action="store_true", help="send test notification")
    args = parser.parse_args()

    if args.test:
        notify("✅ Polymarket tracker test notification — setup works.")
        return

    if len(TRACKED_WALLETS) < ALERT_THRESHOLD:
        sys.exit(
            f"Add at least {ALERT_THRESHOLD} wallets to TRACKED_WALLETS "
            "(you planned 10+). Edit the CONFIG block or set the "
            "TRACKED_WALLETS env var (comma-separated)."
        )

    state = load_state()
    if args.once:
        run_check(state)
        return

    print(
        f"Tracking {len(TRACKED_WALLETS)} wallets | threshold {ALERT_THRESHOLD} "
        f"| window {TIME_WINDOW_HOURS}h | polling every {POLL_SECONDS}s"
    )
    while True:
        try:
            run_check(state)
        except Exception as e:  # keep the loop alive
            print(f"[error] {e}", file=sys.stderr)
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()