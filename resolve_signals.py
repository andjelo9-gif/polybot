#!/usr/bin/env python3
"""
Resolve pending copy-bet signals against actual Polymarket outcomes.

Fetches pending signals from the companion web app, looks up each market on
the Polymarket Gamma API, and reports won/lost/void back to the app.

Usage:
    APP_API_URL=https://… TRACKER_API_SECRET=… python resolve_signals.py
"""

import json
import os
import sys

import requests

GAMMA_API = "https://gamma-api.polymarket.com"
APP_API_URL = os.getenv("APP_API_URL", "").rstrip("/")
TRACKER_API_SECRET = os.getenv("TRACKER_API_SECRET", "")

# Polymarket's CDN sometimes rejects the default python-requests user agent
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    "Accept": "application/json",
}
APP_HEADERS = {"x-tracker-secret": TRACKER_API_SECRET}


def fetch_pending() -> list[dict]:
    r = requests.get(f"{APP_API_URL}/api/tracker/pending",
                     headers=APP_HEADERS, timeout=15)
    r.raise_for_status()
    return r.json()["signals"]


def fetch_markets(condition_ids: list[str]) -> dict[str, dict]:
    """conditionId -> market, batched to keep URLs reasonable."""
    markets = {}
    for i in range(0, len(condition_ids), 20):
        batch = condition_ids[i : i + 20]
        r = requests.get(
            f"{GAMMA_API}/markets",
            params=[("condition_ids", c) for c in batch],
            headers=HEADERS,
            timeout=30,
        )
        r.raise_for_status()
        for m in r.json():
            markets[m["conditionId"]] = m
    return markets


def outcome_status(market: dict, outcome_index: int, side: str) -> str | None:
    """won/lost/void for a bet, or None if the market isn't resolved yet."""
    if not market.get("closed"):
        return None
    prices = market.get("outcomePrices")
    if isinstance(prices, str):  # gamma returns a JSON-encoded list
        prices = json.loads(prices)
    if not prices or outcome_index >= len(prices):
        return None
    p = float(prices[outcome_index])
    if p > 0.99:
        return "won" if side == "BUY" else "lost"
    if p < 0.01:
        return "lost" if side == "BUY" else "won"
    return "void"  # e.g. 50/50 resolution


def main() -> None:
    if not (APP_API_URL and TRACKER_API_SECRET):
        sys.exit("APP_API_URL and TRACKER_API_SECRET must be set")

    pending = fetch_pending()
    if not pending:
        print("No pending signals.")
        return

    markets = fetch_markets(sorted({s["condition_id"] for s in pending}))
    results = []
    for s in pending:
        market = markets.get(s["condition_id"])
        if not market:
            continue
        status = outcome_status(market, s["outcome_index"], s["side"])
        if status:
            results.append({"id": s["id"], "status": status})
            print(f"signal {s['id']}: {status} ({market.get('question', '?')})")

    if not results:
        print(f"{len(pending)} pending, none resolved yet.")
        return

    r = requests.post(f"{APP_API_URL}/api/tracker/results",
                      headers=APP_HEADERS, json={"results": results}, timeout=15)
    r.raise_for_status()
    print(f"Reported {r.json()['updated']} result(s).")


if __name__ == "__main__":
    main()
