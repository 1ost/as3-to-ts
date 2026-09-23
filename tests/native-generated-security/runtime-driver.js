// Only the observer is translated. The complete SecurityConsumer is emitted.
const SecurityConsumer=load('nativeClass').readNativeClass(load('SecurityConsumer').SecurityConsumer);
const rows=[{id:'constants',value:SecurityConsumer.constants()}];
for(const [id,value] of [['application','application'],['trusted','localTrusted'],['file','localWithFile'],['network','localWithNetwork'],['remote','remote']])rows.push({id,value:SecurityConsumer.classify(value)});
// Native host contract, separate from the retained AIR application sandbox.
const protocol=globalThis.location?.protocol||'';
if(protocol!==''&&protocol!=='http:'&&protocol!=='file:')throw Error('Unexpected fixture host '+protocol);
const expected=protocol==='file:'?'localWithFile':'remote';
if(SecurityConsumer.sandbox()!==expected)throw Error('Incorrect native sandbox');
if(SecurityConsumer.isNetwork()!==(expected==='remote'))throw Error('Incorrect Debug network branch');
globalThis.result=rows;
