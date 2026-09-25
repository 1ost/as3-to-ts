import { HardenedSemanticError } from "./contracts";
import {assertLoadedSourceMemberAuthority,type LoadedSourceMemberAuthority} from "./source-member-authority";

export const MAPPED_NATIVE_DYNAMIC_LITERAL_READ_AUTHORITY=Object.freeze({
    schema:"as3-mapped-native-dynamic-literal-public-read-authority@1" as const,
    evidenceRevision:"71b52775bec9401b2efb8c5699cf08ca932d58c1" as const,
    nativeEvidenceSha256:"beef636cb1af1d7ae73236802112db3e67516973329924d8b1b0dcbd06dd0f05" as const,
    browserEvidenceSha256:"62a604099c69392f877d407fbbbd5d590a3a1f90102911b700a1131f8d8ae3da" as const,
    browserPinSha256:"d83c205a70215bc8dbe9f76c3c158377aa545f021dfb5e195f4631b46f0a0d72" as const,
    browserRunnerSha256:"1bd4d62e32998fca06435a85de5717145172c38cf921414ec7bb2b36dd97efdf" as const,
    sourceMemberAuthoritySchema:"as3-source-member-authority@2" as const,
    sourceArtifactSha256:"e0f81fdb2029d2bb16e6987c8d85d4eba5eedfa3a23ed6e7f780bf6eb67b0546" as const,
    runtimeObjectDispatchSourcePath:"src/hardened-runtime/AS3ObjectDispatch.ts" as const,
    runtimeObjectDispatchSourceSha256:"e4ce2347b69067c9dd23b7a6d0b95e53b68fa8fd83b0c20ff2f42378938ef289" as const,
    runtimeTypeSourcePath:"src/hardened-runtime/AS3Type.ts" as const,
    runtimeTypeSourceSha256:"02f2acb486155e4718075f749cd45056c39175cb58c6c8aaf001af30b7104f60" as const,
    runtimeTypeRegistrySourcePath:"src/hardened-runtime/internal/AS3TypeRegistry.ts" as const,
    runtimeTypeRegistrySourceSha256:"524fe980ec5afc2573cb6a048efdc1bc6da50274073edd99cb65a09bf642b71d" as const,
    authoritySha256:"fd3d489ce6c58fd08c1f3335aea33b34c66466bf784797e88881e4c3edca550d" as const,
});

export interface MappedNativeDynamicLiteralReadProof {
    readonly schema:"as3-mapped-native-dynamic-literal-public-read@1";
    readonly receiverQName:string;
    readonly propertyName:string;
    readonly targetModule:string;
    readonly targetExport:string;
    readonly sourceMemberAuthoritySchema:typeof MAPPED_NATIVE_DYNAMIC_LITERAL_READ_AUTHORITY.sourceMemberAuthoritySchema;
    readonly sourceArtifactSha256:typeof MAPPED_NATIVE_DYNAMIC_LITERAL_READ_AUTHORITY.sourceArtifactSha256;
    readonly evidenceRevision:typeof MAPPED_NATIVE_DYNAMIC_LITERAL_READ_AUTHORITY.evidenceRevision;
    readonly authoritySha256:typeof MAPPED_NATIVE_DYNAMIC_LITERAL_READ_AUTHORITY.authoritySha256;
}

const QNAME=/^(?:[A-Za-z_$][A-Za-z0-9_$]*\.)*[A-Za-z_$][A-Za-z0-9_$]*$/;
const IDENTIFIER=/^[A-Za-z_$][A-Za-z0-9_$]*$/;
const MODULE=/^(?:@?[A-Za-z0-9_$.-]+\/)*[A-Za-z0-9_$.-]+$/;

export function mappedNativeDynamicLiteralReadProof(source:LoadedSourceMemberAuthority,
    receiverQName:string,propertyName:string,targetModule:string,targetExport:string):MappedNativeDynamicLiteralReadProof {
    assertLoadedSourceMemberAuthority(source);
    const entry=source.entriesByQName[receiverQName];
    if(source.schema!==MAPPED_NATIVE_DYNAMIC_LITERAL_READ_AUTHORITY.sourceMemberAuthoritySchema
        ||source.sourceArtifactSha256!==MAPPED_NATIVE_DYNAMIC_LITERAL_READ_AUTHORITY.sourceArtifactSha256
        ||!entry||entry.qname!==receiverQName||entry.dynamic!==true
        ||!QNAME.test(receiverQName)||!IDENTIFIER.test(propertyName)||!MODULE.test(targetModule)
        ||targetModule.includes("..")||!IDENTIFIER.test(targetExport)) {
        throw new HardenedSemanticError("HARDENED_MAPPED_NATIVE_DYNAMIC_LITERAL_READ_AUTHORITY",
            "mapped native dynamic literal read lacks its exact source, mapping, or dynamic-class authority");
    }
    return Object.freeze({schema:"as3-mapped-native-dynamic-literal-public-read@1" as const,
        receiverQName,propertyName,targetModule,targetExport,
        sourceMemberAuthoritySchema:MAPPED_NATIVE_DYNAMIC_LITERAL_READ_AUTHORITY.sourceMemberAuthoritySchema,
        sourceArtifactSha256:MAPPED_NATIVE_DYNAMIC_LITERAL_READ_AUTHORITY.sourceArtifactSha256,
        evidenceRevision:MAPPED_NATIVE_DYNAMIC_LITERAL_READ_AUTHORITY.evidenceRevision,
        authoritySha256:MAPPED_NATIVE_DYNAMIC_LITERAL_READ_AUTHORITY.authoritySha256});
}

export function assertMappedNativeDynamicLiteralReadProof(value:unknown,receiverQName:string,
    propertyName:string,targetModule:string,targetExport:string):asserts value is MappedNativeDynamicLiteralReadProof {
    const proof=value as Partial<MappedNativeDynamicLiteralReadProof>|null;
    if(!proof||typeof proof!=="object"||Object.getPrototypeOf(proof)!==Object.prototype
        ||Object.keys(proof).sort().join("\0")!==["authoritySha256","evidenceRevision","propertyName","receiverQName",
            "schema","sourceArtifactSha256","sourceMemberAuthoritySchema","targetExport","targetModule"].sort().join("\0")
        ||proof.schema!=="as3-mapped-native-dynamic-literal-public-read@1"
        ||proof.receiverQName!==receiverQName||proof.propertyName!==propertyName
        ||proof.targetModule!==targetModule||proof.targetExport!==targetExport
        ||proof.sourceMemberAuthoritySchema!==MAPPED_NATIVE_DYNAMIC_LITERAL_READ_AUTHORITY.sourceMemberAuthoritySchema
        ||proof.sourceArtifactSha256!==MAPPED_NATIVE_DYNAMIC_LITERAL_READ_AUTHORITY.sourceArtifactSha256
        ||proof.evidenceRevision!==MAPPED_NATIVE_DYNAMIC_LITERAL_READ_AUTHORITY.evidenceRevision
        ||proof.authoritySha256!==MAPPED_NATIVE_DYNAMIC_LITERAL_READ_AUTHORITY.authoritySha256) {
        throw new HardenedSemanticError("HARDENED_MAPPED_NATIVE_DYNAMIC_LITERAL_READ_AUTHORITY",
            "semantic mapped-native dynamic read lacks its exact retained evidence authority");
    }
}
