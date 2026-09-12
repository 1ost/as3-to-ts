# Upstream provenance and third-party notices

This local-only parser frontend is derived from `@as3web/as3-to-ts` 0.3.10 at
revision `fa0b5151ab82758511ddd4b464f0c05b80e06da7`:
<https://github.com/as3web/as3-to-ts.git>.

Only the parser and syntax-model portion of that upstream project is included
in the production bundles. The legacy emitter, visitors, wrappers, and command
implementation are not included.

## Adobe parser code

Copyright (c) 2009, Adobe Systems, Incorporated. All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

- Redistributions of source code must retain the above copyright notice,
  this list of conditions and the following disclaimer.
- Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.
- Neither the name of Adobe Systems, Incorporated nor the names of its
  contributors may be used to endorse or promote products derived from this
  software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.

## sax

The bundled parser uses sax 1.6.1 under the Blue Oak Model License 1.0.0.

### Purpose

This license gives everyone as much permission to work with this software as
possible, while protecting contributors from liability.

### Acceptance

In order to receive this license, you must agree to its rules. The rules of
this license are both obligations under that agreement and conditions to your
license. You must not do anything with this software that triggers a rule that
you cannot or will not follow.

### Copyright

Each contributor licenses you to do everything with this software that would
otherwise infringe that contributor's copyright in it.

### Notices

You must ensure that everyone who gets a copy of any part of this software
from you, with or without changes, also gets the text of this license or a link
to <https://blueoakcouncil.org/license/1.0.0>.

### Excuse

If anyone notifies you in writing that you have not complied with Notices, you
can keep your license by taking all practical steps to comply within 30 days
after the notice. If you do not do so, your license ends immediately.

### Patent

Each contributor licenses you to do everything with this software that would
otherwise infringe any patent claims they can license or become able to
license.

### Reliability

No contributor can revoke this license.

### No Liability

As far as the law allows, this software comes as is, without any warranty or
condition, and no contributor will be liable to anyone for any damages related
to this software or this license, under any kind of legal claim.

## object-assign

The bundled parser uses object-assign 4.1.1 under the MIT License.

Copyright (c) Sindre Sorhus <sindresorhus@gmail.com>
(sindresorhus.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


## AVMplus decimal conversion

`src/hardened-runtime/internal/AS3NumberFormat.ts` adapts the fixed-precision
digit generator and decimal magnitude conversion from Adobe AVMplus
`core/d2a.cpp`, `core/MathUtils.cpp`, `core/BigInteger.cpp` and the macOS frexp convention in
`platform/unix/MathUtilsUnix-inlines.h`, at revision `858d034a3bd3a54d9b70909386435cf4aec81d21`.

Those sources and the adapted file are licensed under Mozilla Public License
2.0. The adapted file carries the MPL notice and is distributed as source with
the runtime. Obtain the license at <https://mozilla.org/MPL/2.0/> and the original
sources at <https://github.com/adobe/avmplus/tree/858d034a3bd3a54d9b70909386435cf4aec81d21>.
The rest of this frontend retains its existing licensing.

`src/hardened-runtime/internal/AS3ParseInteger.ts` also adapts the lexical scanner
and power-of-two radix rounding from `core/MathUtils.cpp` in Adobe AVMplus under
MPL-2.0. Its macOS AIR 51 fused accumulation and widened float NaN payload are
checked against retained native AIR captures.
