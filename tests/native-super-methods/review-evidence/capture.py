import hashlib,json,os,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent
OUT=ROOT/(sys.argv[1] if len(sys.argv)>1 else 'flash')
assert not OUT.exists()
OUT.mkdir()
FLEX=Path('C:/Users/admin/AppData/Local/BleachPortTools/apache-flex-sdk-4.16.1')
ELECTRON=Path('D:/bleach-oracle-electron/node_modules/electron/dist/electron.exe')
PLUGIN=ROOT.parents[2]/'bleach-services/game-client/electron_desktop/plugins/pepflashplayer.dll'
CAPTURE=ROOT.parents[2]/'as3-to-ts-op2/tests/native-class-initializers/oracle/capture.cjs'
(OUT/'capture.cjs').write_bytes(CAPTURE.read_bytes())
commands=[['java','-Xmx384m','-jar',str(FLEX/'lib/mxmlc.jar'),'+flexlib='+str(FLEX/'frameworks'),'-target-player=26.0','-swf-version=37','-source-path='+str(ROOT/'original'),'-output='+str(OUT/'oracle.swf'),str(ROOT/'original/SuperOracle.as')],
 [str(ELECTRON),str(OUT/'capture.cjs'),str(OUT/'oracle.swf'),str(OUT/'flash.json'),str(PLUGIN)]]
env=dict(os.environ);env['PLAYERGLOBAL_HOME']=str(FLEX/'frameworks/libs/player');env.pop('ELECTRON_RUN_AS_NODE',None)
logs=[]
for command in commands:
 result=subprocess.run(command,cwd=OUT,env=env,capture_output=True,text=True,encoding='utf-8',timeout=90)
 logs.append(dict(command=command,cwd=str(OUT),exitCode=result.returncode,stdout=result.stdout,stderr=result.stderr))
 (OUT/'commands.json').write_text(json.dumps(logs,indent=2)+'\n')
 print(result.stdout,result.stderr);assert result.returncode==0
files=list((ROOT/'original').rglob('*.as'))+[Path(__file__),OUT/'capture.cjs',OUT/'oracle.swf',OUT/'flash.json',FLEX/'lib/mxmlc.jar',FLEX/'frameworks/libs/player/26.0/playerglobal.swc',ELECTRON,PLUGIN]
(OUT/'provenance.json').write_text(json.dumps(dict(schema=1,files=[dict(path=str(p),sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in files]),indent=2)+'\n')
for source in (ROOT/'original').rglob('*.as'):
 target=OUT/'sources'/source.relative_to(ROOT/'original');target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(source.read_bytes())
print((OUT/'flash.json').read_text())
