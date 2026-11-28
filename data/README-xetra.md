# Unranked Xetra seed

Downloaded2026-11-28 from Deutsche Boerse's official instrument page:
https://www.eurexgroup.com/xetra-en/instruments/instruments
Exact downloaded CSV:
https://www.cashmarket.deutsche-boerse.com/resource/blob/1528/ee949e13aaba8bcd07f9e3761f55b91c/data/t7-xetr-allTradableInstruments.csv

The source header says Date Last Update30.11.2026, which is later than download.
Treat this as source-reported metadata, not proof of current availability.
Generated with scripts/import-xetra-seed.py, filtered active XETR/EUR rows with
API-compatible mnemonics. Includes common shares (CS), ETFs, ETCs and ETNs.
Alphabetic order for stable diffs only. No popularity/turnover ranking, no top500
claim. All matching rows are included rather than an arbitrary500-row slice.
Fields are source mnemonic + .XETRA, source short instrument name, type, currency.
No expanded names, prices, ISIN or trading metadata are copied.

verified:false applies to every seed row. The seed only preserves exact-ticker
priority ahead of fuzzy name matching. It never supplies quote metadata or
proves EODHD coverage: a validated live EODHD catalog row is required before a
quote. First cold quote therefore still fetches the catalogs under normal quota.

Reuse terms are unclear. The official disclaimer supplies no explicit open
redistribution licence:
https://www.eurexgroup.com/xetra-en/disclaimer
The account owner chose to bundle this unranked factual directory with that
caveat. That decision does not establish broader distribution rights.
