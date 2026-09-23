// Separate observer for the complete, unchanged PrivateVectorSlot AS3 subject.
// This extends the public boundary observer; input construction is host setup.
const PrivateVectorSlot=klass('PrivateVectorSlot');
let slot=new PrivateVectorSlot();
row('slot-default',slot.read()===null);
const privateCases=[['interface',good],['concrete',concrete],['null',null],
 ['undefined',undefined],['object-vector',objects],['array',[item]],['object',{}]];
for(const [id,input] of privateCases){
 slot=new PrivateVectorSlot();slot.assign(good);
 try{const result=slot.assign(input);row('slot-assign-'+id,[true,result===input,
  slot.read()===input,slot.read()===null,slot.read()===good]);}
 catch(error){if(!api.as3IsSourceErrorInstance(error))throw error;
  row('slot-assign-'+id,[false,api.as3GetProperty(error,'name'),api.as3GetProperty(error,'errorID'),
   api.sourceErrorParent(error)===api.getAS3SourceErrorPrototype('TypeError'),slot.read()===good]);}
}
row('slot-catch-invalid',[slot.catchAssignment(objects),slot.read()===good]);
row('slot-catch-undefined',[slot.catchAssignment(undefined),slot.read()===null]);
slot.assign(good);
const otherSlot=new PrivateVectorSlot();
row('slot-separate',[otherSlot.read()===null,slot.read()===good]);
