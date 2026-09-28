# Authenticated Embed planning and generated construction

`node tests/native-generated-embed/run.cjs <native-bootstrap-directory>` reads
the eight unchanged AS3 wrappers retained by the engine's authenticated
`authored-typed-wrappers` Flash packet. It requires a fresh catalog carrying the
matching source SWF hash (engine 100836bb3 or newer), plus the bootstrap source
manifest. The default asset path is the retained OP2 qualification run.

Each source record opts in using `authoredSymbol: {source, linkage, sourceSha256}`.
The planner matches `source` and `linkage` against exactly one public Class's
literal `[Embed(source=..., symbol=...)]` metadata. The explicit asset input
supplies the SWF hash; the compiler does not read or execute SWF ABC. Unsupported
metadata expressions/attributes and reference-only bindings reject. The source
inheritance must reach the generated MovieClip native provider. Without the
binding record, implementation admission continues to reject Embed classes.

Publication emits `requireGeneratedFlashMovieClipSymbol` through that same
provider. The native catalog must bind a matching symbol before any allocation.
No constructor, field, metadata or source-body rewrite is used. Tests resolve
compiler Class handles with the distributed `readNativeClass` helper, then
construct the resulting exact source Classes.

Verified on engine 100836bb3:

- Eight emitted wrappers, zero generated/dependency TypeScript errors.
- Eight Flash construction/typed-field observations exact on both ES5 and ES2015
  output in Chromium, including all three exact nested source constructors.
- Eight unbound allocations reject on each target; correct subsequent catalog
  binding recovers and construction succeeds.
- Eighteen planning guards, including missing binding, hash/source/symbol
  mismatch, duplicate/malformed metadata, reference-only misuse, wrong base,
  configuration getters and source mutation; attribute ordering/quotes admitted.
- Existing declaration planning (26 guards), traits (32 guards / 12 captured
  storage comparisons), and MovieClip projection (105 traits / 25 guards) pass.
- The older generated-declarations emission suite fails its obsolete expected
  rejection of `private static const value:int=1;`. The exact failure reproduces
  with the unchanged 2de51897 declaration planner; this suite is not green.

`evidence/report.json.gz` retains generated source hashes, bundled engine inputs,
both browser result sets and the zero-error type result. Generated source output
is retained alongside it. These results qualify this source family, not OP2
bootstrap input/controller behavior or the complete real game.
