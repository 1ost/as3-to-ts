from pathlib import Path
import hashlib,json,xml.etree.ElementTree as ET
here=Path(__file__).resolve().parent
assert hashlib.sha256((here/'files.json').read_bytes()).hexdigest() == 'db0de13bfb6c1ca3552ce2183ec8be33388218d9e9effda1d290b19d1903f5d8'
for f in json.loads((here/'files.json').read_text()):assert hashlib.sha256((here/f['path']).read_bytes()).hexdigest()==f['sha256'],f['path']
def canon(e):return [e.tag,sorted(e.attrib.items()),(e.text or '').strip(),sorted([canon(x) for x in e],key=lambda x:json.dumps(x,sort_keys=True))]
reports=[]
for folder,first,second,count,held in [('retained76','capture-c','capture-d',76,False),('expressions14','capture-c','capture-d',14,False),('collision','capture-c','capture-d',6,False),('mixed4','capture-e','capture-f',4,True)]:
 values=[]
 for n in [first,second]:
  base=here/'fixtures'/folder/n;r=json.loads((base/'provenance.json').read_text(encoding='utf-8'))
  for f in r['files']:
   p=base/f['path'];p=p if p.exists() else base/'sources'/f['path'];assert hashlib.sha256(p.read_bytes()).hexdigest()==f['sha256'],str(p)
  values.append(json.loads((base/'flash.json').read_text(encoding='utf-8')))
 assert values[0]['rows']==values[1]['rows'] and len(values[0]['rows'])==count
 for role,single in [('reflection','classXML'),('instances','instanceXML')]:
  a=values[0].get(role,[values[0].get(single)]);b=values[1].get(role,[values[1].get(single)]);assert len(a)==len(b)==1;assert canon(ET.fromstring(a[0]))==canon(ET.fromstring(b[0]))
 reports.append(dict(fixture=folder,rows=count,matchingCaptures=2,fullReflection=True,wholeSourceHeld=held))
print(json.dumps(reports))
