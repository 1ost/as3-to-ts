from pathlib import Path
import json,hashlib,sys,xml.etree.ElementTree as ET
h=Path(__file__).resolve().parent
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def tree(n):return [n.tag,sorted(n.attrib.items()),(n.text or '').strip(),sorted([tree(c) for c in n],key=repr)]
def check_capture(base):
 receipt=read(base/'provenance.json')
 for f in receipt['files']:
  p=base/f['path']
  if not p.exists():p=base/'sources'/f['path']
  assert sha(p)==f['sha256'],str(p)
 if '--tools' in sys.argv:
  for f in receipt['tools']:assert sha(Path(f['path']))==f['sha256']
 assert all(c['exitCode']==0 for c in read(base/'commands.json'))
 return read(base/'flash.json')
for left,right,expected in [('capture-a','capture-b',[38,7,9]),('capture-c','capture-d',[41,7,9]),('retained-research/capture-g','retained-research/capture-h',[33,7,14])]:
 a,b=check_capture(h/left),check_capture(h/right)
 for field,count in zip(['rows','initializationRows','errorRows'],expected):assert a[field]==b[field] and len(a[field])==count
 for field in ['reflection','instances']:assert [tree(ET.fromstring(x)) for x in a[field]]==[tree(ET.fromstring(x)) for x in b[field]]
 for c,i in zip(a['reflection'],a['instances']):
  factory=ET.fromstring(c).find('factory');instance=ET.fromstring(i)
  assert factory.attrib['type']==instance.attrib['name']
  assert sorted([tree(x) for x in factory],key=repr)==sorted([tree(x) for x in instance],key=repr)
for p in (h/'original').rglob('*.as'):
 assert p.read_bytes()==(h/'capture-c/sources/original'/p.relative_to(h/'original')).read_bytes()
 assert p.read_bytes()==(h/'capture-d/sources/original'/p.relative_to(h/'original')).read_bytes()
if (h/'evidence-files.json').exists():
 for f in read(h/'evidence-files.json'):assert sha(h/f['path'])==f['sha256'],f['path']
print(json.dumps({'finalNewRows':57,'finalCompleteClasses':12,'initialNewRowsRetained':54,'oldOriginalRowsRetained':54,'oldDomainNativeAdmission':0,'fullXMLRepeated':True,'toolsChecked':'--tools' in sys.argv}))
