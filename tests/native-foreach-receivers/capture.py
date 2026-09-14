from pathlib import Path
import hashlib,json,os,shutil,subprocess,sys
here=Path(__file__).resolve().parent
source=Path(sys.argv[1]).resolve();out=Path(sys.argv[2]).resolve();out.mkdir(parents=True,exist_ok=False)
shutil.copytree(source,out/'sources');shutil.copyfile(here/'capture.cjs',out/'capture.cjs');shutil.copyfile(__file__,out/'capture.py')
flex=Path(os.environ['FLEX_SDK']);electron=Path(os.environ['FLASH_ELECTRON']);plugin=Path(os.environ['FLASH_PLUGIN'])
env=dict(os.environ);env['PLAYERGLOBAL_HOME']=str(flex/'frameworks/libs/player');env.pop('ELECTRON_RUN_AS_NODE',None)
commands=[['java','-Xmx384m','-jar',str(flex/'lib/mxmlc.jar'),'+flexlib='+str(flex/'frameworks'),'-debug=true','-target-player=26.0','-swf-version=37','-source-path='+str(out/'sources'),'-output='+str(out/'oracle.swf'),str(out/'sources/CatchOracle.as')],[str(electron),str(out/'capture.cjs'),str(out/'oracle.swf'),str(out/'flash.json'),str(plugin)]]
logs=[]
for cmd in commands:
 r=subprocess.run(cmd,capture_output=True,text=True,encoding='utf8',env=env,timeout=90);logs.append({'command':cmd,'exitCode':r.returncode,'stdout':r.stdout,'stderr':r.stderr});(out/'commands.json').write_text(json.dumps(logs,indent=2));assert r.returncode==0,r.stdout+r.stderr
result=json.loads((out/'flash.json').read_text());assert result['failure']=='',result
h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
files=[*sorted((out/'sources').rglob('*.as')),out/'capture.cjs',out/'capture.py',out/'oracle.swf',out/'flash.json',out/'commands.json']
(out/'provenance.json').write_text(json.dumps({'files':[{'path':str(p.relative_to(out)).replace('\\','/'),'sha256':h(p)}for p in files],'tools':[{'path':str(p),'sha256':h(p)}for p in [flex/'lib/mxmlc.jar',flex/'frameworks/libs/player/26.0/playerglobal.swc',electron,plugin]]},indent=2))
print(json.dumps({'output':str(out),'rows':len(result['rows'])}))
