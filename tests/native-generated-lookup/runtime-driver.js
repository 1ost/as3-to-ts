const Reader=consumerOnly?load('LookupReader').LookupReader:load('nativeClass').readNativeClass(load('LookupReader').LookupReader);
const Shadow=load('nativeClass').readNativeClass(load('ShadowReader').ShadowReader);
const reader=new Reader(),shadow=new Shadow(),rows=[];
// Fixture registration tests returned identity, not reflected class construction.
class LookupClass {}
function transform() {}
api.registerDefinitionByName('fixture.pkg.LookupClass',LookupClass);
api.registerDefinitionByName('fixture.pkg.transform',transform);
rows.push({id:'class-dot',value:reader.lookup('fixture.pkg.LookupClass')===LookupClass});
rows.push({id:'class-colon',value:reader.lookup('fixture.pkg::LookupClass')===LookupClass});
rows.push({id:'function-dot',value:reader.lookup('fixture.pkg.transform')===transform});
rows.push({id:'function-colon',value:reader.lookup('fixture.pkg::transform')===transform});
rows.push({id:'caught-success',value:reader.caught('fixture.pkg.LookupClass')});
rows.push({id:'caught-missing',value:reader.caught('fixture.pkg.Missing')});
rows.push({id:'caught-null',value:reader.caught(null)});
rows.push({id:'caught-undefined',value:reader.caught(undefined)});
rows.push({id:'caught-empty',value:reader.caught('')});
rows.push({id:'caught-number',value:reader.caught(42)});
let log=[];
function converted(){log.push('convert');return 'fixture.pkg.LookupClass';}
api.registerAS3StringReturn(converted);
rows.push({id:'conversion',value:[reader.lookup({toString:converted})===LookupClass,log]});
log=[];rows.push({id:'fallback',value:[reader.fallback('fixture.pkg.Missing',log)===LookupClass,log]});
log=[];rows.push({id:'fallback-null',value:[reader.fallback(null,log)===LookupClass,log]});
log=[];rows.push({id:'fallback-success',value:[reader.fallback('fixture.pkg.transform',log)===transform,log]});
rows.push({id:'lexical-shadow',value:reader.lexical(name=>'local:'+name,'test')});
rows.push({id:'own-shadow',value:shadow.own('test')});
const Inherited=load('nativeClass').readNativeClass(load('InheritedReader').InheritedReader);
const Wildcard=consumerOnly?load('WildcardReader').WildcardReader:load('nativeClass').readNativeClass(load('WildcardReader').WildcardReader);
rows.push({id:'inherited-shadow',value:new Inherited().inherited('test')});
rows.push({id:'wildcard-import',value:new Wildcard().lookup('fixture.pkg.LookupClass')===LookupClass});
globalThis.result=rows;
