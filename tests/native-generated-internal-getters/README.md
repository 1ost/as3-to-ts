# Generated internal Boolean getters

Run `node tests/native-generated-internal-getters/run.cjs --combined` and without
`--combined`. Five complete unchanged AIR subject classes are emitted for ES5
and ES2015 and compared with 13 observations in Node and Chromium. The runner
checks authenticated sources and captures, zero type errors, 22 compiler guards
and three negative comparison controls.

The admitted shape is an instance package-internal read-only Boolean getter,
including explicit same-package overrides and distinct cross-package namesakes.
Native symbol descriptors and common lexical capabilities keep it out of public
reflection. Typed same-package access uses exact declaration tokens. Dynamic
reads, writes and deletion retain the caller's package capability.

Internal setters, static getters, other getter return types, super getter access,
getter invocation and typed getter assignments remain held. This fixture does
not qualify complete ZipFile or whole application behavior.
