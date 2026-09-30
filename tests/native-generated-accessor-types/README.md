# Complete generated independent accessor contracts

Engine ed51fdc0c3a740ccc185800fd64ee6b4f46cd1ed supplies the qualified runtime and
immutable original accessor sources. This fixture compiles all four original
Classes plus the namespace declaration. It also compiles AccessorWrites from
the new writes-evidence AIR capture: typed public, namespace, inherited, static
and setter-first assignments, integer storage coercion and raw assignment result.

All 41 observations match original AIR in Node and Chromium for ES5 and ES2015
under self-only script CSP. Thirty-one come from the original accessor evidence;
the unrelated Class.prototype reflection row remains excluded. Ten more come
from two identical WIN 51,3,4,2 captures retained in writes-evidence, with source,
SDK/tool receipt, SWF, host, logs, screenshots and structured observations.

The class bodies, constructors, static methods and super calls are compiled from
those exact AS3 bytes. Host observations replace AIR capture plumbing, including
reflection enumeration; the original Probe classes are retained but not compiled.

Twelve rejection guards cover declaration authority, namespaces, duplicate halves,
incompatible typed pairs and exact getter/setter override contracts. Two applied
controls remove emitted wildcard setter contracts and coerce the numeric
assignment result prematurely. Each produces a complete but different 41-row
trace in both runtimes. Typechecking also covers an object-valued public write.

Reflection and trait read types come from the getter regardless of declaration
order. Each inherited half retains its own type. A distinct setterType is emitted
only when one half is wildcard. The TypeScript 2.5 structural property uses any
for these pairs because that version cannot describe separate read/write types;
the common runtime still enforces each exact AS3 contract. Existing assignment
lowering already preserves the original RHS, including fractional and wrapping
values sent to an int setter. Literal-only namespace metadata now has an explicit
record type to avoid inferring an implicit any for its absent alias.

Run from the compiler worktree:

```powershell
node node_modules/typescript/bin/tsc --pretty false
node tests/native-generated-accessor-types/run.cjs
node tests/native-generated-accessor-types/verify-runtime.cjs --check-current
```

Original additional capture command (use a new output directory):

```powershell
& '../codex-c3/.venv/Scripts/python.exe' ../LayaAir-op2-namespace-traits-review/scripts/nativeFlashOracle.py --air-sdk C:/Users/admin/Desktop/AIRSDK/AIRSDK_51.3.4 --source tests/native-generated-accessor-types/writes-evidence/source --entry AccessorWritesProbe --output <new-evidence-directory>
```

Namespace, public accessor override, Proxy, MouseEvent and Sprite position
regressions pass. This does not qualify the full OP2 client, arbitrary native
accessor families or H5 startup; refresh consumer integration at these pins next.
