import hashlib,json,os,subprocess,sys
from pathlib import Path
here=Path(__file__).resolve().parent
out=Path(sys.argv[1]).resolve();assert not out.exists();out.mkdir(parents=True)
flex=Path(os.environ.get('OP2_FLEX_HOME','C:/Users/admin/AppData/Local/BleachPortTools/apache-flex-sdk-4.16.1'))
electron=Path(os.environ.get('OP2_ORACLE_ELECTRON','D:/bleach-oracle-electron/node_modules/electron/dist/electron.exe'))
plugin=Path(os.environ['OP2_FLASH_PLUGIN'])
commands=[['java','-Xmx384m','-jar',str(flex/'lib/mxmlc.jar'),'+flexlib='+str(flex/'frameworks'),'-target-player=26.0','-swf-version=37','-source-path='+str(here/'unit-original'),'-output='+str(out/'oracle.swf'),str(here/'unit-original/ConstructorOracle.as')],
 [str(electron),str(here/'capture.cjs'),str(out/'oracle.swf'),str(out/'flash.json'),str(plugin)]]
env=dict(os.environ);env['PLAYERGLOBAL_HOME']=str(flex/'frameworks/libs/player');env.pop('ELECTRON_RUN_AS_NODE',None);logs=[]
for command in commands:
 result=subprocess.run(command,cwd=out,env=env,capture_output=True,text=True,encoding='utf-8',timeout=90)
 logs.append(dict(command=command,cwd=str(out),exitCode=result.returncode,stdout=result.stdout,stderr=result.stderr));(out/'commands.json').write_text(json.dumps(logs,indent=2)+'\n');print(result.stdout,result.stderr);assert result.returncode==0
inputs={str(p.relative_to(here)).replace('unit-original','original'):p for p in [*sorted((here/'unit-original').rglob('*.as')),here/'capture.cjs',Path(__file__)]}
for name,p in inputs.items():
 target=out/'sources'/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(p.read_bytes())
inputs.update({'oracle.swf':out/'oracle.swf','flash.json':out/'flash.json','commands.json':out/'commands.json'})
receipt=dict(files=[dict(path=name,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for name,p in inputs.items()],tools=[dict(path=str(p),sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in [flex/'lib/mxmlc.jar',flex/'frameworks/libs/player/26.0/playerglobal.swc',electron,plugin]])
(out/'provenance.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(json.loads((out/'flash.json').read_text())['rows'],indent=2))
