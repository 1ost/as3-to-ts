# Independent direct-super-method review

Verdict: approve the bounded direct source-super method lowering. No incorrect target selection, receiver rebinding, argument-count behavior, or capture-depth defect was demonstrated. This is not approval of general Class/property/global semantics or complete GreenSock readiness.

Reviewed frozen callable emitter SHA-256: `a0e8026b3094f1ea626f5e2f10967cdfff47a6fc9b0646dd9755a7bc87acfd64`; corresponding source patch and utility changes are recorded by `.local/compiler-super-method/receipt.json`.

## Code review

Source lookup starts from the class containing the super expression's lexical base, walks the exact source ancestry, and rejects source fields/accessors and private/static/inaccessible method targets rather than selecting a deeper public method through an unsupported shadow. The native descriptor lookup uses the same ancestry depth. It captures the unbound descriptor value after resolving the lazy base class and before publishing the derived class; it does not capture the receiver's bound override. Each call supplies the current receiver through the captured intrinsic apply.

Replacing the callee expression, rather than the complete call, permits multiple and nested direct-super calls without overlapping argument edits. The generated wrapper evaluates all actual expressions before Boolean conversion, converts only supplied values, and forwards exactly that count. Explicit undefined becomes false; omitted optional parameters remain omitted and use the source literal default. Missing/extra source call arguments are conservatively rejected, consistent with the candidate's separately retained original Flash compiler diagnostics.

Private/static source declarations and fields/getters shadowing a deeper declaration have four additional isolated compiler rejection checks in `rejections.cjs` / `rejections.json`. These are negative boundary tests only, not positive claims that those source shapes are valid Flash programs.

## Fresh executable Flash evidence

`flash-review` retains original AS3, compiled SWF, capture output, exact commands, and source/tool SHA-256 provenance. The fixture actually executes 30 Flash observations. No rows are omitted or held from this new fixture.

`review.cjs` validates the original provenance, emits the five source classes, and compares all 30 observations with Node and isolated headless Chromium for both ES5 and ES2015. All four comparisons pass with no browser page errors. It archives engine commit `d3db69240e22575d48828ae95b1243bc6e593ed1` into the review directory for the common runtime; it does not use an uncommitted engine runtime. Generated sources, bundles, results, and bundle hashes are in `generated-1`, `generated-2`, and `report.json`.

The independent fixture adds these combined checks:

- Leaf's super call selects Middle.selected, whose own super call selects Base.selected. The live receiver is a Grandchild; Leaf and Grandchild overrides include explicit wrong-target markers, neither observed.
- A protected Base method inherited through Middle is selected at the correct prototype depth.
- Nested calls to the same super method retain evaluation order and separate call arguments.
- Optional true defaults distinguish omitted arguments (count zero) from explicit undefined (false, count one) through both lexical super stages.
- Two separate Grandchild instances retain their own receiver state. Extracting the ordinary `two.run` method and invoking it with `.call(one)` still produces the second receiver's identity throughout its super calls, matching source method-closure binding. This does not exercise or admit detached `super.method` reads.

From the repository root: `node .local/compiler-super-review/review.cjs` and `node .local/compiler-super-review/rejections.cjs`.

## Limits

The candidate's two detached-super rows remain held. This review adds no support for detached/computed/grouped/namespaced super access, private/static/accessor targets, arbitrary signatures, general method-entry/return coercion, or missing native-base authority. The candidate's strict TypeScript evidence remains under its documented TypeScript 2.5 adapted provider declaration and strictNullChecks=false boundary; this review does not claim an additional unadapted strict provider check.

Only `.local/compiler-super-review` was written. Candidate/main source, engine source, and dependency pins were unchanged.
