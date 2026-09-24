# Generated anonymous Object returns

Run `node tests/native-generated-anonymous-object-return/run.cjs` after
`npm run tsc`. The complete unchanged `returncases.Functions` source from the
common engine's `anonymous-object-return` AIR packet is emitted through the
production native module factory. All 17 AIR rows must match on ES5/ES2015 in
Node and Chromium, with strict output/provider types and browser CSP disabling
runtime compilation. Engine evidence was committed at `50066befe`.

Object returns use the common property coercion provider: undefined becomes
null, primitive values and references are preserved, and normal fallthrough
returns null. Throw operands bypass return conversion. Existing anonymous
function registration still supplies the declaration global for null receivers.

Six rejection cases retain the boundaries for bare typed returns, other typed
returns, typed parameters, try/catch, receiver properties and missing coercion
authority. Two applied mutations remove explicit-return and fallthrough
coercion; each must change its expected AIR row in each target's native output.
Reports hash source, compiler, provider, emitted module and typecheck inputs.

This does not qualify static initializer retries or the complete OP2 client.
