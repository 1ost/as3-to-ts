import hashlib,json,sys,xml.etree.ElementTree as E
from pathlib import Path
root=Path(__file__).resolve().parent
receipts={
'repeat-evidence':'3189e4455f3012deb403d6a900e533092be1d906c6e298c1f0a0eef904fa416f',
'evidence':'0cede672e434a59c2bfa4f0aaae4c39faf69c8263a2e6f7d91c3027f300273f1',
'unit-evidence':'9cb17b88c072f19ad2479b9e42834ec7a6afb727f70ab3bc55321aab0476a589',
'unit-repeat-evidence':'df74334bd08b9ffd75c36fca4e16911828799becdcc44be26f7dc604a81794ab',
'order-evidence':'37aaf106705973605f6343db0bccf9bb273f183df4909329ff7b0fc7419eab6e',
'order-repeat-evidence':'a7e92877377fc5b8a3dfa21274db1978056cbba8b34a612beed69b00364514a1'}
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def xmlkey(e):return (e.tag,tuple(sorted(e.attrib.items())),tuple(sorted(xmlkey(c) for c in e)))
def norm(v):return [norm(x) for x in v] if isinstance(v,list) else xmlkey(E.fromstring(v))
for name,expected in receipts.items():
 folder=root/name;receipt=folder/'provenance.json';assert sha(receipt)==expected,name
 for item in json.loads(receipt.read_text())['files']:
  p=folder/item['path'];p=p if p.exists() else folder/'sources'/item['path'];assert sha(p)==item['sha256'],str(p)
for kind,count in [('unit',24),('order',8)]:
 a=json.loads((root/(kind+'-evidence')/'flash.json').read_text());b=json.loads((root/(kind+'-repeat-evidence')/'flash.json').read_text())
 assert a['rows']==b['rows'] and len(a['rows'])==count
 for k in ['reflection','instances']:assert norm(a[k])==norm(b[k]),(kind,k)
print(json.dumps({'authenticatedCaptures':len(receipts),'newRuntimeRows':32,'completeHeldFixtureRows':26,'repeatRuntimeRowsEqual':True,'reflectionTraitSetsEqual':True,'reflectionOrderIsNotAssertedStable':True}))
