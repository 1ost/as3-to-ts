package {
 import cases.VectorReturn;
 public class PrivateVectorReturnProbe {
  public function snapshot():Object {
   var rows:Array=[],subject:VectorReturn=new VectorReturn(),other:VectorReturn=new VectorReturn();
   var ints:Vector.<int>=new Vector.<int>(); ints.push(4,7);
   rows.push({id:"identity",value:subject.exchange(ints) === ints});
   rows.push({id:"null",value:subject.exchange(null) === null});
   rows.push({id:"undefined",value:subject.exchange(undefined) === null});
   var fn:Function=subject.closure();
   rows.push({id:"bound-owner",value:fn.call(other,ints) === ints});
   rows.push({id:"closure-identity",value:fn === subject.closure()});
   var bad:Array=[[],new Vector.<uint>(),new Vector.<Number>(),new Vector.<*>(),{}];
   for(var i:int=0;i<bad.length;i++) {
    try { subject.exchange(bad[i]); rows.push({id:"bad-"+i,value:"accepted"}); }
    catch(error:Error) { rows.push({id:"bad-"+i,value:[error.name,error.errorID]}); }
   }
   rows.push({id:"calls-after-errors",value:[subject.calls(),other.calls()]});
   rows.push({id:"static-identity",value:subject.staticExchange(ints) === ints});
   rows.push({id:"static-undefined",value:subject.staticExchange(undefined) === null});
   try { subject.staticExchange([]); rows.push({id:"static-array",value:"accepted"}); }
   catch(staticError:Error) { rows.push({id:"static-array",value:[staticError.name,staticError.errorID]}); }
   rows.push({id:"digits-204",value:subject.digits(204).join(",")});
   rows.push({id:"digits-0",value:subject.digits(0).join(",")});
   rows.push({id:"digits-overflow",value:subject.digits(4294967297).join(",")});
   return {ready:true,failure:"",observations:rows};
  }
 }
}
