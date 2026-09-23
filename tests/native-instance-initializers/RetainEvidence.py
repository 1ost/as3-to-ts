import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys

HERE = Path(__file__).resolve().parent
CAPTURE = Path(sys.argv[1]).resolve()
receipt = json.loads((CAPTURE / 'provenance.json').read_text())
assert all(command['exitCode'] == 0 for command in receipt['commands'])
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
for entry in receipt['files']:
    assert sha(Path(entry['path'])) == entry['sha256'], entry
for name in ['flash.json', 'provenance.json', 'commands.json', 'capture.cjs', 'comparison.json']:
    shutil.copyfile(CAPTURE / name, HERE / 'oracle' / name)
for target in ['es5', 'es2015']:
    (HERE / 'oracle' / target).mkdir(exist_ok=True)
    shutil.copyfile(CAPTURE / target / 'native.json', HERE / 'oracle' / target / 'native.json')
files = sorted(path for path in (HERE / 'oracle').rglob('*') if path.is_file() and path.name != 'receipt.json')
files += [HERE / name for name in ['capture.py', 'CompareCurrentEmission.js', 'NativeLanguageConstraintTests.js', 'RetainEvidence.py']]
compiler = HERE.parents[1]
compiler_files = ['src/emit/emitter.ts', 'src/emit/native-class-initializers.ts', 'utils/nativeClass.ts',
    'utils/classBound.ts', 'utils/bound.ts', 'node_modules/typescript/lib/typescript.js']
retained = {'schema':1, 'scope':'Instance initialization diagnosis; runtimeAdmission remains false',
    'compilerCommit':subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=compiler).decode().strip(),
    'compilerFiles':[{'path':name, 'sha256':sha(compiler / name)} for name in compiler_files],
    'generatedOutputs':[{'path':path.relative_to(CAPTURE).as_posix(), 'sha256':sha(path)}
        for target in ['es5', 'es2015'] for path in sorted((CAPTURE / target).glob('*.ts'))],
    'files':[{'path':path.relative_to(HERE).as_posix(), 'sha256':sha(path)} for path in files]}
(HERE / 'oracle/receipt.json').write_text(json.dumps(retained, indent=2) + '\n', encoding='utf-8')
print(sha(HERE / 'oracle/receipt.json'))
