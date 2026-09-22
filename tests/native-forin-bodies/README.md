# For-in body ownership

Run `npm run test:native-forin-bodies` after building the compiler. The test uses
the sibling LayaAir checkout and OP2's Playwright installation (or
`PLAYWRIGHT_MODULE`) and retains output under `.cache/native-forin-bodies`.

The parser previously returned immediately after the `for...in` header, leaving
the body as a sibling statement. The emitter's typed header declaration also
escaped unbraced conditionals and intercepted loop labels. The parser now owns
the body; emission wraps the header declaration and loop together and attaches
the label to the loop itself. Header variables remain function-scoped `var`.

The authenticated original AIR `ReferenceHeaderProbe` must have its key loop's
body in the actual AST. Ten independent control-flow regressions execute with
the real distributed decorators in Node and Chromium for ES5/ES2015 output:
braced and untyped headers, existing bindings, unbraced conditionals, labelled
break/continue, nested loops, dangling else and an empty loop body.
Three further cases execute against the actual common Dictionary/property
providers: an object key retains identity, and empty/null iteration stays empty.
The ES5 build enables TypeScript's `downlevelIteration` because the common key
provider returns an iterator, not an array.

These checks establish syntax/control-flow ownership, not reference key coercion
or Dictionary ordering. The reference enumeration packet's 24 native AIR rows
remain the separate target for the compiler's reference-consumer path. Existing
`tests/native-foreach-receivers/run.cjs` covers the shared closing-statement logic
against retained Flash receiver and control-flow evidence.
