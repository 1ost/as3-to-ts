package {
 import privategetters.Base;
 import privategetters.Child;
 public class PrivateGetterProbe {
  public function snapshot():Object {
   var a:Base=new Base(),b:Base=new Base(),c:Child=new Child(),d:Child=new Child();
   var rows:Array=[];
   rows.push({id:"initial",value:a.read(b)});a.setValue(true);
   rows.push({id:"changed",value:a.read(b)});
   rows.push({id:"same",value:a.read(a)});
   rows.push({id:"child-base",value:c.read(d)});c.setValue(true);
   rows.push({id:"child-base-changed",value:c.read(d)});
   rows.push({id:"child-private",value:c.own(d)});c.change();
   rows.push({id:"child-private-changed",value:c.own(d)});
   rows.push({id:"child-base-preserved",value:c.read(c)});
   return {ready:true,failure:"",observations:rows};
  }
 }
}
