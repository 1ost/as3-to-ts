package {
 import compoundcases.Counter;
 import compoundcases.Owner;
 import compoundcases.Conversion;
 public class CompoundProbe {
  public function snapshot():Object {
   var rows:Array=[];var c:Counter=new Counter();var other:Counter=new Counter();var owner:Owner=new Owner(c);var result:*;
   c.amount=8;result=owner.add(c,3);rows.push({id:"add",value:[result,c.amount]});
   c.amount=8;result=owner.subtract(c,3);rows.push({id:"subtract",value:[result,c.amount]});
   c.amount=2147483647;result=owner.add(c,1);rows.push({id:"int-overflow",value:[result,c.amount]});
   c.amount=-2147483648;result=owner.subtract(c,1);rows.push({id:"int-underflow",value:[result,c.amount]});
   c.amount=8;result=owner.add(c,"2");rows.push({id:"string-add",value:[result,typeof result,c.amount]});
   c.amount=8;result=owner.add(c,2.75);rows.push({id:"fraction",value:[result,c.amount]});
   c.amount=8;result=owner.subtract(c,"2.75");rows.push({id:"string-subtract",value:[result,c.amount]});
   c.amount=8;result=owner.add(c,null);rows.push({id:"null-rhs",value:[result,c.amount]});
   c.amount=8;result=owner.add(c,undefined);rows.push({id:"undefined-rhs",value:[String(result),c.amount]});
   c.amount=8;result=owner.add(c,[]);rows.push({id:"array-rhs",value:[result,typeof result,c.amount]});
   c.u=4294967295;result=owner.unsigned(c,2);rows.push({id:"uint-overflow",value:[result,c.u]});
   c.u=0;result=owner.unsigned(c,-1);rows.push({id:"uint-underflow",value:[result,c.u]});
   c.n=-0;result=owner.number(c,0);rows.push({id:"negative-zero",value:[String(1/result),String(1/c.n)]});
   c.n=Infinity;result=owner.number(c,Infinity);rows.push({id:"nan",value:[String(result),String(c.n)]});
   c.reset(7);owner.events=c.events;result=owner.accessorAdd(c,2.5);rows.push({id:"accessor-add",value:[result,c.amount,c.events]});
   c.reset(7);owner.events=c.events;result=owner.accessorSubtract(c,"2.5");rows.push({id:"accessor-subtract",value:[result,c.amount,c.events]});
   c.reset(7);owner.events=c.events;c.failRead=true;try{owner.accessorAdd(c,2);}catch(e:*){rows.push({id:"read-throw",value:[e,c.amount,c.events]});}
   c.reset(7);owner.events=c.events;try{owner.accessorAdd(c,"throw");}catch(e:*){rows.push({id:"rhs-throw",value:[e,c.amount,c.events]});}
   c.reset(7);owner.events=c.events;c.failWrite=true;try{owner.accessorAdd(c,2.5);}catch(e:*){rows.push({id:"write-throw",value:[e,c.amount,c.events]});}
   owner.events=[];try{owner.accessorAdd(null,2);}catch(e:Error){rows.push({id:"null-receiver",value:[e.name,e.errorID,owner.events]});}
   c.amount=10;other.amount=30;Counter.current=c;Counter.lookups=0;owner.events=[];result=owner.singleton(other);rows.push({id:"singleton-redirect",value:[result,c.amount,other.amount,Counter.lookups,owner.events]});
   c.amount=10;other.amount=30;owner=new Owner(c);result=owner.owned(other);rows.push({id:"owned-redirect",value:[result,c.amount,other.amount,owner.events,owner.untouched()]});
   c.amount=10;other.amount=30;Counter.current=c;Counter.lookups=0;owner=new Owner(c);result=owner.singletonValue(new Conversion(owner,other));rows.push({id:"singleton-conversion",value:[result,c.amount,other.amount,Counter.lookups,owner.events]});
   c.amount=10;other.amount=30;owner=new Owner(c);result=owner.ownedValue(new Conversion(owner,other));rows.push({id:"owned-conversion",value:[result,c.amount,other.amount,owner.events]});
   return {ready:true,failure:"",observations:rows};
  }
 }
}
