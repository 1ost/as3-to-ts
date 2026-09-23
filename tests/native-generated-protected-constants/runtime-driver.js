// Separate observer; all three complete AIR subjects are emitted unchanged.
const nc=load('nativeClass'),klass=name=>nc.readNativeClass(load(name)[name]);
const Base=klass('ProtectedConstants'),Derived=klass('DerivedConstants'),Spy=klass('ValueSpy');
const rows=[],row=(id,value)=>rows.push({id,value});
const error=e=>[api.as3GetProperty(e,'name'),api.as3GetProperty(e,'errorID')];
const base=new Base(),derived=new Derived();
row('base-read',base.read());row('derived-read',derived.read());row('inherited-read',derived.inherited());
row('static-read',[Base.readStatic(),Base.staticBefore]);
for(const name of ['MESSAGE','LIMIT']){
 row('named-'+name,[base.readByName(name),derived.inheritedName(name)]);
 const spy=new Spy();
 try{base.write(name,spy);row('write-'+name,'accepted');}
 catch(e){row('write-'+name,[...error(e),api.as3IsSourceErrorInstance(e)&&api.sourceErrorParent(e)===api.getAS3SourceErrorPrototype('ReferenceError'),base.effects,spy.calls,base.readByName(name)]);}
 try{base.writeEffect(name);row('effect-'+name,'accepted');}
 catch(e){row('effect-'+name,[...error(e),base.effects,base.readByName(name)]);}
 try{derived.inheritedWrite(name,spy);row('inherited-write-'+name,'accepted');}
 catch(e){row('inherited-write-'+name,[...error(e),spy.calls,derived.inheritedName(name)]);}
 row('delete-'+name,[base.remove(name),derived.remove(name),base.readByName(name)]);
 try{row('external-'+name,['accepted',api.as3GetProperty(base,name)]);}
 catch(e){row('external-'+name,error(e));}
}
row('named-static',Base.readStaticName('STATIC_MESSAGE'));
const staticSpy=new Spy();
try{Base.writeStatic('STATIC_MESSAGE',staticSpy);row('write-static','accepted');}
catch(e){row('write-static',[...error(e),staticSpy.calls,Base.readStatic()]);}
row('delete-static',[Base.removeStatic('STATIC_MESSAGE'),Base.readStatic()]);
try{const absent=api.as3GetProperty(Base,'STATIC_MESSAGE');row('external-static',['accepted',typeof absent,absent===undefined,absent===null]);}
catch(e){row('external-static',error(e));}
row('fresh-instance',[new Base().read(),base.effects,derived.effects]);
globalThis.result=rows;
