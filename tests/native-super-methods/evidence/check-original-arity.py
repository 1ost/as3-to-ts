import json,os,subprocess
from pathlib import Path
root=Path(__file__).resolve().parent
out=root/'original-arity';out.mkdir(exist_ok=True)
flex=Path('C:/Users/admin/AppData/Local/BleachPortTools/apache-flex-sdk-4.16.1')
env=dict(os.environ);env['PLAYERGLOBAL_HOME']=str(flex/'frameworks/libs/player')
reports=[]
for name,arguments in [('Missing',''),('Extra','true,false,true')]:
 source=out/(name+'Oracle.as')
 source.write_text('package {import flash.display.Sprite; public class '+name+'Oracle extends Sprite {public function '+name+'Oracle(){new Bad().run();}}}\nimport superprobe.Base;class Bad extends Base {public function run():void {super.selected('+arguments+');}}\n')
 command=['java','-Xmx384m','-jar',str(flex/'lib/mxmlc.jar'),'+flexlib='+str(flex/'frameworks'),'-target-player=26.0','-swf-version=37','-source-path='+str(root/'original'),'-output='+str(out/(name+'.swf')),str(source)]
 result=subprocess.run(command,cwd=out,env=env,capture_output=True,text=True,encoding='utf-8',timeout=60)
 assert result.returncode!=0 and 'Incorrect number of arguments' in result.stderr,(name,result.stdout,result.stderr)
 reports.append(dict(name=name,command=command,cwd=str(out),exitCode=result.returncode,stdout=result.stdout,stderr=result.stderr))
(out/'commands.json').write_text(json.dumps(reports,indent=2)+'\n')
print('Original Flash compiler rejects missing/extra direct super-call arguments')
