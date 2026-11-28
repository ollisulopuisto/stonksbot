#!/usr/bin/env python3
"""Build offline US instrument name index from a reviewed Nasdaq directory."""
import argparse,csv,json,re
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--source-date',required=True);p.add_argument('--retrieved',required=True);p.add_argument('--output',default='data/us-symbol-names.json');a=p.parse_args()
entries=[];seen=set()
for r in csv.DictReader(Path(a.input).open(),delimiter='|'):
 s=r['Symbol']
 if r.get('Test Issue')!='N' or not re.fullmatch(r'[A-Z][A-Z0-9]{0,9}(?:[.-][AB])?',s):continue
 if s in seen:raise ValueError('Duplicate US symbol')
 seen.add(s);entries.append(dict(symbol=s,name=r['Security Name'],route=s+'.US'))
if len(entries)<5000:raise ValueError('Unexpectedly small source, review download')
obj=dict(source='https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqtraded.txt',sourceDate=a.source_date,snapshotFooter=Path(a.input).read_text().splitlines()[-1],retrieved=a.retrieved,entries=entries)
Path(a.output).write_text(json.dumps(obj,ensure_ascii=False,separators=(',',':'))+'\n');print('entries',len(entries))
