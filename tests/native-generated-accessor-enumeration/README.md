# Generated accessor enumeration

Run `npm run tsc`, then `node tests/native-generated-accessor-enumeration/run.cjs`.
The complete unchanged captured Subject uses the production factory on ES5 and
ES2015, strict generated/provider typechecks, Node and Chromium under CSP.
Eleven AIR rows cover instance/static getter locals, setter locals/parameters,
empty/null maps and retained state. Separate domains and an applied mutation
that skips enumeration bodies are checked. Accessor closures and broader
enumeration target types remain outside this qualification.

Three rejection guards retain missing-local, typed-int and catch-shadow holds.
The unchanged fixture fails before the fix with `for-in target has no source
local ownership`; getter/setter scopes now participate in ownership discovery.
