# Generated TweenMax migration locals

Run `npm run tsc -- --pretty false` and
`node tests/native-generated-tween-handles/run.cjs` with the sibling engine.

The explicit declaration input `tweenHandleProviderModule` admits method-local
`com.greensock.TweenMax` storage separately from source reference/Class tokens.
The emitter requires the same `nativeTweenModule` and typed-local lowering.
The existing storage pass retains hoisted null defaults, coerces initialization
and writes before publishing a new value, and returns the raw RHS from an
assignment expression. The generated declaration module imports the shared
coercion function; no native TweenMax Class is declared or bound.

The complete unchanged `TweenHandleStorageProbe.as` from the shared oracle packet
runs through source-class factories under CSP in Chromium and in Node, for
ES5/ES2015. Nineteen repeated browser Flash observations cover accepted/rejected
values, identity, default null, failed writes, raw assignment results, mixed
queries and WindowLayer's typed query/kill loop. Generated/dependency types
pass. Thirteen guards retain explicit provider authority and hold fields,
parameters, returns, Lite locals, namesakes, compound writes and Class values.
Removing the coercion export must break Lite rejection in both targets.
The two builtin Error catch annotations use the separate error provider rather
than being relabelled as planned Class references.

The original seventeen-row probe used typed TypeError catches, which remain an
existing compiler hold. The retained companion uses Error catches and adds two
loop observations; its first seventeen rows must equal the original. This test
does not qualify TypeError catches, arbitrary GreenSock methods, typed foreach
locals, parameters/returns/fields, reflection, complete WindowLayer or game flows.
