// Observe the complete emitted VectorQueue; construction and queue logic execute in that subject.
const VectorQueue=klass('VectorQueue');
const queue=new VectorQueue();let original=queue.read();
row('queue-default',[queue.initiallyNull,original.length,original.fixed,api.getQualifiedClassName(original),original===queue.read()]);
queue.add(item);
row('queue-add',[original.length,original[0]===item,original===queue.read()]);
queue.init();
row('queue-reinitialize',[queue.read()!==original,queue.read().length,queue.read().fixed,original.length,original[0]===item]);
const otherQueue=new VectorQueue();
row('queue-separate',[otherQueue.initiallyNull,otherQueue.read()!==queue.read()]);
for(let index=0;index<103;index++){
 queue.add(new ProbeOrder(index));
 if(index>=99)row('queue-limit-'+index,[queue.read().length,queue.read()[0].getType(),queue.read()[queue.read().length-1].getType()]);
}
queue.add(null);
row('queue-add-null',[queue.read().length,queue.read()[0].getType(),queue.read()[100]===null]);
original=queue.read();
function errorDetails(error){if(!api.as3IsSourceErrorInstance(error))throw error;return [api.as3GetProperty(error,'name'),
 api.as3GetProperty(error,'errorID'),api.sourceErrorParent(error)===api.getAS3SourceErrorPrototype('TypeError')];}
try{queue.assign(objects);row('queue-invalid','accepted');}
catch(error){row('queue-invalid',[...errorDetails(error),queue.read()===original]);}
queue.assign(concrete);
try{queue.add(new (klass('OtherOrder'))());row('queue-widened-write','accepted');}
catch(error){row('queue-widened-write',[...errorDetails(error),queue.read()===concrete,concrete.length,concrete[0]===item,concrete[1]===null]);}
for(const [id,length,fixed] of [['zero',0,false],['three',3,false],['fixed',2,true]]){
 const created=queue.sized(length,fixed);
 row('construct-'+id,[created.length,created.fixed,created.length===0||created[0]===null,
  api.getQualifiedClassName(created),created!==queue.sized(length,fixed)]);
}
