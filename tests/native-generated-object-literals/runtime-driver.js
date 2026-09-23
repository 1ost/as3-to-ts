const Reader=load('nativeClass').readNativeClass(load('Reader').Reader),r=new Reader(),rows=[];
const payload=api.as3CreateDynamicObject(),empty=r.empty(),made=r.make(payload);
const name=value=>api.as3XMLListString(api.as3XMLAttribute(api.as3DescribeTypeXML(value),'name'));
rows.push({id:'empty',value:[empty!=null,empty!==r.empty(),name(empty)]});
rows.push({id:'values',value:[made.first,made.duplicate,made.constructor,made[7]]});
rows.push({id:'identity',value:[made.nested.payload===payload,made['__proto__']===payload]});
rows.push({id:'order',value:r.events.slice()});
rows.push({id:'reflection',value:[name(made),name(made.nested)]});
rows.push({id:'own',value:[Object.prototype.hasOwnProperty.call(made,'__proto__'),Object.prototype.propertyIsEnumerable.call(made,'__proto__'),Object.prototype.hasOwnProperty.call(made,'constructor')]});
rows.push({id:'assignment',value:r.assignment().value});
r.events.length=0;
try{r.throws();}catch(error){rows.push({id:'throw',value:error});}
rows.push({id:'throw-order',value:r.events.slice()});
if(Object.getPrototypeOf(made)!==Object.prototype)throw Error('literal changed host prototype');
globalThis.result=rows;
