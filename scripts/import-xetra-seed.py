# Offline import only. Download source manually; see data/README-xetra.md.
import csv,json,re,sys
from pathlib import Path
with open(sys.argv[1],encoding='utf-8-sig') as f:
 f.readline();f.readline();rows=list(csv.DictReader(f,delimiter=';'))
items={}
for r in rows:
 code=r['Mnemonic']
 if r['MIC Code']=='XETR' and r['Currency']=='EUR' and r['Instrument Status']=='Active' and r['Product Status']=='Active' and re.fullmatch('[A-Z][A-Z0-9-]{0,9}',code):
  item={'symbol':code+'.XETRA','name':r['Instrument'],'type':r['Instrument Type'],'currency':'EUR'}
  if code in items and items[code]!=item:raise ValueError('Conflicting duplicate mnemonic')
  items[code]=item
Path(sys.argv[2]).write_text(json.dumps({'verified':False,'entries':sorted(items.values(),key=lambda r:r['symbol'])},ensure_ascii=False,indent=2)+'\n')
print(len(items))
