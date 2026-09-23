const assert = require('assert'), vm = require('vm'), ts = require('typescript'), fs = require('fs');
const {fixture} = require('./callable-fixture');
const candidate = process.argv.includes('--working-common') ? require('./common-runtime').workingSource() : null;
const sources = {
    'binding.Base': `package binding {
        public class Base {
            public var baseClosure:Function;
            public var baseCall:int;
            public function Base() {baseClosure=this.read; baseCall=this.read();}
            public function read():int {return 1;}
            public function inherited():Object {return this;}
        }
    }`,
    'binding.Derived': `package binding {
        public class Derived extends Base {
            public var n:int=7;
            public var early:Function=this.read;
            public var observed:int=this.read();
            public function Derived(){super();}
            override public function read():int{return this.n;}
            public function callback():Function{return this.read;}
            public function ordinaryCallback():int {
                var callback:Function=function():int{return 13;};
                return callback();
            }
        }
    }`,
    'binding.Statics': `package binding {
        public class Statics {
            public static var earlyStatic:Function=Statics.staticRead;
            public static var counter:int=5;
            public static function staticRead():int{return counter;}
        }
    }`,
};
let checks = 0;
for (const target of [ts.ScriptTarget.ES5, ts.ScriptTarget.ES2015]) {
    const native = fixture(target, sources, candidate && candidate.source), Base = native.get('Base'), Derived = native.get('Derived'), Statics = native.get('Statics'), common = native.common;
    const noArguments = vm.runInContext('(() => [])', native.context);
    assert(!/boundMethods|bindDeclaredInstanceMethods|@bound/.test(native.generated.Derived)); checks++;
    assert(native.generated.Derived.includes('bindAS3Method as')); checks++;
    assert.equal(typeof Object.getOwnPropertyDescriptor(Derived.prototype, 'read').value, 'function'); checks++;
    assert.equal(Object.getOwnPropertyDescriptor(Derived.prototype, 'read').get, undefined); checks++;
    native.context.Base = Base; native.context.Derived = Derived; native.context.common = common;
    // This harness supplies source-derived public metadata only to exercise the
    // canonical provider. Automatic ordered reflection publication is separate.
    vm.runInContext(`{
        const variables = (names, owner) => names.map(([name,type]) => ({name,type,declaredBy:owner}));
        const methods = (names, owner) => names.map(name => ({name,declaredBy:owner,parameterCount:0}));
        const empty = {variables:[],accessors:[],methods:[]};
        Object.defineProperty(Base,'prototype',{writable:false,configurable:false});
        Object.defineProperty(Derived,'prototype',{writable:false,configurable:false});
        const baseVariables = variables([['baseClosure','Function'],['baseCall','int']], 'binding::Base');
        common.registerFlashTypeMetadata(Base,{name:'binding::Base',base:'Object',isDynamic:false,isFinal:false,
            instance:{variables:baseVariables,accessors:[],methods:methods(['read','inherited'],'binding::Base')},statics:empty});
        const sourceVariables=[['n','int'],['early','Function'],['observed','int']];
        common.registerFlashTypeMetadata(Derived,{name:'binding::Derived',base:'binding::Base',isDynamic:false,isFinal:false,
            instance:{variables:[...baseVariables,...variables(sourceVariables,'binding::Derived')],accessors:[],
                methods:[...methods(['read','callback','ordinaryCallback'],'binding::Derived'),...methods(['inherited'],'binding::Base')]},
            statics:empty});
        common.registerAS3PropertyTraits(Base,[{name:'baseClosure',kind:'variable',type:'Function'},
            {name:'baseCall',kind:'variable',type:'int'},{name:'read',kind:'method'},{name:'inherited',kind:'method'}]);
        common.registerAS3PropertyTraits(Derived,[{name:'baseClosure',kind:'variable',type:'Function'},
            {name:'baseCall',kind:'variable',type:'int'},...sourceVariables.map(([name,type])=>({name,type,kind:'variable'})),
            ...['read','inherited','callback','ordinaryCallback'].map(name=>({name,kind:'method'}))]);
    }`, native.context);
    const value = new Derived(), second = new Derived();
    const direct = value.read, dispatched = common.as3GetProperty(value, 'read');
    for (const result of [direct === dispatched, value.early === direct, value.baseClosure === direct,
        value.callback() === direct, second.read !== direct, value.observed === 7, value.baseCall === 7,
        direct.call({n:99}) === 7, value.inherited() === value,
        common.as3GetProperty(value,'inherited') === value.inherited,
        common.as3CallProperty(value,'read',noArguments) === 7, value.ordinaryCallback() === 13,
        value instanceof Base, value instanceof Derived, value.constructor === Derived,
        Statics.earlyStatic === Statics.staticRead, Statics.earlyStatic() === 5]) {
        assert.strictEqual(result, true); checks++;
    }
    const unrelated = function(){return 99;};
    assert.throws(()=>common.getBoundAS3Method(value,'read',unrelated),/replaced by a host property/); checks++;
    const original = Object.getOwnPropertyDescriptor(Derived.prototype,'read').value;
    value.read = unrelated;
    assert.throws(()=>common.getBoundAS3Method(value,'read',original),/replaced by a host property/); checks++;
    if (candidate) {
        native.context.Statics = Statics;
        vm.runInContext(`{
            const owner='binding::Statics';
            Object.defineProperty(Statics,'prototype',{writable:false,configurable:false});
            common.registerFlashTypeMetadata(Statics,{name:owner,base:'Object',isDynamic:false,isFinal:false,
                instance:{variables:[],accessors:[],methods:[]},
                statics:{variables:[{name:'earlyStatic',type:'Function',declaredBy:owner},{name:'counter',type:'int',declaredBy:owner}],
                    accessors:[],methods:[{name:'staticRead',declaredBy:owner,parameterCount:0}]}});
            common.registerAS3PropertyTraits(Statics,[],[{name:'earlyStatic',kind:'variable',type:'Function'},
                {name:'counter',kind:'variable',type:'int'},{name:'staticRead',kind:'method'}]);
        }`, native.context);
        const dispatchedStatic = common.as3GetProperty(Statics,'staticRead');
        assert.strictEqual(dispatchedStatic, Statics.staticRead); checks++;
        assert.strictEqual(dispatchedStatic, Statics.earlyStatic); checks++;
        assert.strictEqual(common.as3CallProperty(Statics,'staticRead',noArguments), 5); checks++;
        assert.strictEqual(common.as3GetProperty(Statics,'staticRead'), dispatchedStatic); checks++;
        Statics.staticRead = unrelated;
        assert.throws(()=>common.as3GetProperty(Statics,'staticRead'), /replaced by a host property/); checks++;
    }
    console.log('Canonical common method registry preserves compiled reads, provider reads and callbacks for '+(target===ts.ScriptTarget.ES5?'ES5':'ES2015'));
}
console.log(checks+' common method-binding interoperability checks passed');
if (candidate) {
    const outputIndex = process.argv.indexOf('--report');
    if (outputIndex >= 0) fs.writeFileSync(process.argv[outputIndex+1], JSON.stringify({checks,
        scope:'Explicit working common-provider integration probe; not a dependency pin or constructor admission',files:candidate.files},null,2)+'\n');
}
