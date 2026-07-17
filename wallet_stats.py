#!/usr/bin/env python3
"""
Compute win_pct_all and win_pct_7d for the wallets in polymarket_sports_wallets.csv
and write the result to a NEW file: polymarket_sports_wallets_with_winrates.csv

Win rate is computed at MARKET level: all closed positions in the same market
are netted first (whales often hold both sides as hedges). A market counts as
a win if its net realized PnL > 0.

Usage:
    python wallet_stats.py
    python wallet_stats.py --max 2000    # cap positions fetched per wallet
"""

import argparse
import csv
import os
import sys
import time
from collections import defaultdict

try:
    import requests
except ImportError:
    sys.exit("Missing dependency. Run:  pip install requests   (then re-run)")

DATA_API = "https://data-api.polymarket.com"
HEADERS = {
    # Polymarket's CDN sometimes rejects the default python-requests user agent
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    "Accept": "application/json",
}
HERE = os.path.dirname(os.path.abspath(__file__))
CSV_IN = os.path.join(HERE, "polymarket_sports_wallets.csv")
CSV_OUT = os.path.join(HERE, "polymarket_sports_wallets_with_winrates.csv")


def fetch_closed_positions(wallet, max_positions):
    out = []
    offset = 0
    session = requests.Session()
    session.headers.update(HEADERS)
    while offset < max_positions:
        last_err = None
        for attempt in range(3):
            try:
                r = session.get(
                    DATA_API + "/closed-positions",
                    params={
                        "user": wallet,
                        "limit": 50,
                        "offset": offset,
                        "sortBy": "TIMESTAMP",
                        "sortDirection": "DESC",
                    },
                    timeout=30,
                )
                r.raise_for_status()
                last_err = None
                break
            except requests.RequestException as e:
                last_err = e
                time.sleep(2 * (attempt + 1))
        if last_err:
            raise last_err
        batch = r.json()
        if not isinstance(batch, list):
            raise RuntimeError("Unexpected API response: %.200s" % str(batch))
        out.extend(batch)
        if len(batch) < 50:
            break
        offset += 50
        time.sleep(0.15)
    return out


def win_rates(positions, since_ts=None):
    per_market = defaultdict(float)
    for p in positions:
        if since_ts and p.get("timestamp", 0) < since_ts:
            continue
        per_market[p.get("conditionId", "?")] += p.get("realizedPnl", 0) or 0
    if not per_market:
        return 0.0, 0
    wins = sum(1 for pnl in per_market.values() if pnl > 0)
    return 100.0 * wins / len(per_market), len(per_market)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--max", type=int, default=5000)
    args = parser.parse_args()

    if not os.path.exists(CSV_IN):
        sys.exit("Cannot find %s\nPut the CSV in the same folder as this script." % CSV_IN)

    # Quick connectivity self-test before doing 20 wallets
    print("Testing API connectivity...", end=" ", flush=True)
    try:
        t = requests.get(DATA_API + "/closed-positions",
                         params={"user": "0x204f72f35326db932158cba6adff0b9a1da95e14",
                                 "limit": 1},
                         headers=HEADERS, timeout=30)
        t.raise_for_status()
        print("OK (HTTP %d)" % t.status_code)
    except requests.RequestException as e:
        sys.exit("FAILED: %s\n\nThe API is not reachable from this machine "
                 "(firewall/VPN/geo-block?). Try a VPN or another network." % e)

    with open(CSV_IN, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    week_ago = int(time.time()) - 7 * 86400
    failures = 0

    for row in rows:
        sys.stdout.write("%-24s " % row["username"])
        sys.stdout.flush()
        try:
            positions = fetch_closed_positions(row["wallet"], args.max)
        except Exception as e:
            failures += 1
            print("FAILED: %s" % e)
            continue
        pct_all, n_all = win_rates(positions)
        pct_7d, n_7d = win_rates(positions, since_ts=week_ago)
        row["win_pct_all"] = "%.1f" % pct_all
        row["win_pct_7d"] = ("%.1f" % pct_7d) if n_7d else ""
        if n_7d:
            print("win%% %5.1f (%d markets) | 7d: %5.1f%% (%d markets)"
                  % (pct_all, n_all, pct_7d, n_7d))
        else:
            print("win%% %5.1f (%d markets) | 7d: no activity" % (pct_all, n_all))

    with open(CSV_OUT, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    print("\nWrote: %s" % CSV_OUT)
    if failures:
        print("NOTE: %d wallet(s) failed - re-run to retry them." % failures)


if __name__ == "__main__":
    main()