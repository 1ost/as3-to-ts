const {TextField,Sprite,InteractiveObject,DisplayObject,EventDispatcher,IEventDispatcher,IBitmapDrawable}=api;
const TextSink=load('nativeClass').readNativeClass(load('TextSink').TextSink);
class TextFieldStorageProbe {
    constructor() {
        this.rows = [];
    }
    record(id, fn) { var result; var failure = []; try {
        result = fn();
    }
    catch (e) {
        failure = [e.name, e.errorID];
    } this.rows.push({ id: id, value: [result === undefined ? "<undefined>" : result, failure] }); }
    snapshot() {
        const rows = this.rows, record = this.record.bind(this);
        var field = new TextField(), other = new TextField(), owner = new TextSink();
        record("identity", function () { return [api.as3Is(field, TextField), api.as3Is(field, InteractiveObject), api.as3Is(field, DisplayObject), api.as3Is(field, EventDispatcher), api.as3Is(field, IEventDispatcher), api.as3Is(field, IBitmapDrawable), api.as3Is(TextField.prototype, TextField)]; });
        record("defaults", function () { return [TextSink.field === null, owner.own === null, TextSink.append("ignored"), owner.appendOwn("ignored")]; });
        record("assign", function () { return [TextSink.assign(field), TextSink.field === field]; });
        record("append", function () { return TextSink.append("one"); });
        record("append-empty", function () { return TextSink.append(""); });
        record("append-null", function () { return TextSink.append(null); });
        record("assign-object", function () { return TextSink.assign({}); });
        record("assign-sprite", function () { return TextSink.assign(new Sprite()); });
        record("assign-prototype", function () { return TextSink.assign(TextField.prototype); });
        record("assign-number", function () { return TextSink.assign(1); });
        record("assign-string", function () { return TextSink.assign("field"); });
        record("assign-spy", function () { return TextSink.assign({ valueOf: function () { rows.push({ id: "unexpected-valueOf", value: [] }); return field; }, toString: function () { rows.push({ id: "unexpected-toString", value: [] }); return "field"; } }); });
        record("after-rejections", function () { return [TextSink.field === field, field.text]; });
        record("assign-undefined", function () { return [TextSink.assign(undefined), TextSink.field === null]; });
        record("assign-null", function () { return [TextSink.assign(null), TextSink.field === null]; });
        record("assign-other", function () { return [TextSink.assign(other), TextSink.append("other"), field.text]; });
        record("own-assign", function () { return [owner.assignOwn(field), owner.own === field]; });
        record("own-append", function () { return [owner.appendOwn("owned"), other.text]; });
        record("own-reject", function () { return owner.assignOwn(other.parent); });
        record("own-invalid", function () { owner.assignOwn(field); return owner.assignOwn({}); });
        record("own-retained", function () { return owner.own === field; });
        record("own-undefined", function () { return [owner.assignOwn(undefined), owner.own === null]; });
        return { ready: true, failure: "", observations: rows };
    }
}

const observations=new TextFieldStorageProbe().snapshot().observations;
// Native proof must reject prototype inheritance and Proxy wrappers even when JS instanceof accepts them.
const genuine=new TextField(), owner=new TextSink();
TextSink.assign(genuine);owner.assignOwn(genuine);
let providerNegativeControls=0;
for(const value of [Object.create(TextField.prototype),Object.create(genuine),new Proxy(genuine,{})]){
 for(const assign of [()=>TextSink.assign(value),()=>owner.assignOwn(value)]){
  let failure;try{assign();}catch(e){failure=e;}
  if(!failure||failure.name!=='TypeError'||failure.errorID!==1034)throw Error('TextField forgery accepted');
  if(TextSink.field!==genuine||owner.own!==genuine)throw Error('Rejected TextField replaced storage');
  providerNegativeControls++;
 }
}
if(providerNegativeControls!==6)throw Error('TextField guard count');
globalThis.result=observations;
