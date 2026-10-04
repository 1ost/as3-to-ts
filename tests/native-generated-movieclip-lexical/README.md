# MovieClip receivers with lexical namesakes

ScrollBar's maintained `display.downArrow` fails because `display` is an inherited
MovieClip getter and `downArrow` is also a protected field of the caller. The
compiler now resolves the getter's authenticated declaration span and uses public
MovieClip dynamic-property dispatch. The caller's protected capability stays
separate. Computed accesses on qualified MovieClip locals also use the common
property store; raw JavaScript writes were invisible to those Flash reads.

The complete three-class fixture has eight identical AIR observations from two
captures. They cover implicit/explicit inherited getter reads, a typed local,
dynamic replacement, missing properties, null errors, restoration, single getter
evaluation and protected-field isolation. Both complete generated targets pass
in CSP Chromium with real Laya initialization and zero type errors. This graphics
fixture does not claim Node runtime coverage. Two applied emitted mutations
duplicate getter evaluation or corrupt dynamic storage and fail expected rows.

Six guards retain explicit MovieClip provider/reference/import requirements and
reject namesake dot writes/calls outside the qualified read case. Adjacent chained
references and static getter receivers pass 24 AIR rows in Node and Chromium.
The old compiler 3b77842 rejects the unchanged fixture on both targets.

Build with `npm run tsc`, then run this folder's `run.cjs` and `baseline.cjs`.
Use `retain.cjs` with the runtime, chained-references and static-getter-receiver
report paths to retain a packet; capture baseline stdout as UTF-16 `baseline.log`.
`verify.cjs` checks original oracle bytes; `verify-runtime.cjs --check-current`
checks saved results and current source/provider inputs. Engine is pinned by
engine.json. Full ScrollBar control behavior and H5/account acceptance remain
separate work. No engine implementation or font behavior was changed.
