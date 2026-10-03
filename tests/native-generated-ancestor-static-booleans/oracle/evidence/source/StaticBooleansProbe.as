package {import staticflags.Flags;import staticflags.Child;import staticflags.Sibling;import deep.Grand;import deeper.Leaf;public class StaticBooleansProbe {
 public function snapshot():Object {
  var rows:Array=[];
  rows.push({id:"early",value:Flags.early});
  rows.push({id:"after",value:Flags.after});
  rows.push({id:"order",value:Flags.log});
  rows.push({id:"read",value:Flags.read()});
  rows.push({id:"inherited",value:Child.inherited()});
  rows.push({id:"changed",value:Flags.change(false)});
  rows.push({id:"child-after",value:Child.inherited()});
  rows.push({id:"child-mutation",value:Child.mutate(true)});
  rows.push({id:"base-after",value:Flags.read()});
  rows.push({id:"construction",value:(new Child(),Flags.read())});
  rows.push({id:"grand",value:Grand.deepRead()});
  rows.push({id:"leaf",value:Leaf.leafRead()});
  rows.push({id:"leaf-write",value:Leaf.leafWrite(false)});
  rows.push({id:"grand-after-leaf",value:Grand.deepRead()});
  rows.push({id:"base-after-leaf",value:Flags.read()});
  rows.push({id:"child-after-leaf",value:Child.inherited()});
  rows.push({id:"sibling-after-leaf",value:Sibling.siblingRead()});
  rows.push({id:"sibling-write",value:Sibling.siblingWrite(true)});
  rows.push({id:"leaf-after-sibling",value:Leaf.leafRead()});
  rows.push({id:"grand-write",value:Grand.deepWrite(false)});
  var leaf:Leaf=new Leaf();
  rows.push({id:"leaf-instance",value:leaf.leafInstanceRead()});
  rows.push({id:"leaf-instance-write",value:leaf.leafInstanceWrite(true)});
  rows.push({id:"grand-instance",value:leaf.instanceRead()});
  rows.push({id:"grand-instance-write",value:leaf.instanceWrite(false)});
  rows.push({id:"final-base",value:Flags.read()});
  rows.push({id:"final-leaf",value:Leaf.leafRead()});
  return {ready:true,failure:"",observations:rows};
 }
}}
