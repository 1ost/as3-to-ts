const {URLVariables,URLRequest}=api;
const RequestBuilder=load('nativeClass').readNativeClass(load('RequestBuilder').RequestBuilder);
class URLReferencesProbe {
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
        const rows=this.rows,record=this.record.bind(this);
        var vars = new URLVariables(), req = new URLRequest();
        record("defaults", function () { return RequestBuilder.defaults(); });
        record("request-defaults", function () { return [req.url, req.method, req.data, req.contentType, req.requestHeaders.length]; });
        record("vars-identity", function () { return RequestBuilder.variables(vars) === vars; });
        record("request-identity", function () { return RequestBuilder.request(req) === req; });
        record("vars-null", function () { return RequestBuilder.variables(null) === null; });
        record("request-null", function () { return RequestBuilder.request(null) === null; });
        record("vars-undefined", function () { return RequestBuilder.variables(undefined) === null; });
        record("request-undefined", function () { return RequestBuilder.request(undefined) === null; });
        record("vars-object", function () { return RequestBuilder.variables({}); });
        record("request-object", function () { return RequestBuilder.request({}); });
        record("vars-cross", function () { return RequestBuilder.variables(req); });
        record("request-cross", function () { return RequestBuilder.request(vars); });
        record("vars-prototype", function () { return RequestBuilder.variables(URLVariables.prototype); });
        record("request-prototype", function () { return RequestBuilder.request(URLRequest.prototype); });
        record("vars-string", function () { return RequestBuilder.variables("a=1"); });
        record("request-string", function () { return RequestBuilder.request("https://example.invalid/"); });
        record("vars-spy", function () { return RequestBuilder.variables({ valueOf: function () { rows.push({ id: "unexpected-valueOf", value: [] }); return vars; }, toString: function () { rows.push({ id: "unexpected-toString", value: [] }); return "a=1"; } }); });
        record("request-spy", function () { return RequestBuilder.request({ valueOf: function () { rows.push({ id: "unexpected-valueOf", value: [] }); return req; }, toString: function () { rows.push({ id: "unexpected-toString", value: [] }); return "url"; } }); });
        record("build", function () { var built = RequestBuilder.build("https://example.invalid/log", "hello & world\n"); return [built.url, built.method, built.data.log, built.data.toString()]; });
        record("build-null", function () { var built = RequestBuilder.build(null, null); return [built.url, built.data.log, built.data.toString()]; });
        record("decode", function () { var decoded = RequestBuilder.decode("a=1&a=2&space=hello+world&encoded=%E9%BB%91"); return [decoded.a, decoded.space, decoded.encoded]; });
        record("decode-empty", function () { return RequestBuilder.decode("").toString(); });
        record("decode-null", function () { return RequestBuilder.decode(null).toString(); });
        record("decode-key-only", function () { return RequestBuilder.decode("empty").empty; });
        record("decode-empty-value", function () { return RequestBuilder.decode("empty=").empty; });
        record("decode-empty-key", function () { return RequestBuilder.decode("=value")[""]; });
        record("decode-trailing", function () { return RequestBuilder.decode("a=1&").a; });
        record("decode-leading", function () { return RequestBuilder.decode("&a=1").a; });
        record("decode-bad-escape", function () { return RequestBuilder.decode("bad=%ZZ").bad; });
        record("punctuation", function () { var v = new URLVariables(); v.x = "!~'()* +"; return v.toString(); });
        record("decode-partial", function () { var v = new URLVariables(); var failed = []; try {
            v.decode("a=1&bad&b=2");
        }
        catch (e) {
            failed = [e.name, e.errorID];
        } return [v.a, v.hasOwnProperty("bad"), v.hasOwnProperty("b"), failed]; });
        var malformed = ["%", "%A", "%1Z", "%Z1", "%GG", "%0G", "%G0", "%00", "%01", "%20", "%C3%A9", "%E9", "%FF", "%C0%AF", "%E2%82", "%F0%9F%98%80", "a%00b", "%u0041", "%2", "%2G", "%G2", "%0", "%0Z", "%E2%28%A1", "%C3%A9%E9", "%E9%C3%A9", "%F4%90%80%80", "%ED%A0%80", "%FE", "%aF", "%GG%20x", "raw\u9ed1", "%00%20", "%2Gb"];
        for (var encoded of malformed) {
            record("escape-" + encoded, function () { var v = RequestBuilder.decode("x=" + encoded); return v.x; });
        }
        record("decode-extra-equals", function () { return RequestBuilder.decode("x=a=b").x; });
        var codeInputs = ["%00%20", "a%00b", "%00%41", "%00x%20", "%00%00A", "a%00%20b", "%ED%A0%80", "%F4%90%80%80", "%F7%BF%BF%BF", "%C0%80", "raw\u9ed1"];
        for (var codeInput of codeInputs) {
            record("codes-" + codeInput, function () { var decoded = RequestBuilder.decode("x=" + codeInput).x; var codes = []; for (var i = 0; i < decoded.length; i++)
                codes.push(decoded.charCodeAt(i)); return codes; });
        }
        return { ready: true, failure: "", observations: rows };
    }
}

const observations=new URLReferencesProbe().snapshot().observations;
for(const [constructor,coerce] of [[URLVariables,RequestBuilder.variables],[URLRequest,RequestBuilder.request]]){
 const genuine=new constructor();
 for(const forged of [Object.create(constructor.prototype),Object.create(genuine),new Proxy(genuine,{})]){
  let failure;try{coerce(forged);}catch(e){failure=e;}
  if(!failure||failure.name!=='TypeError'||failure.errorID!==1034)throw Error('URL reference forgery accepted');
 }
}
// The AIR host writes JSON through UTF-8: lone UTF-16 surrogates become U+FFFD.
// Preserve actual code units in the separately captured codes-* rows.
function captureUTF8(value){
 if(typeof value==='string')return new TextDecoder().decode(new TextEncoder().encode(value));
 if(Array.isArray(value))return value.map(captureUTF8);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,captureUTF8(v)]));
 return value;
}
globalThis.result=captureUTF8(observations);
