import { HardenedSemanticError } from "./contracts";
import {assertLoadedSourceMemberAuthority,type LoadedSourceMemberAuthority,
    type SourceMemberAuthorityEntry} from "./source-member-authority";

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
    runtimeObjectDispatchSourceSha256:"01e8faaf81e92c138ff8d5028c9ebd65c4509690731d59c08cddd2baa98a77ab" as const,
    runtimeTypeSourcePath:"src/hardened-runtime/AS3Type.ts" as const,
    runtimeTypeSourceSha256:"02f2acb486155e4718075f749cd45056c39175cb58c6c8aaf001af30b7104f60" as const,
    runtimeTypeRegistrySourcePath:"src/hardened-runtime/internal/AS3TypeRegistry.ts" as const,
    runtimeTypeRegistrySourceSha256:"524fe980ec5afc2573cb6a048efdc1bc6da50274073edd99cb65a09bf642b71d" as const,
    authoritySha256:"8ed3ef1855edb429053c870e25a29996644ac83a19230d7bf90ea7088c2b91cc" as const,
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
    const visited=new Set<string>();
    let current:string|null=receiverQName;
    while(current!==null) {
        if(visited.has(current)||visited.size>=1024) throw new HardenedSemanticError(
            "HARDENED_MAPPED_NATIVE_DYNAMIC_LITERAL_READ_AUTHORITY",
            "mapped native dynamic literal read has cyclic or excessive source ancestry");
        visited.add(current);
        const ancestor:SourceMemberAuthorityEntry|undefined=source.entriesByQName[current];
        if(!ancestor) throw new HardenedSemanticError("HARDENED_MAPPED_NATIVE_DYNAMIC_LITERAL_READ_AUTHORITY",
            "mapped native dynamic literal read has incomplete source ancestry");
        if(ancestor.ownInstanceMemberNames.includes(propertyName)) throw new HardenedSemanticError(
            "HARDENED_MAPPED_NATIVE_DYNAMIC_LITERAL_READ_AUTHORITY",
            "mapped native dynamic literal read collides with an authenticated native member");
        current=ancestor.baseQName;
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

/** A sealed DisplayObject base can expose a public trait on its runtime subtype. */
export const MAPPED_NATIVE_DISPLAY_LITERAL_READ_AUTHORITY=Object.freeze({
    schema:"as3-mapped-native-display-literal-public-read-authority@1" as const,
    evidenceRevision:"816c2fda1801103b18bba093fbd014d7d9b9b3c3" as const,
    nativeEvidenceSha256:"47494e93eb23d4fd5bd2c399fa26f93d96383857c126edb9dea21d5cbbeacdb3" as const,
    sourceMemberAuthoritySchema:"as3-source-member-authority@2" as const,
    sourceArtifactSha256:MAPPED_NATIVE_DYNAMIC_LITERAL_READ_AUTHORITY.sourceArtifactSha256,
    receiverQName:"flash.display.DisplayObject" as const,
    targetModule:"laya/flash/display/DisplayObject" as const,
    targetExport:"DisplayObject" as const,
    runtimeObjectDispatchSourceSha256:MAPPED_NATIVE_DYNAMIC_LITERAL_READ_AUTHORITY.runtimeObjectDispatchSourceSha256,
    runtimeTypeSourceSha256:MAPPED_NATIVE_DYNAMIC_LITERAL_READ_AUTHORITY.runtimeTypeSourceSha256,
    runtimeTypeRegistrySourceSha256:MAPPED_NATIVE_DYNAMIC_LITERAL_READ_AUTHORITY.runtimeTypeRegistrySourceSha256,
});

export interface MappedNativeDisplayLiteralReadProof {
    readonly schema:"as3-mapped-native-display-literal-public-read@1";
    readonly receiverQName:typeof MAPPED_NATIVE_DISPLAY_LITERAL_READ_AUTHORITY.receiverQName;
    readonly propertyName:string;
    readonly targetModule:typeof MAPPED_NATIVE_DISPLAY_LITERAL_READ_AUTHORITY.targetModule;
    readonly targetExport:typeof MAPPED_NATIVE_DISPLAY_LITERAL_READ_AUTHORITY.targetExport;
    readonly sourceArtifactSha256:typeof MAPPED_NATIVE_DISPLAY_LITERAL_READ_AUTHORITY.sourceArtifactSha256;
    readonly evidenceRevision:typeof MAPPED_NATIVE_DISPLAY_LITERAL_READ_AUTHORITY.evidenceRevision;
}

export function mappedNativeDisplayLiteralReadProof(source:LoadedSourceMemberAuthority,
    receiverQName:string,propertyName:string,targetModule:string,targetExport:string):MappedNativeDisplayLiteralReadProof {
    assertLoadedSourceMemberAuthority(source);
    const authority=MAPPED_NATIVE_DISPLAY_LITERAL_READ_AUTHORITY;
    const entry=source.entriesByQName[receiverQName];
    if(source.schema!==authority.sourceMemberAuthoritySchema
        ||source.sourceArtifactSha256!==authority.sourceArtifactSha256
        ||receiverQName!==authority.receiverQName||entry?.qname!==receiverQName||entry.dynamic!==false
        ||targetModule!==authority.targetModule||targetExport!==authority.targetExport
        ||!IDENTIFIER.test(propertyName))
        throw new HardenedSemanticError("HARDENED_MAPPED_NATIVE_DISPLAY_LITERAL_READ_AUTHORITY",
            "sealed DisplayObject literal read lacks exact AIR source or Laya mapping authority");
    const visited=new Set<string>();
    let current:string|null=receiverQName;
    while(current!==null) {
        if(visited.has(current)||visited.size>=1024)
            throw new HardenedSemanticError("HARDENED_MAPPED_NATIVE_DISPLAY_LITERAL_READ_AUTHORITY",
                "sealed DisplayObject source ancestry is cyclic or excessive");
        visited.add(current);
        const ancestor:SourceMemberAuthorityEntry|undefined=source.entriesByQName[current];
        if(!ancestor||ancestor.ownInstanceMemberNames.includes(propertyName))
            throw new HardenedSemanticError("HARDENED_MAPPED_NATIVE_DISPLAY_LITERAL_READ_AUTHORITY",
                "sealed DisplayObject key collides with a native trait or lacks complete ancestry");
        current=ancestor.baseQName;
    }
    return Object.freeze({schema:"as3-mapped-native-display-literal-public-read@1" as const,
        receiverQName:authority.receiverQName,propertyName,targetModule:authority.targetModule,
        targetExport:authority.targetExport,sourceArtifactSha256:authority.sourceArtifactSha256,
        evidenceRevision:authority.evidenceRevision});
}

export function assertMappedNativeDisplayLiteralReadProof(value:unknown,receiverQName:string,
    propertyName:string,targetModule:string,targetExport:string):asserts value is MappedNativeDisplayLiteralReadProof {
    const proof=value as Partial<MappedNativeDisplayLiteralReadProof>|null;
    const authority=MAPPED_NATIVE_DISPLAY_LITERAL_READ_AUTHORITY;
    if(!proof||typeof proof!=="object"||Object.getPrototypeOf(proof)!==Object.prototype
        ||Object.keys(proof).sort().join("\0")!==["schema","receiverQName","propertyName","targetModule",
            "targetExport","sourceArtifactSha256","evidenceRevision"].sort().join("\0")
        ||proof.schema!=="as3-mapped-native-display-literal-public-read@1"
        ||proof.receiverQName!==authority.receiverQName||proof.receiverQName!==receiverQName
        ||proof.propertyName!==propertyName||proof.targetModule!==authority.targetModule
        ||proof.targetModule!==targetModule||proof.targetExport!==authority.targetExport
        ||proof.targetExport!==targetExport||proof.sourceArtifactSha256!==authority.sourceArtifactSha256
        ||proof.evidenceRevision!==authority.evidenceRevision)
        throw new HardenedSemanticError("HARDENED_MAPPED_NATIVE_DISPLAY_LITERAL_READ_AUTHORITY",
            "semantic sealed DisplayObject read lacks its retained AIR evidence authority");
}
