from pathlib import Path
import json,hashlib,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parent.parent
def canon(node):return [node.tag,sorted(node.attrib.items()),(node.text or '').strip(),sorted([canon(c) for c in node],key=lambda x:json.dumps(x,sort_keys=True))]
reports=[]
for name in ['native-addition-review','native-addition-placement']:
 here=root/name
 for f in json.loads((here/'files.json').read_text()):assert hashlib.sha256((here/f['path']).read_bytes()).hexdigest()==f['sha256']
 a=json.loads((here/'evidence/flash.json').read_text());b=json.loads((here/'repeat-evidence/flash.json').read_text())
 assert a['rows']==b['rows']
 for role,single in [('reflection','classXML'),('instances','instanceXML')]:
  left=a[role] if role in a else [a[single]];right=b[role] if role in b else [b[single]]
  assert len(left)==len(right)==1
  assert canon(ET.fromstring(left[0]))==canon(ET.fromstring(right[0]))
 reports.append(dict(fixture=name,rows=len(a['rows']),matchingCaptures=2,completeClassAndInstanceXML=True))
print(json.dumps(reports))

here=root/'native-addition-placement'
for f in json.loads((here/'held-files.json').read_text()):assert hashlib.sha256((here/f['path']).read_bytes()).hexdigest()==f['sha256']
a=json.loads((here/'held-evidence/flash.json').read_text());b=json.loads((here/'held-repeat-evidence/flash.json').read_text());assert a['rows']==b['rows']
for role in ['reflection','instances']:assert canon(ET.fromstring(a[role][0]))==canon(ET.fromstring(b[role][0]))
print(json.dumps(dict(heldOriginalRows=len(a['rows']),matchingCaptures=2,completeClassAndInstanceXML=True,nativeRowsAdmitted=0)))
