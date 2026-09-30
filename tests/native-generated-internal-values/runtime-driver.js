// Observer only: five complete fixture Classes are emitted unchanged.
const nc=load('nativeClass'),klass=name=>nc.readNativeClass(load(name)[name]);
const Holder=klass('Holder'),Peer=klass('Peer'),Child=klass('Child'),OtherChild=klass('OtherChild'),Outsider=klass('Outsider');
const rows=[],add=(id,value)=>rows.push({id,value});
const error=e=>[api.as3GetProperty(e,'name'),api.as3GetProperty(e,'errorID')];
const h=new Holder(),p=new Peer(),outside=new Outsider(),object={value:1};
h.own(object);p.take(h,object);add('object-identity',[h.calls,h.last===object]);
const fn=h.ownClosure(),other=p.closure(h),dynamicFn=p.readName(h,'take');
add('closure',[fn===other,fn===dynamicFn,api.as3GetProperty(fn,'length'),fn(object)===undefined,h.last===object,h.calls]);
fn(null);add('null-object',[h.last===null,h.calls]);
fn(undefined);add('undefined-object',[h.last===null,h.last===undefined,h.calls]);
fn(3);add('number-object',[h.last===3,h.calls]);
fn('text');add('string-object',[h.last==='text',h.calls]);
fn(false);add('boolean-object',[h.last===false,h.calls]);
const array=[1];fn(array);add('array-object',[h.last===array,h.calls]);
try{fn();add('missing-one','accepted');}catch(e){add('missing-one',[...error(e),h.calls]);}
try{fn(object,object);add('extra-one','accepted');}catch(e){add('extra-one',[...error(e),h.calls]);}
const triple=p.readName(h,'triple');
triple(object,array,null);add('triple',[api.as3GetProperty(triple,'length'),h.first===object,h.second===array,h.third===null,h.calls]);
try{triple(object,array);add('missing-three','accepted');}catch(e){add('missing-three',[...error(e),h.calls]);}
try{triple(object,array,null,object);add('extra-three','accepted');}catch(e){add('extra-three',[...error(e),h.calls]);}
p.ordered(h);add('ordered',[p.effects,h.first,h.second,h.third,h.calls]);
p.dynamicOrdered(h);add('dynamic-ordered',[p.effects,h.first,h.second,h.third,h.calls]);
try{p.ordered(null);add('null-typed','accepted');}catch(e){add('null-typed',[...error(e),p.effects]);}
try{p.dynamicOrdered(null);add('null-dynamic','accepted');}catch(e){add('null-dynamic',[...error(e),p.effects]);}
const number=p.readName(h,'number');number(4294967297);add('int-wrap',[h.lastInt,h.calls]);
number(-3.75);add('int-truncate',[h.lastInt,h.calls]);
number('12');add('int-string',[h.lastInt,h.calls]);
number(NaN);add('int-nan',[h.lastInt,h.calls]);
number(undefined);add('int-undefined',[h.lastInt,h.calls]);
const mixed=p.readName(h,'mixed');mixed(object,4294967298);add('mixed',[api.as3GetProperty(mixed,'length'),h.last===object,h.lastInt,h.calls]);
const child=new Child();p.take(child,object);child.own(array);add('override',[child.calls,child.last===array,p.closure(child)===child.ownClosure()]);
const foreign=new OtherChild();p.take(foreign,object);foreign.ownOther(array);const foreignFn=outside.readName(foreign,'take');foreignFn(object);
add('separate-package',[foreign.calls,foreign.otherCalls,foreign.last===object,p.closure(foreign)===foreignFn]);
try{outside.readName(h,'take');add('outside','accepted');}catch(e){add('outside',error(e));}
try{p.writeName(h,'take',null);add('method-write','accepted');}catch(e){add('method-write',error(e));}
add('delete',[p.removeName(h,'take'),p.closure(h)===fn]);
add('reflection',[api.describeRegisteredFlashType(Holder).factory.methods.filter(m=>m.name==='take').length,api.describeRegisteredFlashType(Child).factory.methods.filter(m=>m.name==='take').length]);
add('fresh',[p.closure(new Holder())===fn,h.calls]);
globalThis.result=rows;
