import hashlib
import json
from pathlib import Path
import shutil
import sys
HERE = Path(__file__).resolve().parent
CAPTURE = Path(sys.argv[1]).resolve()
def sha(file): return hashlib.sha256(file.read_bytes()).hexdigest()
proof = json.loads((CAPTURE / 'provenance.json').read_text())
assert all(command['exitCode'] == 0 for command in proof['commands'])
for entry in proof['files']: assert sha(Path(entry['path'])) == entry['sha256'], entry
for name in ['flash.json', 'provenance.json', 'commands.json', 'capture.cjs']:
    shutil.copyfile(CAPTURE / name, HERE / 'arguments-original' / name)
files = sorted(file for file in (HERE / 'arguments-original').rglob('*') if file.is_file() and file.name != 'receipt.json')
files += [HERE / 'CaptureArguments.py', Path(__file__)]
receipt = {'schema':1, 'scope':'Actual Flash constructor arity, coercion and receiver identity',
    'files':[{'path':file.relative_to(HERE).as_posix(), 'sha256':sha(file)} for file in files]}
(HERE / 'arguments-original/receipt.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
print(sha(HERE / 'arguments-original/receipt.json'))
