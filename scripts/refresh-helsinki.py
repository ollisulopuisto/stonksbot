#!/usr/bin/env python3
"""Offline refresh from reviewed CC0 CSV and Nasdaq US directory downloads."""
import argparse,csv,json,re
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--finland-csv',required=True);p.add_argument('--us-directory',required=True);p.add_argument('--revision',required=True);p.add_argument('--source-date',required=True);p.add_argument('--retrieved',required=True);p.add_argument('--output',default='data/helsinki-symbols.json');a=p.parse_args()
us={r['Symbol'] for r in csv.DictReader(Path(a.us_directory).open(),delimiter='|') if r.get('Test Issue')=='N'}
entries=[];seen=set()
for row in csv.DictReader(Path(a.finland_csv).open()):
 symbol=row['ticker'].replace('_','-')
 if row['market']!='OMXHEX' or not re.fullmatch('[A-Z][A-Z0-9-]{0,12}',symbol) or symbol in seen or not row['name'].strip():raise ValueError('Invalid/duplicate Finland row')
 seen.add(symbol);entries.append(dict(symbol=symbol,name=row['name'],route=symbol+'.HE',ambiguous=symbol in us))
if len(entries)<100:raise ValueError('Unexpectedly short directory; review source')
obj=dict(source='https://huggingface.co/datasets/kjhq/Finland-Stock-Symbols-and-Metadata',revision=a.revision,sourceDate=a.source_date,license='CC0-1.0',retrieved=a.retrieved,usCollisionSource='https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqtraded.txt',usSnapshotFooter=Path(a.us_directory).read_text().splitlines()[-1],entries=entries)
Path(a.output).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n');print('entries',len(entries),'overlaps',[e['symbol'] for e in entries if e['ambiguous']])
