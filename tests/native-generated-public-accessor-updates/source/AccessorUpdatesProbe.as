package {
 import updatecases.Counter;
 import updatecases.Owner;
 public class AccessorUpdatesProbe {
  public function snapshot():Object {
   var rows:Array=[];var c:Counter=new Counter();var owner:Owner=new Owner(c);var result:Number;
   c.reset(8);result=owner.up(c);rows.push({id:"prefix",value:[result,c.raw(),c.events]});
   c.reset(8);result=owner.post(c);rows.push({id:"postfix",value:[result,c.raw(),c.events]});
   c.reset(-8);result=owner.down(c);rows.push({id:"prefix-down",value:[result,c.raw(),c.events]});
   c.reset(-8);result=owner.postDown(c);rows.push({id:"postfix-down",value:[result,c.raw(),c.events]});
   c.reset(2147483647);result=owner.up(c);rows.push({id:"int-overflow",value:[result,c.raw(),c.events]});
   c.reset(2147483647);result=owner.post(c);rows.push({id:"int-post-overflow",value:[result,c.raw(),c.events]});
   c.reset(-2147483648);result=owner.down(c);rows.push({id:"int-underflow",value:[result,c.raw(),c.events]});
   c.u=4294967295;result=owner.unsignedUp(c);rows.push({id:"uint-overflow",value:[result,c.u]});
   c.u=0;result=owner.unsignedPostDown(c);rows.push({id:"uint-underflow",value:[result,c.u]});
   c.field=4294967295;result=owner.fieldUp(c);rows.push({id:"field-overflow",value:[result,c.field]});
   c.n=1.5;result=owner.numberUp(c);rows.push({id:"number",value:[result,c.n]});
   c.n=-0;result=owner.numberPost(c);rows.push({id:"negative-zero",value:[String(1/result),c.n]});
   c.n=NaN;result=owner.numberUp(c);rows.push({id:"nan",value:[String(result),String(c.n)]});
   c.n=Infinity;result=owner.numberUp(c);rows.push({id:"infinity",value:[String(result),String(c.n)]});
   c.reset(12);result=owner.owned();rows.push({id:"owned",value:[result,c.raw(),c.events,owner.untouched()]});
   c.reset(16);Counter.current=c;Counter.lookups=0;result=owner.singleton();rows.push({id:"singleton",value:[result,c.raw(),c.events,Counter.lookups]});
   c.reset(20);c.failRead=true;try {owner.up(c);}catch(e:*){rows.push({id:"read-throw",value:[e,c.raw(),c.events]});}
   c.reset(21);c.failWrite=true;try {owner.up(c);}catch(e:*){rows.push({id:"write-throw",value:[e,c.raw(),c.events]});}
   c.reset(22);c.failWrite=true;try {owner.post(c);}catch(e:*){rows.push({id:"post-write-throw",value:[e,c.raw(),c.events]});}
   try {owner.up(null);}catch(e:Error){rows.push({id:"null",value:[e.name,e.errorID]});}
   Counter.current=null;Counter.lookups=0;try {owner.singleton();}catch(e:Error){rows.push({id:"singleton-null",value:[e.name,e.errorID,Counter.lookups]});}
   return {ready:true,failure:"",observations:rows};
  }
 }
}
