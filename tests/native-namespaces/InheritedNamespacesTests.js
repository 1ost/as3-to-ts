const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
const parse = require('../../lib/parse');
const emit = require('../../lib/emit');
const options = {lineSeparator:'\n',customVisitors:[],definitionsByNamespace:{},namespaceUris:{'alias.same':'urn:inherited'}};
function generate(source){return emit(parse('InheritedNamespaces.as',source),source,options);}

for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015]){
  const context=vm.createContext({exports:{}});
  context.require=name=>{assert.equal(name,'./bound');return context.exports;};
  function execute(source){
    const result=ts.transpileModule(source,{compilerOptions:{target,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},reportDiagnostics:true});
    assert.deepEqual(result.diagnostics,[],source);
    vm.runInContext('(function(exports){\n'+result.outputText+'\n})(exports);',context);
  }
  for(const helper of ['bound','classBound']){
    execute(fs.readFileSync(path.resolve(__dirname,'../../utils',helper+'.ts'),'utf8'));
    context[helper]=context.exports[helper];
  }
  const source=`package inheritance {
    public namespace n = "urn:inherited";
    public namespace other = "urn:other";
    import alias.same;
    public class Base {
      n var signed:int = 0;
      n var unsigned:uint = 0;
      n static var staticValue:int = 9;
      public var log:Array;
      public function Base(events:Array) { super(); this.log=events; this.log.push("base"); }
      n function add(value:Number):Number {
        this.log.push("add"); this.n::signed += value; return this.n::signed;
      }
      public function baseWrite(value:Number):void { this.n::signed = value; }
    }
    public class Middle extends Base {
      public function Middle(events:Array) { super(events); this.log.push("middle"); }
      public function implicitWrite(value:Number):Number { n::unsigned = value; return n::unsigned; }
    }
    public class Leaf extends Middle {
      public var signed:Number = 100;
      other var signed:int = 50;
      n var extra:int = 3;
      public function Leaf(events:Array) { super(events); this.log.push("leaf"); this.same::signed = 2; }
      public function read():Array { return [this.same::signed, n::unsigned, this.other::signed, this.signed, n::extra]; }
      public function take():Function { return this.same::add; }
      public function change(other:Leaf, base:Base, value:Number):Array {
        other.same::signed = value;
        var assigned:Number = (other.same::unsigned += value);
        base.same::signed += 2;
        return [other.same::signed, other.same::unsigned, base.same::signed, assigned];
      }
      public function call(other:Middle, value:Number):Number { return other.same::add(value); }
    }
  }`;
  const output=generate(source);
  assert.doesNotMatch(output,/\b(?:n|same|other)::/);
  execute(output.replace(/^\s*import [^\r\n]+/gm,''));
  const {Base,Middle,Leaf}=context.exports,events=[];
  const first=new Leaf(events), second=new Leaf([]);
  assert(first instanceof Base && first instanceof Middle && first instanceof Leaf);
  assert.deepEqual(events,['base','middle','leaf']);
  assert.deepEqual(Array.from(first.read()),[2,0,50,100,3]);
  assert.equal(first.implicitWrite(-1.75),4294967295);
  const closure=first.take();
  assert.strictEqual(first.take(),closure);
  assert.equal(closure.call(second,2.75),4,'inherited method binds the original derived receiver');
  assert.deepEqual(events,['base','middle','leaf','add'],'method side effect occurs once');
  assert.deepEqual(Array.from(first.read()),[4,4294967295,50,100,3]);
  assert.deepEqual(Array.from(second.read()),[2,0,50,100,3],'inherited storage remains per instance');
  assert.deepEqual(Array.from(first.change(second,first,-1.75)),[-1,4294967295,6,4294967295]);
  assert.equal(first.call(second,2.75),1);
  assert.equal(second.take().call(first,1),2);
  assert.equal(first.signed,100,'public spelling is separate from both namespace identities');
  const key=Symbol.for('as3.namespace.member@1:'+JSON.stringify(['urn:inherited','signed']));
  assert.equal(first[key],6);
  assert.equal(second[key],2);
  const methodKey=Symbol.for('as3.namespace.member@1:'+JSON.stringify(['urn:inherited','add']));
  assert.equal(first[methodKey],closure,'inherited method uses the original URI/name authority');

  const overrideSource=`package overrides {
    public namespace n="urn:override";
    public class Base {
      n function value():String { return "base"; }
    }
    public class Child extends Base {
      override n function value():String { return "child"; }
      public function read():Array { return [this.n::value(), n::value()]; }
    }
  }`;
  execute(generate(overrideSource).replace(/^\s*import [^\r\n]+/gm,''));
  const overridden=new context.exports.Child();
  assert.deepEqual(Array.from(overridden.read()),['child','child']);
  const overrideKey=Symbol.for('as3.namespace.member@1:'+JSON.stringify(['urn:override','value']));
  assert.equal(overridden[overrideKey](), 'child');

  const superSource=`package supercalls {
    public namespace n="urn:supercalls";
    public class SuperBase { n var stored:int=3; n function value():int { return n::stored; } }
    public class SuperChild extends SuperBase {
      override n function value():int { return super.n::value() + 4; }
    }
  }`;
  execute(generate(superSource).replace(/^\s*import [^\r\n]+/gm,''));
  const superChild=new context.exports.SuperChild();
  const superKey=Symbol.for('as3.namespace.member@1:'+JSON.stringify(['urn:supercalls','value']));
  assert.equal(superChild[superKey](),7);

  const defaultsSource=`package defaults {
    public namespace n="urn:defaults";
    public class SlotReference {}
    public class DefaultsBase {
      n var signed:int; n var unsigned:uint; n var number:Number;
      n var boolean:Boolean; n var object:Object; n var string:String;
      n var reference:SlotReference; n var array:Array; n var fn:Function;
      n var any:*; n var untyped;
      n static var staticInt:int; n static var staticNumber:Number;
      n static var staticReference:SlotReference; n static var staticAny:*;
      public var initialized:Array = [this.n::signed,this.n::number,this.n::object];
      public var constructed:Array;
      public function DefaultsBase(){ super(); this.constructed=this.read(); }
      public function read():Array {return [this.n::signed,this.n::unsigned,this.n::number,
        this.n::boolean,this.n::object,this.n::string,this.n::reference,this.n::array,
        this.n::fn,this.n::any,this.n::untyped];}
      public function staticRead():Array {return [DefaultsBase.n::staticInt,
        DefaultsBase.n::staticNumber,DefaultsBase.n::staticReference,DefaultsBase.n::staticAny];}
    }
    public class DefaultsChild extends DefaultsBase {
      n var ownInt:int; n var ownReference:SlotReference;
      public var childConstructed:Array;
      public function DefaultsChild(){super();this.childConstructed=[n::signed,n::ownInt,n::ownReference];}
      public function ownRead():Array{return [this.n::ownInt,this.n::ownReference];}
    }
  }`;
  execute(generate(defaultsSource).replace(/^\s*import [^\r\n]+/gm,''));
  const ownDefaults=new context.exports.DefaultsBase(),inheritedDefaults=new context.exports.DefaultsChild();
  const expectedDefaults=[0,0,NaN,false,null,null,null,null,null,undefined,undefined];
  for(const instance of [ownDefaults,inheritedDefaults]){
    assert.deepStrictEqual(Array.from(instance.read()),expectedDefaults);
    assert.deepStrictEqual(Array.from(instance.constructed),expectedDefaults);
    assert.deepStrictEqual(Array.from(instance.initialized),[0,NaN,null]);
    assert.deepStrictEqual(Array.from(instance.staticRead()),[0,NaN,null,undefined]);
    for(const name of ['signed','unsigned','number','boolean','object','string','reference','array','fn','any','untyped']){
      const slot=Symbol.for('as3.namespace.member@1:'+JSON.stringify(['urn:defaults',name]));
      assert(Object.prototype.hasOwnProperty.call(instance,slot),name+' default has own slot storage');
    }
  }
  assert.deepStrictEqual(Array.from(inheritedDefaults.childConstructed),[0,0,null]);
  assert.deepStrictEqual(Array.from(inheritedDefaults.ownRead()),[0,null]);
  execute(generate('package p {public namespace n="urn:open-inherited"; use namespace n; public class OpenBase {n var x:int=5;} public class OpenChild extends OpenBase {public function read():* {return this.x;}}}').replace(/^\s*import [^\r\n]+/gm,''));
  assert.equal(new context.exports.OpenChild().read(),5,'opened namespace selects inherited field');
  execute(generate('package p {public namespace n="urn:super-field"; public class FieldBase {n var x:int=5;} public class FieldChild extends FieldBase {public function read():* {return super.n::x;}}}').replace(/^\s*import [^\r\n]+/gm,''));
  const fieldChild=new context.exports.FieldChild();
  assert.equal(fieldChild.read(),5,'super namespace field reads the inherited instance slot');
  console.log('inherited namespace native-class execution passed for '+ts.ScriptTarget[target]);
}

const preamble='package p { public namespace n="urn:n"; ';
const invalid=[
  'public class Child extends Missing { n var x:int; }',
  'public class Child extends Base {n var y:int;} public class Base {n var x:int;}',
  'import flash.utils.Proxy; public class Child extends Proxy { override n function getProperty(name:*):* {return null;} }',
  'import flash.utils.Proxy; public class Base extends Proxy {} public class Child extends Base { n var x:int; }',
  'public dynamic class Base {n var x:int;} public class Child extends Base {}',
  'public class Base extends Child {} public class Child extends Base { n var x:int; }',
  'public class Base {n var x:int;} public class Child extends Base { n var x:int; }',
  'public class Base {n function f():void{}} public class Child extends Base { override n var f:int; }',
  'public class Base {n static var x:int;} public class Child extends Base {public function f():*{return Child.n::x;}}',
  'public class Base {n var x:int;} public class Child extends Base {public function f():*{return x;}}',
  'public class Base {n var x:int;} public class Child extends Base {public function f():*{return get().n::x;} public function get():Child{return this;}}',
  'public class Base {n var x:int;} public class Child extends Base {public function f(other:Object):*{return other.n::x;}}',
  'public class Base {n var x:int;} public class Child extends Base {public function f():void{this.n::x++;}}',
  'public class Base {n var x:int;} public class Child extends Base {public function f():void{delete n::x;}}',
  'public class Base {n function f():void{}} public class Child extends Base {public function g():void{this.n::f=null;}}',
  'public class Base {n var x:int;} public class Child extends Base {public function f(xml:XML):*{return xml.n::x;}}',
  'public class Base {n var x:int;} public class Child extends Base {public function f(n:Object):*{return n::x;}}'
];
for(const source of invalid)assert.throws(()=>generate(preamble+source+'}'),/AS3_NAMESPACE_UNSUPPORTED/,source);
console.log(invalid.length+' inherited namespace unsupported-source checks passed');
