# Mixed catch predicates in one module

Run `node tests/native-generated-mixed-catch/run.cjs --combined` and `--consumer`.
Both modes compile the complete unchanged AIR subject and compare sixty rows on
ES5/ES2015 in Node/Chromium with zero source/provider type diagnostics.

Error and SecurityError catches in different methods retain distinct helper
aliases. This guards the duplicate import and incorrect catch selection exposed
by maintained UIComponent. Identity and finally replacement/order remain intact.
Seven compiler guards, three comparison controls and forged/proxy checks remain
in place. Multiple sibling catches and public SecurityError constructor/Class
semantics remain unqualified; no complete UIComponent runtime claim is made.
