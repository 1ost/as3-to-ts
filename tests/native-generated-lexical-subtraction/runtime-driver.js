const Counter=load('nativeClass').readNativeClass(load('Counter').Counter);
const rows=[],values=[3,"2.5",true,false,null,undefined,NaN,Infinity,-Infinity,-0];
for(let j=0;j<values.length;j++) {
 let c=new Counter(10.5);rows.push({id:"number-"+j,value:c.number(values[j])});
 c=new Counter(-2147483648);rows.push({id:"int-"+j,value:c.integer(values[j])});
 c=new Counter(0);rows.push({id:"uint-"+j,value:c.unsigned(values[j])});
}
let c=new Counter(10),other=new Counter(7);
rows.push({id:"order",value:c.order(other)});
c=new Counter(10);try{c.order(null);}catch(e){rows.push({id:"null",value:[api.as3GetProperty(e,"name"),api.as3GetProperty(e,"errorID"),c.log]});}
c=new Counter(10);other=new Counter(7);try{c.order(other,true);}catch(x){rows.push({id:"throw",value:[x,c.state(),other.state()]});}
c=new Counter(10);rows.push({id:"convert",value:c.number(c)});rows.push({id:"convert-state",value:c.state()});
for(const n of [0,1,1.25,-1.25,NaN]){c=new Counter(n);rows.push({id:"wrap-"+String(n),value:c.wrap()});}
globalThis.result=rows;
