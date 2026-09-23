const SharedObject=api.SharedObject,EventDispatcher=api.EventDispatcher,as3Is=api.as3Is;
const LocalSettings=load('nativeClass').readNativeClass(load('LocalSettings').LocalSettings);
class StorageHost extends api.FlashSharedObjectStorageHost {
 constructor(){super();this.values=new Map();}
 read(key){return this.values.get(key)??null;}
 write(key,value){this.values.set(key,value);}
 remove(key){this.values.delete(key);}
}
api.installFlashSharedObjectStorageHost(new StorageHost());
class SharedObjectProbe {
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
        var name = "op2-port-shared-object-local-evidence-20260922";
        var local = SharedObject.getLocal(name);
        local.clear();
        var data = local.data;
        record("identity", function () { return [as3Is(local, SharedObject), as3Is(local, EventDispatcher), SharedObject.getLocal(name) === local, SharedObject.getLocal(name, null) === local, local.data === data]; });
        record("default-data", function () { return [data.hasOwnProperty("sound"), data.sound === undefined]; });
        record("settings-write", function () { return LocalSettings.write(name, false, "v1", true); });
        record("settings-read", function () { return LocalSettings.read(name); });
        record("data-after-flush", function () { return [local.data === data, data.sound, data.lastVersion]; });
        record("typed-live", function () { return LocalSettings.identity(local) === local; });
        record("typed-null", function () { return LocalSettings.identity(null) === null; });
        record("typed-undefined", function () { return LocalSettings.identity(undefined) === null; });
        record("typed-prototype", function () { return LocalSettings.identity(SharedObject.prototype) === SharedObject.prototype; });
        record("typed-object", function () { return LocalSettings.identity({}); });
        record("typed-number", function () { return LocalSettings.identity(1); });
        record("typed-string", function () { return LocalSettings.identity("local"); });
        record("typed-spy", function () { return LocalSettings.identity({ valueOf: function () { rows.push({ id: "unexpected-valueOf", value: [] }); return local; }, toString: function () { rows.push({ id: "unexpected-toString", value: [] }); return "local"; } }); });
        record("setProperty", function () { local.setProperty("nullable", null); return [local.data === data, data.nullable === null, data.hasOwnProperty("nullable")]; });
        record("setProperty-existing", function () { local.setProperty("sound", true); return data.sound; });
        record("setProperty-new", function () { local.setProperty("newValue", 9); return [data.newValue === undefined, data.hasOwnProperty("newValue")]; });
        record("setProperty-existing-null", function () { data.removed = 5; local.setProperty("removed", null); return [data.hasOwnProperty("removed"), data.removed === undefined]; });
        record("setProperty-existing-undefined", function () { data.removed = 5; local.setProperty("removed", undefined); return [data.hasOwnProperty("removed"), data.removed === undefined]; });
        record("setProperty-new-undefined", function () { local.setProperty("absent", undefined); return [data.hasOwnProperty("absent"), data.absent === undefined]; });
        record("setProperty-empty", function () { local.setProperty("", 9); return data.hasOwnProperty(""); });
        record("setProperty-null", function () { local.setProperty(null, 9); return data.hasOwnProperty("null"); });
        record("clear", function () { local.clear(); return [local.data === data, data.hasOwnProperty("hasData"), local.data.hasOwnProperty("hasData"), SharedObject.getLocal(name) === local]; });
        record("rewrite", function () { return LocalSettings.write(name, true, "v2", false); });
        data = local.data;
        data.lastVersion = "unflushed";
        record("close", function () { return local.close(); });
        record("closed-data", function () { return [local.data === data, local.data.lastVersion]; });
        record("reopen", function () { var reopened = SharedObject.getLocal(name); return [reopened === local, reopened.data === data, reopened.data.lastVersion]; });
        record("closed-flush", function () { return local.flush(); });
        record("closed-clear", function () { local.clear(); return local.data.hasOwnProperty("hasData"); });
        local = SharedObject.getLocal(name);
        local.clear();
        return { ready: true, failure: "", observations: rows };
    }
}

globalThis.result=new SharedObjectProbe().snapshot().observations;
const genuine=SharedObject.getLocal('op2-generated-shared-object-controls');let providerGuards=0;
for(const fake of [Object.create(SharedObject.prototype),Object.create(genuine),new Proxy(genuine,{})]){
 let failure;try{LocalSettings.identity(fake);}catch(e){failure=e;}
 if(!failure||failure.name!=='TypeError'||failure.errorID!==1034)throw Error('forged return accepted');providerGuards++;
}
if(providerGuards!==3)throw Error('missing provider controls');
