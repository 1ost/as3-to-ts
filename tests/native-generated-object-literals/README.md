# Source object literal allocation

Run `npm run tsc`, then `node tests/native-generated-object-literals/run.cjs`.
The complete Reader matches nine repeated AIR observations on ES5/ES2015 in
Node and Chromium, with zero generated/provider type diagnostics. The runner
authenticates source/capture bytes and checks three comparison negative controls.

nativeObjectCreationModule now lowers literal objects to the common
as3CreateObjectLiteral helper. Values are evaluated once in source order;
reverse installation preserves AS3's first-key-wins behavior. Numeric and quoted
keys, nested allocation, prototype-named own properties, reference identity,
Object reflection and abrupt completion are exercised. No host-object branding
fallback or application implementation substitute is used.
