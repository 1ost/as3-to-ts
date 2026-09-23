import hashlib
import json
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REVIEW = Path(sys.argv[1]).resolve()
DEST = HERE / 'class-alias-original'

def sha(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()

proof = json.loads((REVIEW / 'flash/provenance.json').read_text())
for name, digest in proof['files'].items():
    assert sha(Path(name)) == digest, name
for file in (REVIEW / 'source').rglob('*.as'):
    target = DEST / file.relative_to(REVIEW / 'source')
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(file, target)
for name in ['provenance.json', 'commands.json', 'capture.cjs', 'flash.json']:
    shutil.copyfile(REVIEW / 'flash' / name, DEST / name)
shutil.copyfile(REVIEW / 'comparison.json', DEST / 'review-comparison.json')
files = sorted(file for file in DEST.rglob('*') if file.is_file() and file.name != 'receipt.json') + [Path(__file__)]
receipt = {
    'schema': 1,
    'scope': 'Unresolved original Flash Class alias bind, prototype delegate and coercion requirements; no fidelity admission',
    'files': [{'path': file.relative_to(HERE).as_posix(), 'sha256': sha(file)} for file in files],
}
(DEST / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
print(sha(DEST / 'receipt.json'))
