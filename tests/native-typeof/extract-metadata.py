from pathlib import Path
import hashlib,json,sys,xml.etree.ElementTree as ET
# Caller authenticates retained capture and source bytes against the pinned receipt.
capture=Path(sys.argv[1])
raw=json.loads((capture/'flash.json').read_text(encoding='utf8'))
def surface(xml,owner):
 result={'variables':[],'accessors':[],'methods':[],'constants':[]};traits=[]
 for node in xml:
  if node.tag not in ['variable','constant','method','accessor']:continue
  kind=node.tag;member={'name':node.attrib['name'],'declaredBy':node.get('declaredBy',owner)}
  if node.get('uri') is not None:member['uri']=node.get('uri')
  if kind in ['variable','constant']:member['type']=node.attrib['type']
  if kind=='method':member['parameterCount']=len(node.findall('parameter'))
  if kind=='accessor':member['access']=node.attrib['access']
  result[{'variable':'variables','constant':'constants','accessor':'accessors','method':'methods'}[kind]].append(member)
  if member['declaredBy']==owner and not member.get('uri'):
   trait={'name':member['name'],'kind':kind}
   if kind!='method':trait['type']=node.attrib['type']
   traits.append(trait)
 return result,traits
records={}
for class_text,instance_text in zip(raw['reflection'],raw['instances']):
 cls=ET.fromstring(class_text);instance=ET.fromstring(instance_text);name=cls.attrib['name']
 assert name==instance.attrib['name'];qname=name.replace('::','.')
 source=capture/'sources'/Path(qname.replace('.','/')+'.as')
 static,static_traits=surface(cls,name);inst,instance_traits=surface(instance,name)
 records[qname]={'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
  'metadata':{'name':name,'base':instance.attrib['base'],'isDynamic':instance.attrib['isDynamic']=='true','isFinal':instance.attrib['isFinal']=='true','instance':inst,'statics':static},
  'instanceTraits':instance_traits,'staticTraits':static_traits}
output={'schema':1,'captureSha256':hashlib.sha256((capture/'flash.json').read_bytes()).hexdigest(),'classes':records}
print(json.dumps(output))
