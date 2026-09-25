import copy
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('native-api-profile.py'))
api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)

class FrameScriptPolicyTest(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
  p=Path(self.temp.name)/'scripts/flash/display/MovieClip.as';p.parent.mkdir(parents=True)
  p.write_text('package flash.display {\n public class MovieClip {\n public native function addFrameScript(... rest) : void;\n }\n}\n')
  self.classes=api.read_native_declarations(Path(self.temp.name))
  self.member=dict(name='addFrameScript',kind='method',scope='instance',signature='(frame: number, script: FlashFrameScript, ...additional: Array<number | FlashFrameScript>) => void')
  self.row=dict(module='src/layaAir/flash/display/MovieClip.ts',export='MovieClip',kind='class',signature='typeof MovieClip',members=[self.member])
 def mappings(self):
  return api.map_native_members('flash.display.MovieClip',['instance-member'],self.row,'api.flash.display',self.classes,{'addFrameScript'})
 def test_retains_real_variadic_signature_without_narrowing(self):
  mappings,uses=self.mappings();self.assertEqual(len(mappings),1)
  self.assertEqual(mappings[0]['sourceMember'],dict(name='addFrameScript',access='call',signature='public function addFrameScript(...rest:*) : void',minArgs=0,maxArgs=1000000))
  self.assertEqual(uses[0]['signatures'][0]['minArgs'],0)
 def test_changed_source_declaration_and_other_native_variadics_rejected(self):
  original=copy.deepcopy(self.classes)
  for key,value in [('nativeSignature','public function addFrameScript(... rest) : void;'),('signature','public function addFrameScript(...rest:String) : void'),('type','Object'),('scope','static')]:
   self.classes=copy.deepcopy(original);self.classes['flash.display.MovieClip']['members'][0][key]=value
   self.assertEqual(self.mappings(),([],[]),key)
 def test_changed_target_module_types_or_scope_rejected(self):
  original=copy.deepcopy(self.row)
  for key,value in [('module','src/other/MovieClip.ts'),('export','Different')]:
   self.row=copy.deepcopy(original);self.row[key]=value;self.assertEqual(self.mappings(),([],[]),key)
  for key,value in [('signature','(frame: string, script: FlashFrameScript, ...additional: Array<number | FlashFrameScript>) => void'),('scope','static')]:
   self.row=copy.deepcopy(original);self.row['members'][0][key]=value;self.assertEqual(self.mappings(),([],[]),key)

if __name__=='__main__':unittest.main()
