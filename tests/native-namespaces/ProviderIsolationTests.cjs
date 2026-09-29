const assert=require('node:assert/strict'),parse=require('../../lib/parse'),emit=require('../../lib/emit');
const source=`package fixture {
 import external.Base;
 import external.Settings;
 public class Child extends Base {
  public function configure():void { Settings.setProperty("version","1"); }
 }
}`;
const options={lineSeparator:'\n',customVisitors:[]};
const generate=(text,extra={})=>emit(parse('Child.as',text),text,{...options,...extra});
const baseline=generate(source);
assert.match(baseline,/Settings.setProperty/);
assert.equal(generate(source,{nativeProxyModule:'./Proxy'}),baseline);
// An explicit opening of the matching namespace still needs ancestry authority.
const opened=source.replace('import external.Base;','import external.Base; import flash.utils.flash_proxy; use namespace flash_proxy;');
assert.throws(()=>generate(opened,{nativeProxyModule:'./Proxy'}),/namespace inheritance requires a proven same-file ordinary base/);
console.log('Unrelated Proxy names preserve ordinary dot emission; explicit namespace use retains ancestry checks.');
