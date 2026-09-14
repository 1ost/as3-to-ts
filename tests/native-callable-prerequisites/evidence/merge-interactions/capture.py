from pathlib import Path
import hashlib,json,os,shutil,subprocess,tempfile
root=Path(__file__).resolve().parents[2];here=Path(__file__).resolve().parent
out=Path(tempfile.mkdtemp(prefix='flash-',dir=here));shutil.copytree(here/'original',out/'sources')
capture=root/'game-client-laya/tests/picture-resource-parser/capture.cjs';shutil.copyfile(capture,out/'capture.cjs')
flex=Path('C:/Users/admin/AppData/Local/BleachPortTools/apache-flex-sdk-4.16.1')
electron=Path('D:/bleach-oracle-electron/node_modules/electron/dist/electron.exe')
plugin=root.parent/'bleach-services/game-client/electron_desktop/plugins/pepflashplayer.dll'
env=dict(os.environ);env['PLAYERGLOBAL_HOME']=str(flex/'frameworks/libs/player');env.pop('ELECTRON_RUN_AS_NODE',None)
commands=[['java','-Xmx384m','-jar',str(flex/'lib/mxmlc.jar'),'+flexlib='+str(flex/'frameworks'),'-debug=true','-target-player=26.0','-swf-version=37','-source-path='+str(out/'sources'),'-output='+str(out/'oracle.swf'),str(out/'sources/ReturnOracle.as')],[str(electron),str(out/'capture.cjs'),str(out/'oracle.swf'),str(out/'flash.json'),str(plugin)]]
logs=[]
for cmd in commands:
 r=subprocess.run(cmd,capture_output=True,text=True,encoding='utf8',env=env,timeout=90)
 logs.append({'command':cmd,'exitCode':r.returncode,'stdout':r.stdout,'stderr':r.stderr});(out/'commands.json').write_text(json.dumps(logs,indent=2),encoding='utf8')
 assert r.returncode==0,r.stdout+r.stderr
v=json.loads((out/'flash.json').read_text(encoding='utf8'));assert v['failure']=='',v
files=[*list((out/'sources').rglob('*.as')),out/'capture.cjs',out/'oracle.swf',out/'flash.json',Path(__file__),flex/'lib/mxmlc.jar',flex/'frameworks/libs/player/26.0/playerglobal.swc',electron,plugin]
(out/'provenance.json').write_text(json.dumps({'files':[{'path':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in files],'commands':logs},indent=2),encoding='utf8')
print(json.dumps({'output':str(out),'rows':len(v['rows'])}))
