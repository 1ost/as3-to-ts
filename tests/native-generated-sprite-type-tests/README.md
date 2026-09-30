# Source Sprite type tests

The generated reference guard and emission path now admit imported Sprite is/as operations under the existing explicit canonical DisplayObject reference opt-in. They use common as3Is/as3As nominal display proofs, as Sprite return coercion already does. No runtime provider or OP2-local shim is added. Shadowed Class operands, operations in class field initializers and missing provider authority remain held.

Two matching AIR WIN 51,3,4,2 captures authenticate eight observations. The complete cases.SpriteTests Class is compiled unchanged for ES5/ES2015; the generated factories match in Node and Chromium under CSP script-src self with zero generated/provider type errors. Cases cover Sprite and MovieClip identity, rejection of Shape, nullish and primitive values, Class/object rejection, and one evaluation of an effectful receiver expression. Four compiler guards and four nominal/domain checks pass per target. An applied factory mutation replaces the is operation with JavaScript instanceof: it builds successfully, then both runtimes reject the forged Sprite exactly at the named guard. The existing 16-row Sprite return suite also passes at these compiler sources.

    node node_modules/typescript/bin/tsc --pretty false
    node tests/native-generated-sprite-type-tests/run.cjs
    node tests/native-generated-sprite-type-tests/verify-runtime.cjs --check-current

Set LAYA_ENGINE_REPOSITORY to ../LayaAir-op2-literal-replace-review at d17b928f57bdf79f2825295409682662e789ae20. The observer uses the existing engine NoRender test host with real native display constructors. It does not qualify rendering or actual H5 startup/account behavior.
