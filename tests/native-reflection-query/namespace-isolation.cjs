const assert = require('assert');
const parse = require('../../lib/parse');
const emit = require('../../lib/emit');
const {createNativeSourceAncestryPlan} = require('../../lib');
const source = `package query {
 import flash.utils.describeType;
 public class Query {
  public function read(value:Class):int {
   return describeType(value).factory.method.(@name == "uncompress").parameter.length();
  }
 }
}`;
const namespace = 'package other { public namespace n = "urn:unrelated"; }';
const unrelated = 'package other { public class Other { n var field:int = 1; } }';
const plan = createNativeSourceAncestryPlan({sources:{
  'other.n':{source:namespace},'other.Other':{source:unrelated}
}});
const options = {lineSeparator:'\n',customVisitors:[],namespaceUris:{'other.n':'urn:unrelated'},
  nativeReflectionQueryModule:'./AS3ReflectionQuery'};
const generate = (text, extra={}) => emit(parse('Query.as',text),text,{...options,...extra});
const expected = generate(source);
assert.match(expected, /as3DescribeTypeQueryLength/);
assert.doesNotMatch(expected, /@name/);
for(const extra of [{nativeSourceAncestry:plan},{nativeProxyModule:'./Proxy'},
  {nativeSourceAncestry:plan,nativeProxyModule:'./Proxy'}]){
  assert.strictEqual(generate(source,extra),expected,'unrelated namespace providers must not change this query');
  assert.throws(()=>generate(source.replace('@name == "uncompress"','@name == choose()'),extra), /AS3_REFLECTION_QUERY_UNSUPPORTED/);
}
for(const declaration of ['public namespace own = "urn:own";', 'other.n var field:int = 1;']){
  const text=declaration.startsWith('public namespace')
    ? source.replace('public class Query',declaration+' public class Query')
    : source.replace('public class Query {','public class Query { '+declaration.replace('other.n','n'))
      .replace('import flash.utils.describeType;','import flash.utils.describeType; import other.n;');
  assert.throws(()=>generate(text,{nativeSourceAncestry:plan,nativeProxyModule:'./Proxy'}), /E4X requires separate lowering/);
}
assert.throws(()=>generate(source.replace('public class Query','use namespace n; public class Query')
  .replace('import flash.utils.describeType;','import flash.utils.describeType; import other.n;'),
  {nativeSourceAncestry:plan}), /E4X requires separate lowering/);
assert.throws(()=>generate(source.replace('public class Query','public class Query extends Other')
  .replace('import flash.utils.describeType;','import flash.utils.describeType; import other.Other;'),
  {nativeSourceAncestry:plan}), /E4X requires separate lowering/);
console.log('Reflection query emission is unchanged by unrelated ancestry/Proxy namespaces; malformed queries and source namespace/E4X combinations remain held.');
