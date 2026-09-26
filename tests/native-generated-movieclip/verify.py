"""Independent XML trait projection from repeated, authenticated Flash captures."""
import hashlib
import json
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

engine = Path(sys.argv[1]).resolve()
packet = engine / 'tests/nativeFlashOracle/movieclip-class'
inputs = []

def read(path):
    data = path.read_bytes()
    inputs.append({'path': str(path.relative_to(engine)).replace('\\', '/'),
                   'sha256': hashlib.sha256(data).hexdigest()})
    return data

receipt_bytes = read(packet / 'flash/receipt.json')
assert hashlib.sha256(receipt_bytes).hexdigest() == json.loads(read(packet / 'evidence-pin.json'))
receipt = json.loads(receipt_bytes)
assert receipt['status'] == 'passed' and receipt['capture']['runs'] == 2
for name, digest in receipt['artifacts'].items():
    target = (packet / 'flash' / name).resolve()
    assert target.is_relative_to((packet / 'flash').resolve())
    assert hashlib.sha256(read(target)).hexdigest() == digest
    if name.startswith('source/'):
        assert hashlib.sha256(read(packet / name)).hexdigest() == digest
a = json.loads(read(packet / 'flash/run-1/capture.json'))
assert a == json.loads(read(packet / 'flash/run-2/capture.json'))
assert a['runtime']['playerType'] == 'PlugIn'
assert a['state']['ready'] and a['state']['failure'] == ''
observations = json.loads(read(packet / 'expected.json'))
assert observations == a['state']['observations'] and len(observations) == 28
document = ET.fromstring(next(r['value'] for r in observations if r['id'] == 'movieclip-class-reflection'))
factory = document.find('factory')
assert factory.attrib['type'] == 'flash.display::MovieClip'
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
assert len(rows) == 105 and len({r['name'] for r in rows}) == 105
print(json.dumps({'traits': rows, 'inputs': inputs}))
