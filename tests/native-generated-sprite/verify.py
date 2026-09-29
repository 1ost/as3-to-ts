"""Independent XML projection from authenticated, repeated Flash captures."""
import hashlib
import json
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

engine = Path(sys.argv[1])
evidence = engine / 'tests/nativeCanonicalSpriteClass'
inputs = []
def read(path):
    data = path.read_bytes()
    inputs.append({'path': str(path.relative_to(engine)).replace('\\', '/'),
                   'sha256': hashlib.sha256(data).hexdigest()})
    return data

documents = []
for folder in ['evidence-a', 'evidence-b']:
    root = evidence / folder
    receipt = json.loads(read(root / 'provenance.json'))
    for file in receipt['files']:
        name = file['path'].replace('\\', '/')
        path = root / (name if name in ['oracle.swf', 'flash.json', 'commands.json'] else 'sources/' + name)
        assert hashlib.sha256(read(path)).hexdigest() == file['sha256'], str(path)
    documents.append(json.loads(read(root / 'flash.json')))
assert documents[0] == documents[1]
sdk = json.loads(read(evidence / 'sdk-authority/files.json'))
assert sdk['sdkSHA256'] == '0e450154692d044b1758064825e072476421560c43f6a026b12df4cfda82e295'
for file in sdk['files']:
    assert hashlib.sha256(read(evidence / 'sdk-authority' / file['path'])).hexdigest() == file['sha256']
declarations = json.loads(read(evidence / 'sdk-authority/declarations.json'))
sprite = next(row for row in declarations if row['name'] == 'flash.display::Sprite')
assert sprite['super'] == 'flash.display::DisplayObjectContainer' and sprite['rawFlags'] == 9

factory = ET.fromstring(documents[0]['reflection']['Sprite']).find('factory')
rows = []
for member in factory:
    if member.tag not in ['variable', 'constant', 'accessor', 'method']:
        continue
    row = dict(name=member.attrib['name'], kind=member.tag, declaredBy=member.attrib['declaredBy'])
    if member.tag == 'method':
        row['parameterCount'] = len(member.findall('parameter'))
    else:
        row['type'] = member.attrib['type']
        if member.tag == 'accessor':
            row['access'] = member.attrib['access']
    rows.append(row)
assert len(rows) == 85 and len({r['name'] for r in rows}) == 85
print(json.dumps({'traits': rows, 'inputs': inputs}))
