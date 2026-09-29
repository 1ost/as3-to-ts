import { HardenedSemanticError } from "./contracts";
import {assertLoadedSourceMemberAuthority,type LoadedSourceMemberAuthority,
    type SourceMemberAuthorityEntry} from "./source-member-authority";

export const MAPPED_NATIVE_DYNAMIC_LITERAL_TARGET_AUTHORITY=Object.freeze({
    schema:"as3-mapped-native-dynamic-literal-public-target-authority@1" as const,
    movieClipEvidenceRevision:"71b52775bec9401b2efb8c5699cf08ca932d58c1" as const,
    movieClipNativeEvidenceSha256:"beef636cb1af1d7ae73236802112db3e67516973329924d8b1b0dcbd06dd0f05" as const,
    movieClipBrowserEvidenceSha256:"62a604099c69392f877d407fbbbd5d590a3a1f90102911b700a1131f8d8ae3da" as const,
    fixedCallEvidenceRevision:"009ae4376e2c8168d7e7e5631f2f026b7e408a8d" as const,
    fixedCallSourceSha256:"3c09526118191227a18d7384b988c5ddf4856d0e3ada620f9681847bc8a9bc4c" as const,
    fixedCallNativeEvidenceSha256:"de66c1be49e792d8fb25df0026cebd5cbfafa6beecb0229538183248d111e4f3" as const,
    fixedCallComparisonSha256:"6fdc1b586fad14358494c5d0ebdcfe73976023ee3bbc5819fea8991f144e2b7c" as const,
    fixedCallScenarioSha256:"cf7d63e71625886cb4c4a5223d6534b93f34d546479013a180782438010433e0" as const,
    mutationEvidenceRevision:"37e8e3fff8287c1e96f173ea04cf52f4497aeebd" as const,
    mutationEvidencePinSha256:"5b8d3276717885ec63a5576d508b914f0e3b952b356c6f2d088ab1ff744f44a3" as const,
    mutationReceiptSha256:"5303e47f8d32fd7cc33b3dc48a2f8a39b72af5b486af74175f144853a747f955" as const,
    mutationProbeSha256:"81113d93afb45077f4287bd4e9298729a9b3a17b81e134723f104c3de89ef9c7" as const,
    mutationMutatorSha256:"07b098afce2faedf34f063853b7e4492013fcb75d303a2958eee3e4a86110b2c" as const,
    mutationSlotSha256:"bfd8646547f3927710bcad18ecee8ad1f4aa46abf559cf53b6c78d150eed2cf8" as const,
    sourceMemberAuthoritySchema:"as3-source-member-authority@2" as const,
    sourceArtifactSha256:"e0f81fdb2029d2bb16e6987c8d85d4eba5eedfa3a23ed6e7f780bf6eb67b0546" as const,
    runtimeObjectDispatchSourcePath:"src/hardened-runtime/AS3ObjectDispatch.ts" as const,
    runtimeObjectDispatchSourceSha256:"01e8faaf81e92c138ff8d5028c9ebd65c4509690731d59c08cddd2baa98a77ab" as const,
    runtimeTypeSourcePath:"src/hardened-runtime/AS3Type.ts" as const,
    runtimeTypeSourceSha256:"02f2acb486155e4718075f749cd45056c39175cb58c6c8aaf001af30b7104f60" as const,
    runtimeTypeRegistrySourcePath:"src/hardened-runtime/internal/AS3TypeRegistry.ts" as const,
    runtimeTypeRegistrySourceSha256:"524fe980ec5afc2573cb6a048efdc1bc6da50274073edd99cb65a09bf642b71d" as const,
    authoritySha256:"248130bee69312b6285a41a29da50d097a5abb3b23f43ece4ba5fcc5a30f0801" as const,
});

export interface MappedNativeDynamicLiteralTargetProof {
    readonly schema:"as3-mapped-native-dynamic-literal-public-target@1";
    readonly receiverQName:string;
    readonly propertyName:string;
    readonly targetModule:string;
    readonly targetExport:string;
    readonly sourceMemberAuthoritySchema:typeof MAPPED_NATIVE_DYNAMIC_LITERAL_TARGET_AUTHORITY.sourceMemberAuthoritySchema;
    readonly sourceArtifactSha256:typeof MAPPED_NATIVE_DYNAMIC_LITERAL_TARGET_AUTHORITY.sourceArtifactSha256;
    readonly movieClipEvidenceRevision:typeof MAPPED_NATIVE_DYNAMIC_LITERAL_TARGET_AUTHORITY.movieClipEvidenceRevision;
    readonly fixedCallEvidenceRevision:typeof MAPPED_NATIVE_DYNAMIC_LITERAL_TARGET_AUTHORITY.fixedCallEvidenceRevision;
    readonly mutationEvidenceRevision:typeof MAPPED_NATIVE_DYNAMIC_LITERAL_TARGET_AUTHORITY.mutationEvidenceRevision;
    readonly authoritySha256:typeof MAPPED_NATIVE_DYNAMIC_LITERAL_TARGET_AUTHORITY.authoritySha256;
}

const QNAME=/^(?:[A-Za-z_$][A-Za-z0-9_$]*\.)*[A-Za-z_$][A-Za-z0-9_$]*$/;
const IDENTIFIER=/^[A-Za-z_$][A-Za-z0-9_$]*$/;
const MODULE=/^(?:@?[A-Za-z0-9_$.-]+\/)*[A-Za-z0-9_$.-]+$/;

function assertDynamicPublicTarget(source:LoadedSourceMemberAuthority,receiverQName:string,propertyName:string):void {
    const receiver=source.entriesByQName[receiverQName];
    if(!receiver||receiver.dynamic!==true) throw new HardenedSemanticError(
        "HARDENED_MAPPED_NATIVE_DYNAMIC_LITERAL_TARGET_AUTHORITY",
        "mapped native dynamic target requires an exact dynamic-class source authority");
    const visited=new Set<string>();
    let current:string|null=receiverQName;
    while(current!==null) {
        if(visited.has(current)||visited.size>=1024) throw new HardenedSemanticError(
            "HARDENED_MAPPED_NATIVE_DYNAMIC_LITERAL_TARGET_AUTHORITY",
            "mapped native dynamic target has cyclic or excessive source ancestry");
        visited.add(current);
        const entry:SourceMemberAuthorityEntry|undefined=source.entriesByQName[current];
        if(!entry) throw new HardenedSemanticError("HARDENED_MAPPED_NATIVE_DYNAMIC_LITERAL_TARGET_AUTHORITY",
            "mapped native dynamic target has incomplete source ancestry");
        if(entry.ownInstanceMemberNames.includes(propertyName)) throw new HardenedSemanticError(
            "HARDENED_MAPPED_NATIVE_DYNAMIC_LITERAL_TARGET_AUTHORITY",
            "mapped native dynamic target collides with an authenticated native member");
        current=entry.baseQName;
    }
}

export function mappedNativeDynamicLiteralTargetProof(source:LoadedSourceMemberAuthority,
    receiverQName:string,propertyName:string,targetModule:string,targetExport:string):MappedNativeDynamicLiteralTargetProof {
    assertLoadedSourceMemberAuthority(source);
    if(source.schema!==MAPPED_NATIVE_DYNAMIC_LITERAL_TARGET_AUTHORITY.sourceMemberAuthoritySchema
        ||source.sourceArtifactSha256!==MAPPED_NATIVE_DYNAMIC_LITERAL_TARGET_AUTHORITY.sourceArtifactSha256
        ||!QNAME.test(receiverQName)||!IDENTIFIER.test(propertyName)||!MODULE.test(targetModule)
        ||targetModule.includes("..")||!IDENTIFIER.test(targetExport)) {
        throw new HardenedSemanticError("HARDENED_MAPPED_NATIVE_DYNAMIC_LITERAL_TARGET_AUTHORITY",
            "mapped native dynamic literal target lacks its exact source or mapping authority");
    }
    assertDynamicPublicTarget(source,receiverQName,propertyName);
    return Object.freeze({schema:"as3-mapped-native-dynamic-literal-public-target@1" as const,
        receiverQName,propertyName,targetModule,targetExport,
        sourceMemberAuthoritySchema:MAPPED_NATIVE_DYNAMIC_LITERAL_TARGET_AUTHORITY.sourceMemberAuthoritySchema,
        sourceArtifactSha256:MAPPED_NATIVE_DYNAMIC_LITERAL_TARGET_AUTHORITY.sourceArtifactSha256,
        movieClipEvidenceRevision:MAPPED_NATIVE_DYNAMIC_LITERAL_TARGET_AUTHORITY.movieClipEvidenceRevision,
        fixedCallEvidenceRevision:MAPPED_NATIVE_DYNAMIC_LITERAL_TARGET_AUTHORITY.fixedCallEvidenceRevision,
        mutationEvidenceRevision:MAPPED_NATIVE_DYNAMIC_LITERAL_TARGET_AUTHORITY.mutationEvidenceRevision,
        authoritySha256:MAPPED_NATIVE_DYNAMIC_LITERAL_TARGET_AUTHORITY.authoritySha256});
}

export function assertMappedNativeDynamicLiteralTargetProof(value:unknown,receiverQName:string,
    propertyName:string,targetModule:string,targetExport:string):asserts value is MappedNativeDynamicLiteralTargetProof {
    const proof=value as Partial<MappedNativeDynamicLiteralTargetProof>|null;
    if(!proof||typeof proof!=="object"||Object.getPrototypeOf(proof)!==Object.prototype
        ||Object.keys(proof).sort().join("\0")!==["authoritySha256","fixedCallEvidenceRevision",
            "movieClipEvidenceRevision","mutationEvidenceRevision","propertyName","receiverQName","schema",
            "sourceArtifactSha256","sourceMemberAuthoritySchema","targetExport","targetModule"].sort().join("\0")
        ||proof.schema!=="as3-mapped-native-dynamic-literal-public-target@1"
        ||proof.receiverQName!==receiverQName||proof.propertyName!==propertyName
        ||proof.targetModule!==targetModule||proof.targetExport!==targetExport
        ||proof.sourceMemberAuthoritySchema!==MAPPED_NATIVE_DYNAMIC_LITERAL_TARGET_AUTHORITY.sourceMemberAuthoritySchema
        ||proof.sourceArtifactSha256!==MAPPED_NATIVE_DYNAMIC_LITERAL_TARGET_AUTHORITY.sourceArtifactSha256
        ||proof.movieClipEvidenceRevision!==MAPPED_NATIVE_DYNAMIC_LITERAL_TARGET_AUTHORITY.movieClipEvidenceRevision
        ||proof.fixedCallEvidenceRevision!==MAPPED_NATIVE_DYNAMIC_LITERAL_TARGET_AUTHORITY.fixedCallEvidenceRevision
        ||proof.mutationEvidenceRevision!==MAPPED_NATIVE_DYNAMIC_LITERAL_TARGET_AUTHORITY.mutationEvidenceRevision
        ||proof.authoritySha256!==MAPPED_NATIVE_DYNAMIC_LITERAL_TARGET_AUTHORITY.authoritySha256) {
        throw new HardenedSemanticError("HARDENED_MAPPED_NATIVE_DYNAMIC_LITERAL_TARGET_AUTHORITY",
            "semantic mapped-native dynamic target lacks its exact retained evidence authority");
    }
}
