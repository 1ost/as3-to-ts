import {createHash} from "node:crypto";
import {ByteArrayNativeTarget,HardenedSemanticError} from "./contracts";
import {verifySharedProviderTarget} from "./reflection-provider-authority";
import {assertByteArrayReadObjectSource,assertByteArrayWriteObjectSource} from "./bytearray-native-authority";

export interface ByteArrayAMF3Target { readonly module: string; readonly writerModule: string; }
const MODULE="src/layaAir/flash/utils/AMF3Reader.ts";
const WRITER_MODULE="src/layaAir/flash/utils/AMF3Writer.ts";
const TARGETS=[{module:MODULE,export:"readSourceAMF3",
    signature:"(bytes: Uint8Array, position: number, createByteArray: (bytes: Uint8Array) => unknown, commitPosition: (position: number) => void) => unknown"},
{module:WRITER_MODULE,export:"writeSourceAMF3",
    signature:"(value: unknown, readByteArray: (value: unknown) => Uint8Array | null) => Uint8Array"}];
const verified=new WeakMap<object,{targetHash:string;native:ByteArrayNativeTarget}>();
const hash=(text:string):string=>createHash("sha256").update(text).digest("hex");
function fail(message:string):never {throw new HardenedSemanticError("HARDENED_BYTEARRAY_AMF3_AUTHORITY",message);}
export function loadByteArrayAMF3Target(proof:string,targetPath:string,targetJson:string,
    native:ByteArrayNativeTarget|undefined):ByteArrayAMF3Target {
    if (!native) return fail("ByteArray AMF3 requires verified native ByteArray SDK authority");
    try {
        assertByteArrayReadObjectSource(native,targetJson);
        assertByteArrayWriteObjectSource(native,targetJson);
        verifySharedProviderTarget(proof,targetPath,targetJson,"as3-bytearray-amf3-target@1",TARGETS);
    } catch(error) {return fail("ByteArray AMF3 provider: "+(error instanceof Error?error.message:String(error)));}
    const target=Object.freeze({module:MODULE,writerModule:WRITER_MODULE});verified.set(target,{targetHash:hash(targetJson),native});return target;
}
export function assertByteArrayAMF3Target(target:ByteArrayAMF3Target,targetJson:string,
    native:ByteArrayNativeTarget|undefined):void {
    const proof=target&&verified.get(target);
    if (!proof || proof.targetHash!==hash(targetJson) || !native || proof.native!==native)
        return fail("ByteArray AMF3 requires its verified source and target pair");
    assertByteArrayReadObjectSource(native,targetJson);
    assertByteArrayWriteObjectSource(native,targetJson);
}
