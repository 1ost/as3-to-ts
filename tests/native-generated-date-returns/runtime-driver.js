const DateReturns = load("nativeClass").readNativeClass(load("DateReturns").DateReturns);
const subject = new DateReturns(), expected = new api.AS3Date(0), rows = [];
function record(id, fn) { DateReturns.events = []; let result = "unset", failure = []; try {
    result = fn();
}
catch (e) {
    failure = [e.name, e.errorID];
} rows.push({ id, value: [result === expected, result === null, result === undefined, api.as3Is(result, api.AS3Date), api.as3Is(result, api.AS3Date) ? String(result.getTime()) : "none", DateReturns.events.slice(), failure] }); }
record("identity-date", function () { return subject.identity(expected); });
record("identity-null", function () { return subject.identity(null); });
record("identity-undefined", function () { return subject.identity(undefined); });
record("identity-prototype", function () { return subject.identity(api.AS3Date.prototype); });
record("identity-object", function () { return subject.identity({}); });
record("identity-number", function () { return subject.identity(0); });
record("identity-string", function () { return subject.identity("date"); });
record("identity-coercion-spy", function () { return subject.identity({ valueOf: function () { DateReturns.events.push("valueOf"); return expected; }, toString: function () { DateReturns.events.push("toString"); return "date"; } }); });
record("optional-omitted", function () { return subject.optional(); });
record("optional-undefined", function () { return subject.optional(undefined); });
record("optional-date", function () { return subject.optional(expected); });
record("optional-invalid", function () { var f = subject.optional; return f({}); });
record("caught-invalid", function () { return subject.caught({}); });
record("finally-date", function () { return subject.throughFinally(expected); });
record("finally-invalid", function () { return subject.throughFinally({}); });
record("replacement-invalid", function () { return subject.replacement({}); });
record("getter-initial", function () { return subject.value; });
subject.raw = expected;
record("getter-date", function () { return subject.value; });
subject.raw = {};
record("getter-invalid", function () { return subject.value; });
subject.raw = undefined;
record("getter-undefined", function () { return subject.value; });
record("epoch", function () { return DateReturns.fromEpoch(0); });
record("invalid-date", function () { return DateReturns.fromEpoch(NaN); });
record("epoch-coercion", function () { var f = DateReturns.fromEpoch; return f({ valueOf: function () { DateReturns.events.push("epoch-conversion"); return -1; } }); });
record("epoch-missing", function () { var f = DateReturns.fromEpoch; return f(); });
record("identity-extra", function () { var f = subject.identity; return f(expected, 1); });
globalThis.result = rows;

// Provider boundary controls, separate from the 25 AIR observations.
let providerGuards=0;
for(const fake of [new Date(0),Object.create(api.AS3Date.prototype),Object.create(expected),new Proxy(expected,{})]) {
 let failure;try{subject.identity(fake);}catch(e){failure=e;}
 if(!failure||failure.name!=='TypeError'||failure.errorID!==1034)throw Error('forged Date return accepted');
 providerGuards++;
}
for(const [reference,name] of [[Date,'Date'],[class AS3Date {},'Date'],[api.AS3Date,'OtherDate']]) {
 class Owner {get value(){return null;}}
 const declaration=api.declareAS3ReferenceType('Owner');
 let failure;try{api.registerAS3GeneratedClass(Owner,{declaration,metadata:{name:'Owner',base:'Object',isDynamic:false,isFinal:false,
 instance:{variables:[],constants:[],methods:[],accessors:[{name:'value',declaredBy:'Owner',access:'readonly'}]},
 statics:{variables:[],constants:[],methods:[],accessors:[]}},instanceTraits:[{name:'value',kind:'accessor',type:{name,reference}}],staticTraits:[]});}catch(e){failure=e;}
 if(!failure||!String(failure).includes('native reference needs exact registered declaration identity'))throw Error('invalid Date trait identity accepted');
 providerGuards++;
}
if(providerGuards!==7)throw Error('missing provider guards');
