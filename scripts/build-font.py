# Offline maintainer script. Pillow is not a runtime or npm dependency.
from PIL import Image,ImageDraw,ImageFont
import json,base64,gzip
from pathlib import Path
out={}
for size in [11,12,23,34]:
 font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans'+('-Bold' if size>12 else '')+'.ttf',size*3)
 chars={}
 for ch in map(chr,range(32,127)):
  box=font.getbbox(ch);w=max(1,box[2]);h=max(1,box[3]-box[1]);im=Image.new('L',(w,h));ImageDraw.Draw(im).text((0,-box[1]),ch,font=font,fill=255)
  chars[ch]=[w,h,box[1],round(font.getlength(ch)),base64.b64encode(im.tobytes()).decode()]
 out[size]=chars
Path('data/chart-font.json.gz').write_bytes(gzip.compress(json.dumps(out,separators=(',',':')).encode(),mtime=0))
