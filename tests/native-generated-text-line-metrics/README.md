# Generated TextLineMetrics locals and fields

Run `node tests/native-generated-text-line-metrics/run.cjs` after building.
Both ES5/ES2015 complete factories run under CSP without unsafe-eval in Chromium
with real Laya text initialization. Sixteen observations match repeated AIR:
local coercion/defaults/reassignment, invalid references, native Number fields,
null error #1009, fresh independent TextField metrics, bound reader methods,
unconverted assignment results, and complete captured reflection.

Five compiler guards retain missing reference authority and unsupported
compound/delete/update/call operations. Three runtime checks reject forged and
proxy values and share the native reference across separate source Classes.
A mutated factory replacing shared width reads with raw JS access must fail the
null comparison. Generated/dependency typechecking must report zero diagnostics.

The regression was exposed as raw JavaScript TypeError without errorID for a
null metric read. The compiler now uses the existing common AS3Property path for
six fields on authenticated TextLineMetrics parameters/locals/private fields.
The engine provider owns nominal identity and Number variable dispatch.
Construction/subclass entry and complete TextFieldUtil/game integration remain
open.
