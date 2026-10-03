package {import cases.*;public class AnonymousMembersProbe {
 public function snapshot():Object {
  var rows:Array=[],first:MemberClosure=new MemberClosure(),second:MemberClosure=new MemberClosure();
  var a:Function=first.begin("alpha"),b:Function=second.begin("beta");
  rows.push({id:"pending",value:[first.state(),second.state()]});
  var foreign:Object={_pending:77,_loading:"foreign",_calls:88};a.call(foreign);
  var original:Object=first.value("alpha");
  rows.push({id:"foreign-call",value:[first.state(),second.state(),foreign._pending,foreign._loading,foreign._calls,original.name]});
  b.apply(null,[]);rows.push({id:"second-owner",value:[first.state(),second.state(),second.value("beta").name]});
  a();rows.push({id:"repeat-retains-value",value:[first.value("alpha")===original,first.state()]});
  var failure:Function=first.begin("");failure.call(second);rows.push({id:"caught-error",value:[first.state(),second.state()]});
  var newer:Function=first.begin("gamma");a.call(second);newer();rows.push({id:"old-and-new-captures",value:[first.state(),first.value("alpha")===original,first.value("gamma").name,second.state()]});
  var cleared:Function=second.begin(null);cleared();rows.push({id:"null-name-error",value:second.state()});
  return {ready:true,failure:"",observations:rows};
 }
}}
