# Ordinary consumers of generated static methods

Run `node tests/native-consumer-static-calls/run.cjs --combined`.
The exact four authored AIR subjects produce fifteen retained observations in
Node/Chromium on ES5/ES2015 with zero type diagnostics. Consumer deliberately
stays outside the generated declaration plan; Service, Trace and Retry use the
common registrar. Eight guards reject unsupported Class uses. Three comparison
controls reject changed observation sequences.

This proves own public static direct calls preserve lazy Class initialization
before argument evaluation, typed entry coercion, repeated calls, source identity,
null/undefined, thrown values, parameter shadowing and initializer retries.
Private static int call initializers observe zero until the call finishes.
Static properties, extraction, inherited dispatch and reserved Function Class
member names remain outside this admission. Full application integration is not
claimed. The source/capture packet lives in the pinned engine checkout under
`tests/nativeFlashOracle/consumer-static-calls`.
