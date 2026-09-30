package {
 public class PrimitiveEachProbe {
  private var calls:int=0;
  private function values():Array{calls++;return [2,3,4];}
  public function snapshot():Object {
   var rows:Array=[],seen:Array=[];
   var signed:int=17;
   var unsigned:uint=18;
   var flag:Boolean=true;
   for each(signed in ["3.75",null,undefined,true,false,"invalid",-2.5,Infinity,-Infinity,4294967297,2147483648])seen.push(signed);
   rows.push({id:"int-coercion",value:[seen,signed]});seen=[];
   for each(unsigned in ["3.75",null,undefined,true,false,"invalid",-2.5,Infinity,-Infinity,4294967297,2147483648])seen.push(unsigned);
   rows.push({id:"uint-coercion",value:[seen,unsigned]});seen=[];
   for each(flag in [null,undefined,false,true,0,-0,NaN,"","false",1,-2,[],{}])seen.push(flag);
   rows.push({id:"boolean-coercion",value:[seen,flag]});
   signed=23;unsigned=24;flag=true;
   for each(signed in [])seen.push("unexpected");for each(unsigned in [])seen.push("unexpected");for each(flag in [])seen.push("unexpected");
   rows.push({id:"empty-preserves",value:[signed,unsigned,flag]});
   for each(signed in null)seen.push("unexpected");for each(unsigned in null)seen.push("unexpected");for each(flag in null)seen.push("unexpected");
   rows.push({id:"null-preserves",value:[signed,unsigned,flag]});
   for each(signed in undefined)seen.push("unexpected");for each(unsigned in undefined)seen.push("unexpected");for each(flag in undefined)seen.push("unexpected");
   rows.push({id:"undefined-preserves",value:[signed,unsigned,flag]});
   var total:Number=0;for each(signed in values())total+=signed;
   rows.push({id:"receiver-once",value:[total,signed,calls]});
   total=0;for each(signed in [1,2,3,4]){if(signed==1)continue;total+=signed;if(signed==3)break;}
   rows.push({id:"break-continue",value:[total,signed]});
   try{for each(unsigned in [-1,2]){throw new Error("body");}}
   catch(e:Error){rows.push({id:"throw-preserves",value:[unsigned,e.message]});}
   var sparse:Array=[];sparse[2]="6.5";seen=[];
   for each(signed in sparse)seen.push(signed);
   rows.push({id:"sparse",value:seen});
   var vector:Vector.<Number>=new Vector.<Number>();vector.push(9.25);vector.push(-3);
   seen=[];for each(unsigned in vector)seen.push(unsigned);
   rows.push({id:"vector",value:[seen,unsigned]});
   var defaultInt:int;var defaultUint:uint;var defaultBoolean:Boolean;
   for each(defaultInt in [])seen.push("unexpected");for each(defaultUint in [])seen.push("unexpected");for each(defaultBoolean in [])seen.push("unexpected");
   rows.push({id:"defaults",value:[defaultInt,defaultUint,defaultBoolean]});
   total=7;for each(signed in [-0])total=1/signed;
   rows.push({id:"signed-zero",value:String(total)});
   total=7;for each(unsigned in [-0])total=1/unsigned;
   rows.push({id:"unsigned-zero",value:String(total)});
   seen=[];for each(signed in [1,2]){for each(unsigned in [-1,3])seen.push([signed,unsigned]);}
   rows.push({id:"nested",value:[seen,signed,unsigned]});
   return {ready:true,failure:"",observations:rows};
  }
 }
}
