import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

HERE = Path(__file__).resolve().parent
assert len(sys.argv) == 2, 'Pass a fresh isolated output directory'
OUTPUT = Path(sys.argv[1]).resolve()
assert not OUTPUT.exists(), 'Never overwrite an existing capture'
OUTPUT.mkdir(parents=True)
FLEX = Path('C:/Users/admin/AppData/Local/BleachPortTools/apache-flex-sdk-4.16.1')
ELECTRON = Path('D:/bleach-oracle-electron/node_modules/electron/dist/electron.exe')
PLUGIN = HERE.parents[2] / 'bleach-services/game-client/electron_desktop/plugins/pepflashplayer.dll'
assert PLUGIN.is_file()
shutil.copyfile(HERE.parent / 'native-class-initializers/oracle/capture.cjs', OUTPUT / 'capture.cjs')
commands = [
    ['java', '-Xmx384m', '-jar', str(FLEX / 'lib/mxmlc.jar'), '+flexlib=' + str(FLEX / 'frameworks'),
     '-target-player=26.0', '-swf-version=37', '-source-path=' + str(HERE / 'arguments-original'),
     '-output=' + str(OUTPUT / 'oracle.swf'), str(HERE / 'arguments-original/ArgumentOracle.as')],
    [str(ELECTRON), str(OUTPUT / 'capture.cjs'), str(OUTPUT / 'oracle.swf'), str(OUTPUT / 'flash.json'), str(PLUGIN)],
]
environment = dict(os.environ)
environment['PLAYERGLOBAL_HOME'] = str(FLEX / 'frameworks/libs/player')
environment.pop('ELECTRON_RUN_AS_NODE', None)
logs = []
for command in commands:
    result = subprocess.run(command, cwd=OUTPUT, env=environment, capture_output=True, text=True, encoding='utf-8', timeout=90)
    logs.append({'command': command, 'cwd': str(OUTPUT), 'exitCode': result.returncode,
        'stdout': result.stdout, 'stderr': result.stderr})
    (OUTPUT / 'commands.json').write_text(json.dumps(logs, indent=2) + '\n', encoding='utf-8')
    print(result.stdout, result.stderr)
    assert result.returncode == 0
files = sorted((HERE / 'arguments-original').rglob('*.as')) + [Path(__file__), OUTPUT / 'capture.cjs', OUTPUT / 'oracle.swf', OUTPUT / 'flash.json',
    FLEX / 'lib/mxmlc.jar', FLEX / 'frameworks/libs/player/26.0/playerglobal.swc', ELECTRON, PLUGIN]
receipt = {'schema': 1, 'commands': logs,
    'files': [{'path': str(file), 'sha256': hashlib.sha256(file.read_bytes()).hexdigest()} for file in files]}
(OUTPUT / 'provenance.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
print((OUTPUT / 'flash.json').read_text())
