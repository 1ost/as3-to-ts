from pathlib import Path
import hashlib,json,xml.etree.ElementTree as ET
r=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
captures=[]
for name,pin in json.loads((r/'capture-pins.json').read_text()).items():
 c=r/name;assert sha(c/'provenance.json')==pin
 for item in json.loads((c/'provenance.json').read_text())['files']:
  p=c/Path(item['path']);p=p if p.exists() else c/'sources'/Path(item['path'])
  assert sha(p)==item['sha256'],str(p)
 captures.append(json.loads((c/'flash.json').read_text()))
assert len(captures)==2 and captures[0]['rows']==captures[1]['rows'] and len(captures[0]['rows'])==21
def semantic(n):return (n.tag,tuple(sorted(n.attrib.items())),tuple(sorted(semantic(c) for c in n)))
for key in ['reflection','instances']:
 assert len(captures[0][key])==len(captures[1][key])==2
 for a,b in zip(captures[0][key],captures[1][key]):assert semantic(ET.fromstring(a))==semantic(ET.fromstring(b))
for c in captures:
 for cls,inst in zip(c['reflection'],c['instances']):
  x=ET.fromstring(cls);y=ET.fromstring(inst)
  assert x.attrib['name']==y.attrib['name']
  f=x.find('factory');assert f is not None
  assert sorted(semantic(n) for n in f)==sorted(semantic(n) for n in y)
print(json.dumps({'captures':2,'identicalRows':21,'completeClassDocuments':4,'completeInstanceDocuments':4,'factoryInstanceTraitsEqual':True}))
