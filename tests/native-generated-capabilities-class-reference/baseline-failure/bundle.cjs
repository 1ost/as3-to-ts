var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};

// utils/nativeClass.ts
var nativeClass_exports = {};
__export(nativeClass_exports, {
  bindNativeClassSourceUnit: () => bindNativeClassSourceUnit,
  declareNativeClass: () => declareNativeClass,
  readNativeClass: () => readNativeClass
});
var bindings = /* @__PURE__ */ new WeakMap();
function declareNativeClass(factory) {
  if (typeof factory !== "function") throw new TypeError("Native class factory must be callable");
  const fail = () => {
    throw new Error("AS3_CLASS_INITIALIZER_UNSUPPORTED: unresolved native class binding");
  };
  const handle = new Proxy(function() {
    return fail();
  }, {
    get: fail,
    set: fail,
    construct: fail,
    apply: fail
  });
  bindings.set(handle, { factory, initializing: false, value: null });
  return handle;
}
function bindNativeClassSourceUnit(handles, instantiate) {
  if (!Array.isArray(handles) || !handles.length || typeof instantiate !== "function")
    throw new TypeError("Native source unit requires Class handles and an instantiator");
  const members2 = handles.map((handle) => bindings.get(handle));
  if (members2.some((binding) => !binding || binding.sourceUnit || binding.initializing || binding.value) || new Set(handles).size !== handles.length)
    throw new TypeError("Native source unit requires distinct uninitialized Class handles");
  const unit = { active: false, ready: false, values: [], helperLookups: /* @__PURE__ */ new Map(), run: () => {
    unit.active = true;
    unit.values = members2.map(() => null);
    let next = 0;
    try {
      instantiate(members2.map((binding, index) => () => {
        if (!unit.active || index !== next) throw new TypeError("Native source Class initialization order");
        const value2 = binding.factory(finalizeIdentity);
        if (typeof value2 !== "function") throw new TypeError("Native class factory must return a constructor");
        unit.values[index] = value2;
        next++;
        return value2;
      }));
      if (next !== members2.length) throw new TypeError("Native source unit initialization is incomplete");
      unit.ready = true;
    } finally {
      unit.active = false;
      if (!unit.ready) unit.values = [];
    }
  } };
  members2.forEach((binding, index) => {
    binding.sourceUnit = unit;
    binding.sourceIndex = index;
  });
}
function finalizeIdentity(value2) {
  const prototype = value2 && value2.prototype;
  const constructor = prototype && Object.getOwnPropertyDescriptor(prototype, "constructor");
  if (!constructor || !constructor.configurable || typeof constructor.value !== "function")
    throw new Error("AS3_CLASS_INITIALIZER_UNSUPPORTED: native class prototype identity is not writable");
  Object.defineProperty(prototype, "constructor", {
    value: value2,
    writable: constructor.writable,
    enumerable: constructor.enumerable,
    configurable: constructor.configurable
  });
  return value2;
}
function readNativeClass(handle, context2 = "value") {
  const binding = bindings.get(handle);
  if (!binding) throw new Error("AS3_CLASS_INITIALIZER_UNSUPPORTED: unknown native class binding");
  if (binding.sourceUnit) {
    const unit = binding.sourceUnit, index = binding.sourceIndex;
    const cached = index > 0 && unit.helperLookups.has(index);
    if (!cached && !unit.active && !unit.ready) unit.run();
    const value2 = cached ? unit.helperLookups.get(index) : unit.values[index];
    if (index > 0) unit.helperLookups.set(index, value2);
    if (!value2 && context2 === "read") {
      const failure3 = new TypeError("Error #1009");
      Object.defineProperty(failure3, "errorID", { value: 1009 });
      throw failure3;
    }
    if (!value2 && context2 !== "value") throw new Error("AS3_CLASS_INITIALIZER_UNSUPPORTED: cyclic class use requires additional source evidence");
    return value2;
  }
  if (binding.value) return binding.value;
  if (binding.initializing) {
    if (context2 === "read") {
      const failure3 = new TypeError("Error #1009");
      Object.defineProperty(failure3, "errorID", { value: 1009 });
      throw failure3;
    }
    if (context2 !== "value") throw new Error("AS3_CLASS_INITIALIZER_UNSUPPORTED: cyclic class use requires additional source evidence");
    return null;
  }
  binding.initializing = true;
  try {
    const value2 = binding.factory(finalizeIdentity);
    if (typeof value2 !== "function") throw new TypeError("Native class factory must return a constructor");
    binding.value = value2;
    return value2;
  } finally {
    binding.initializing = false;
  }
}

// utils/callableClass.ts
var callableClass_exports = {};
__export(callableClass_exports, {
  callableClassIntrinsics: () => callableClassIntrinsics
});
var constructors = /* @__PURE__ */ new WeakMap();
var nativeBases = /* @__PURE__ */ new WeakMap();
var nativeAllocators = /* @__PURE__ */ new WeakMap();
var allocatedReceivers = /* @__PURE__ */ new WeakSet();
var allocationPlaceholders = /* @__PURE__ */ new WeakSet();
var entries = /* @__PURE__ */ new WeakMap();
function failure(id, name2) {
  const error4 = new Error("Error #" + id);
  error4.name = name2;
  Object.defineProperty(error4, "errorID", { value: id });
  return error4;
}
var callableClassIntrinsics = Object.freeze({
  /** Compiler-only carrier projection; preserves the exact constructor identity. */
  constructorIdentity(value2) {
    if (typeof value2 !== "function" || !value2.prototype || typeof value2.prototype !== "object")
      throw new TypeError("Native class identity must be a constructor");
    return value2;
  },
  defineProperty: Object.defineProperty,
  getOwnPropertyDescriptor: Object.getOwnPropertyDescriptor,
  getPrototypeOf: Object.getPrototypeOf,
  create: Object.create,
  assign: Object.assign,
  setPrototypeOf: Object.setPrototypeOf,
  number: Number,
  array: Array,
  symbol: Symbol,
  arraySlice: Array.prototype.slice,
  apply: Reflect.apply,
  arityError: () => failure(1063, "ArgumentError"),
  registerNativeBase(ctor, adapter) {
    if (!adapter || !Object.isFrozen(adapter) || ["constructor", "prepareInstance", "initializeInstance"].some((key3) => {
      const field = Object.getOwnPropertyDescriptor(adapter, key3);
      return !field || !("value" in field) || typeof field.value !== "function";
    }) || adapter.constructor !== ctor || nativeBases.has(ctor) && nativeBases.get(ctor) !== adapter || constructors.has(ctor) && !nativeBases.has(ctor)) throw new Error("AS3_CALLABLE_CLASS_UNSUPPORTED: native base entry authority");
    const allocate = Object.getOwnPropertyDescriptor(adapter, "allocateInstance");
    if (allocate && (!("value" in allocate) || typeof allocate.value !== "function"))
      throw new Error("AS3_CALLABLE_CLASS_UNSUPPORTED: native allocation entry authority");
    if (allocate) nativeAllocators.set(ctor, allocate.value);
    nativeBases.set(ctor, adapter);
    constructors.set(ctor, null);
  },
  /** Compiler constructor shell: native allocation precedes source field effects. */
  invokeNativeConstructor(receiver3, ctor, args, body) {
    if (!constructors.has(ctor) || receiver3 === null || typeof receiver3 !== "object") throw failure(1006, "TypeError");
    const entry = entries.get(receiver3);
    if (entry) {
      if (entry.status !== "active" || entry.expected !== ctor) throw failure(1006, "TypeError");
      return Reflect.apply(body, receiver3, args);
    }
    if (Object.getPrototypeOf(receiver3) !== ctor.prototype || allocationPlaceholders.has(receiver3)) throw failure(1006, "TypeError");
    let base = ctor;
    while (base && !nativeAllocators.has(base)) base = constructors.get(base);
    const allocate = base && nativeAllocators.get(base);
    if (!allocate) return Reflect.apply(body, receiver3, args);
    allocationPlaceholders.add(receiver3);
    const native = allocate(ctor);
    if (native === null || typeof native !== "object" || native === receiver3 || allocatedReceivers.has(native) || entries.has(native) || Object.getPrototypeOf(native) !== ctor.prototype) throw failure(1006, "TypeError");
    allocatedReceivers.add(native);
    Reflect.apply(body, native, args);
    return native;
  },
  prepareNativeBase(receiver3, base) {
    const entry = entries.get(receiver3), adapter = nativeBases.get(base);
    if (!entry || entry.status !== "active" || entry.stack.length !== 1 || !adapter) throw failure(1006, "TypeError");
    let parent = entry.stack[0];
    while (parent && parent !== base) parent = constructors.get(parent);
    if (parent !== base) throw failure(1006, "TypeError");
    adapter.prepareInstance(receiver3);
  },
  callNativeBase(receiver3, owner, base, args) {
    const entry = entries.get(receiver3), adapter = nativeBases.get(base);
    if (!entry || entry.status !== "active" || entry.expected || entry.stack[entry.stack.length - 1] !== owner || constructors.get(owner) !== base || !adapter) throw failure(1006, "TypeError");
    adapter.initializeInstance(receiver3, args);
  },
  register(ctor, base) {
    if (constructors.has(ctor) || base && !constructors.has(base))
      throw new Error("AS3_CALLABLE_CLASS_UNSUPPORTED: unregistered/mixed constructor chain");
    constructors.set(ctor, base);
  },
  enter(receiver3, ctor) {
    if (!constructors.has(ctor) || receiver3 === null || typeof receiver3 !== "object") throw failure(1006, "TypeError");
    const entry = entries.get(receiver3);
    if (entry) {
      if (entry.status !== "active" || entry.expected !== ctor) throw failure(1006, "TypeError");
      entry.expected = null;
      entry.stack.push(ctor);
      return false;
    }
    if (Object.getPrototypeOf(receiver3) !== ctor.prototype) throw failure(1006, "TypeError");
    entries.set(receiver3, { status: "active", stack: [ctor], expected: null });
    return true;
  },
  expectBase(receiver3, owner, base) {
    const entry = entries.get(receiver3);
    if (!entry || entry.status !== "active" || entry.expected || entry.stack[entry.stack.length - 1] !== owner || constructors.get(owner) !== base) throw failure(1006, "TypeError");
    entry.expected = base;
  },
  leave(receiver3, ctor, succeeded) {
    const entry = entries.get(receiver3);
    if (!entry || entry.stack[entry.stack.length - 1] !== ctor)
      throw new Error("AS3_CALLABLE_CLASS_UNSUPPORTED: mismatched construction entry");
    entry.stack.pop();
    entry.expected = null;
    if (!succeeded) entry.status = "failed";
    else if (entry.stack.length === 0) entry.status = "completed";
  }
});

// ../engine/src/layaAir/flash/errors/AS3SourceError.ts
var AS3SourceError_exports = {};
__export(AS3SourceError_exports, {
  AS3Error: () => AS3Error,
  AS3IOError: () => AS3IOError,
  AS3IllegalOperationError: () => AS3IllegalOperationError,
  as3CreateArgumentError: () => as3CreateArgumentError,
  as3CreateError: () => as3CreateError,
  as3CreateRangeError: () => as3CreateRangeError,
  as3CreateReferenceError: () => as3CreateReferenceError,
  as3IsSourceEOFErrorInstance: () => as3IsSourceEOFErrorInstance,
  as3IsSourceErrorInstance: () => as3IsSourceErrorInstance,
  as3IsSourceIOErrorInstance: () => as3IsSourceIOErrorInstance,
  as3IsSourceIllegalOperationErrorInstance: () => as3IsSourceIllegalOperationErrorInstance,
  as3IsSourceSecurityErrorInstance: () => as3IsSourceSecurityErrorInstance,
  as3IsSourceSyntaxErrorInstance: () => as3IsSourceSyntaxErrorInstance,
  as3IsSourceTypeErrorInstance: () => as3IsSourceTypeErrorInstance,
  as3SourceErrorEnumerableKeys: () => as3SourceErrorEnumerableKeys,
  createAS3AccessibilityImplementationError: () => createAS3AccessibilityImplementationError,
  createAS3ApplicationDomainNameError: () => createAS3ApplicationDomainNameError,
  createAS3ArgumentCountError: () => createAS3ArgumentCountError,
  createAS3ArrayCoercionError: () => createAS3ArrayCoercionError,
  createAS3ArraySortCoercionError: () => createAS3ArraySortCoercionError,
  createAS3BitmapDataMergeError: () => createAS3BitmapDataMergeError,
  createAS3BooleanMethodReceiverError: () => createAS3BooleanMethodReceiverError,
  createAS3ByteArrayDecompressionArityError: () => createAS3ByteArrayDecompressionArityError,
  createAS3ByteArrayDecompressionError: () => createAS3ByteArrayDecompressionError,
  createAS3ByteArrayReadError: () => createAS3ByteArrayReadError,
  createAS3CanonicalReferenceCoercionError: () => createAS3CanonicalReferenceCoercionError,
  createAS3ColorTransformNullError: () => createAS3ColorTransformNullError,
  createAS3CompressedSoundError: () => createAS3CompressedSoundError,
  createAS3ConstructionError: () => createAS3ConstructionError,
  createAS3ContentElementError: () => createAS3ContentElementError,
  createAS3DeclaredReferenceCoercionError: () => createAS3DeclaredReferenceCoercionError,
  createAS3DisplayChildOwnershipError: () => createAS3DisplayChildOwnershipError,
  createAS3DisplayCoordinateArgumentError: () => createAS3DisplayCoordinateArgumentError,
  createAS3DisplayMatrix3DError: () => createAS3DisplayMatrix3DError,
  createAS3DisplayMetadataArgumentError: () => createAS3DisplayMetadataArgumentError,
  createAS3DisplayNameNullError: () => createAS3DisplayNameNullError,
  createAS3DisplayTransformNullError: () => createAS3DisplayTransformNullError,
  createAS3ElementFormatError: () => createAS3ElementFormatError,
  createAS3ErrorReadonlyFailure: () => createAS3ErrorReadonlyFailure,
  createAS3EventListenerArgumentError: () => createAS3EventListenerArgumentError,
  createAS3ExternalInterfaceUnavailableError: () => createAS3ExternalInterfaceUnavailableError,
  createAS3FontDescriptionError: () => createAS3FontDescriptionError,
  createAS3FullscreenSecurityError: () => createAS3FullscreenSecurityError,
  createAS3FunctionCoercionError: () => createAS3FunctionCoercionError,
  createAS3InterfaceConstructionError: () => createAS3InterfaceConstructionError,
  createAS3JSONSyntaxError: () => createAS3JSONSyntaxError,
  createAS3Matrix3DRecompositionError: () => createAS3Matrix3DRecompositionError,
  createAS3Matrix3DScaleError: () => createAS3Matrix3DScaleError,
  createAS3MethodConstructionError: () => createAS3MethodConstructionError,
  createAS3NamedCallError: () => createAS3NamedCallError,
  createAS3NumberMethodError: () => createAS3NumberMethodError,
  createAS3PerspectiveProjectionError: () => createAS3PerspectiveProjectionError,
  createAS3PrimitiveConversionError: () => createAS3PrimitiveConversionError,
  createAS3PrimitivePropertyError: () => createAS3PrimitivePropertyError,
  createAS3PrimitiveWriteError: () => createAS3PrimitiveWriteError,
  createAS3PropertyError: () => createAS3PropertyError,
  createAS3RegExpCopyFlagsError: () => createAS3RegExpCopyFlagsError,
  createAS3RichTextError: () => createAS3RichTextError,
  createAS3SecurityDomainConstructionError: () => createAS3SecurityDomainConstructionError,
  createAS3ShaderArgumentError: () => createAS3ShaderArgumentError,
  createAS3SharedObjectPropertyNameError: () => createAS3SharedObjectPropertyNameError,
  createAS3SoundLoadError: () => createAS3SoundLoadError,
  createAS3SoundTransformNullError: () => createAS3SoundTransformNullError,
  createAS3StagePointArgumentError: () => createAS3StagePointArgumentError,
  createAS3StageTransformAssignmentError: () => createAS3StageTransformAssignmentError,
  createAS3StringConversionError: () => createAS3StringConversionError,
  createAS3StringMethodReceiverError: () => createAS3StringMethodReceiverError,
  createAS3StyleSheetArgumentError: () => createAS3StyleSheetArgumentError,
  createAS3TabStopError: () => createAS3TabStopError,
  createAS3TextBlockError: () => createAS3TextBlockError,
  createAS3TextBoundaryError: () => createAS3TextBoundaryError,
  createAS3TextFieldStyleError: () => createAS3TextFieldStyleError,
  createAS3TextFormatRangeError: () => createAS3TextFormatRangeError,
  createAS3TextJustifierError: () => createAS3TextJustifierError,
  createAS3TextLineError: () => createAS3TextLineError,
  createAS3TextRunRangeError: () => createAS3TextRunRangeError,
  createAS3TextSnapshotError: () => createAS3TextSnapshotError,
  createAS3TimelineNameError: () => createAS3TimelineNameError,
  createAS3TweenHandleCoercionError: () => createAS3TweenHandleCoercionError,
  createAS3URLStreamClosedError: () => createAS3URLStreamClosedError,
  createAS3URLStreamError: () => createAS3URLStreamError,
  createAS3URLVariablesDecodeError: () => createAS3URLVariablesDecodeError,
  createAS3VectorCoercionError: () => createAS3VectorCoercionError,
  createAS3VectorFixedError: () => createAS3VectorFixedError,
  createAS3VectorLengthArgumentError: () => createAS3VectorLengthArgumentError,
  createAS3XMLMutationError: () => createAS3XMLMutationError,
  createAS3XMLParseError: () => createAS3XMLParseError,
  deleteSourceErrorDynamic: () => deleteSourceErrorDynamic,
  getAS3SourceErrorClassName: () => getAS3SourceErrorClassName,
  getAS3SourceErrorPrototype: () => getAS3SourceErrorPrototype,
  initializeGeneratedAS3Error: () => initializeGeneratedAS3Error,
  isAS3SourceError: () => isAS3SourceError,
  prepareGeneratedAS3Error: () => prepareGeneratedAS3Error,
  setSourceErrorDynamic: () => setSourceErrorDynamic,
  setSourceErrorEnumerable: () => setSourceErrorEnumerable,
  setSourceErrorField: () => setSourceErrorField,
  sourceErrorDynamic: () => sourceErrorDynamic,
  sourceErrorEnumerable: () => sourceErrorEnumerable,
  sourceErrorField: () => sourceErrorField,
  sourceErrorObjectTag: () => sourceErrorObjectTag,
  sourceErrorParent: () => sourceErrorParent
});

// ../engine/src/layaAir/flash/utils/AS3FunctionReturn.ts
var stringReturns = /* @__PURE__ */ new WeakSet();
function registerAS3StringReturn(fn) {
  stringReturns.add(fn);
}
function hasAS3StringReturn(value2) {
  return typeof value2 === "function" && stringReturns.has(value2);
}

// ../engine/src/layaAir/flash/utils/AS3Class.ts
var AS3Class_exports = {};
__export(AS3Class_exports, {
  AS3ClassType: () => AS3ClassType,
  as3AsClass: () => as3AsClass,
  as3CallClass: () => as3CallClass,
  as3CoerceClass: () => as3CoerceClass,
  as3ConstructClass: () => as3ConstructClass,
  as3CreateObjectLiteral: () => as3CreateObjectLiteral,
  getAS3BuiltinClassName: () => getAS3BuiltinClassName,
  registerAS3Constructor: () => registerAS3Constructor
});

// ../engine/src/layaAir/flash/utils/AS3ArrayCreation.ts
var AS3ArrayCreation_exports = {};
__export(AS3ArrayCreation_exports, {
  as3CreateArray: () => as3CreateArray,
  as3CreateArrayLiteral: () => as3CreateArrayLiteral,
  getAS3ArrayCreation: () => getAS3ArrayCreation
});
var creations = /* @__PURE__ */ new WeakMap();
function unsupported(reason) {
  throw new TypeError("AS3_ARRAY_CREATION_UNSUPPORTED: " + reason);
}
function valuesOf(input) {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype)
    return unsupported("ordinary compiler value list required");
  const values5 = [];
  for (let index = 0; index < input.length; index++) {
    const slot = Object.getOwnPropertyDescriptor(input, String(index));
    if (!slot || !("value" in slot)) return unsupported("dense compiler data slots required; source elisions must be explicit undefined");
    if (typeof slot.value === "symbol" || typeof slot.value === "bigint") return unsupported("host-only primitive");
    values5.push(slot.value);
  }
  return values5;
}
function created(values5, kind) {
  creations.set(values5, Object.freeze({ kind, initialLength: values5.length }));
  return values5;
}
function as3CreateArrayLiteral(values5) {
  return created(valuesOf(values5), "values");
}
function as3CreateArray(arguments_ = []) {
  const values5 = valuesOf(arguments_);
  if (values5.length === 1 && typeof values5[0] === "number") {
    const length = values5[0];
    if (!Number.isInteger(length) || length < 0 || length > 4294967295) {
      const error4 = new RangeError("Error #1005");
      Object.defineProperty(error4, "errorID", { value: 1005 });
      throw error4;
    }
    return created(new Array(length), "length");
  }
  return created(values5, "values");
}
function getAS3ArrayCreation(value2) {
  return value2 !== null && typeof value2 === "object" ? creations.get(value2) : void 0;
}

// ../engine/src/layaAir/flash/utils/AS3Interface.ts
var interfaces = /* @__PURE__ */ new WeakMap();
function isAS3Interface(value2) {
  return value2 !== null && typeof value2 === "object" && interfaces.has(value2);
}
function getAS3InterfaceClosure(token) {
  const closure = token !== null && typeof token === "object" ? interfaces.get(token) : void 0;
  if (!closure) throw new TypeError("Unregistered AS3 interface token");
  return closure;
}

// ../engine/src/layaAir/laya/display/SourceStageViewRegistry.ts
var stageReferenceMatcher = null;
var stageViewPredicate = null;
var stageEventMethodResolver = null;
function sourceStageEventMethod(value2, name2) {
  return stageEventMethodResolver?.(value2, name2);
}
function isSourceStageView(value2) {
  return stageViewPredicate?.(value2) ?? false;
}
function matchSourceStageReference(value2, target) {
  return stageReferenceMatcher?.(value2, target);
}

// ../engine/src/layaAir/laya/display/SourceBuiltinClassRegistry.ts
var resolver = null;
function sourceBuiltinClassFor(value2) {
  return resolver?.(value2) ?? null;
}

// ../engine/src/layaAir/flash/utils/FlashSourceReflection.ts
var tags = /* @__PURE__ */ new Set([
  "type",
  "factory",
  "extendsClass",
  "implementsInterface",
  "constructor",
  "parameter",
  "accessor",
  "method",
  "variable",
  "constant",
  "metadata",
  "arg"
]);
var required = {
  type: ["name", "isDynamic", "isFinal", "isStatic"],
  factory: ["type"],
  extendsClass: ["type"],
  implementsInterface: ["type"],
  constructor: [],
  parameter: ["index", "type", "optional"],
  accessor: ["name", "access", "type", "declaredBy"],
  method: ["name", "declaredBy", "returnType"],
  variable: ["name", "type"],
  constant: ["name", "type"],
  metadata: ["name"],
  arg: ["key", "value"]
};
function invalid() {
  throw new TypeError("Invalid complete source reflection data");
}
function data(object2, key3) {
  const descriptor2 = Object.getOwnPropertyDescriptor(object2, key3);
  if (!descriptor2 || !("value" in descriptor2)) return invalid();
  return descriptor2.value;
}
function object(value2) {
  if (!value2 || typeof value2 !== "object" || Object.getPrototypeOf(value2) !== Object.prototype) return invalid();
  return value2;
}
function copyFlashCompleteReflection(input) {
  const top = object(input);
  if (data(top, "kind") !== "source-complete") return invalid();
  const seen = /* @__PURE__ */ new Set();
  let count = 0;
  function node(input2, depth) {
    const source = object(input2);
    if (seen.has(source) || depth > 32 || ++count > 1e4) return invalid();
    seen.add(source);
    const tag = data(source, "tag"), attributes = object(data(source, "attributes")), children = data(source, "children");
    if (typeof tag !== "string" || !tags.has(tag) || !Array.isArray(children) || Object.getPrototypeOf(children) !== Array.prototype) return invalid();
    const copied = {};
    for (const key3 of Reflect.ownKeys(attributes)) {
      if (typeof key3 !== "string" || !key3.length) return invalid();
      const value2 = data(attributes, key3);
      if (typeof value2 !== "string") return invalid();
      Object.defineProperty(copied, key3, { value: value2, enumerable: true });
    }
    const list = [];
    for (let i = 0; i < children.length; i++) list.push(node(data(children, String(i)), depth + 1));
    for (const key3 of required[tag]) if (typeof copied[key3] !== "string") return invalid();
    if (tag === "type" && typeof copied.base !== "string" && !(copied.name === "Object" && copied.isStatic === "false")) return invalid();
    if (tag === "type" && ["isDynamic", "isFinal", "isStatic"].some((key3) => !["true", "false"].includes(copied[key3]))) return invalid();
    if (tag === "accessor" && !["readonly", "writeonly", "readwrite"].includes(copied.access)) return invalid();
    if (tag === "parameter" && (!/^[1-9][0-9]*$/.test(copied.index) || !["true", "false"].includes(copied.optional))) return invalid();
    const allowed = tag === "type" || tag === "factory" ? ["extendsClass", "implementsInterface", "constructor", "accessor", "method", "variable", "constant", "metadata", ...tag === "type" ? ["factory"] : []] : tag === "method" || tag === "constructor" ? ["parameter", "metadata"] : ["accessor", "variable", "constant"].includes(tag) ? ["metadata"] : tag === "metadata" ? ["arg"] : [];
    if (list.some((child) => !allowed.includes(child.tag))) return invalid();
    if (tag === "method" || tag === "constructor") {
      let optional = false, index = 0;
      for (const parameter of list.filter((child) => child.tag === "parameter")) {
        if (parameter.attributes.index !== String(++index) || optional && parameter.attributes.optional !== "true") return invalid();
        optional = parameter.attributes.optional === "true";
      }
    }
    if ((tag === "type" || tag === "factory") && list.filter((child) => child.tag === "constructor").length > 1) return invalid();
    seen.delete(source);
    return Object.freeze({ tag, attributes: Object.freeze(copied), children: Object.freeze(list) });
  }
  const classDocument = node(data(top, "classDocument"), 0);
  const instanceInput = data(top, "instanceDocument");
  const instanceDocument = instanceInput === null ? null : node(instanceInput, 0);
  const instanceFlagsAuthority = data(top, "instanceFlagsAuthority");
  if (classDocument.tag !== "type" || classDocument.attributes.isStatic !== "true" || classDocument.attributes.base !== "Class" || (instanceDocument ? instanceFlagsAuthority !== "captured-instance" || instanceDocument.tag !== "type" || instanceDocument.attributes.isStatic !== "false" : instanceFlagsAuthority !== "sdk-declaration")) return invalid();
  return Object.freeze({
    kind: "source-complete",
    classDocument,
    instanceDocument,
    instanceFlagsAuthority
  });
}
function flashReflectionFactory(source) {
  const factories = source.classDocument.children.filter((child) => child.tag === "factory");
  if (factories.length !== 1) return invalid();
  return factories[0];
}

// ../engine/src/layaAir/flash/utils/AS3DynamicObject.ts
var ordinaryObjects = /* @__PURE__ */ new WeakSet();
var ordinaryPrototype = Object.prototype;
function as3CreateDynamicObject() {
  const value2 = {};
  ordinaryObjects.add(value2);
  return value2;
}
function as3CreateObjectLiteral(entries2) {
  const value2 = as3CreateDynamicObject();
  for (let i = entries2.length - 1; i >= 0; i--) {
    const [key3, entry] = entries2[i];
    as3DefineDynamicProperty(value2, typeof key3 === "number" ? String(key3) : key3, entry);
  }
  return value2;
}
function as3SetDynamicProperty(target, key3, value2, namespaces = "public") {
  if (!ordinaryObjects.has(target) || Object.getPrototypeOf(target) !== ordinaryPrototype) {
    throw new TypeError("AS3 dynamic write requires an unchanged factory-created ordinary Object");
  }
  return as3DefineDynamicProperty(target, key3, value2, namespaces);
}
function as3DefineDynamicProperty(target, key3, value2, namespaces = "public") {
  if (typeof key3 !== "string") {
    throw new TypeError("AS3 dynamic write requires an already-coerced String key");
  }
  if (namespaces !== "public" && namespaces !== "public-and-AS3") {
    throw new TypeError("AS3 ordinary Object write requires an explicit supported namespace mode");
  }
  if (namespaces === "public-and-AS3" && (key3 === "hasOwnProperty" || key3 === "propertyIsEnumerable" || key3 === "isPrototypeOf")) {
    const error4 = new ReferenceError("Error #1037");
    Object.defineProperty(error4, "errorID", { value: 1037 });
    throw error4;
  }
  const existing = Object.getOwnPropertyDescriptor(target, key3);
  if (existing && (!("value" in existing) || !existing.writable || !existing.configurable)) {
    throw new TypeError("AS3 dynamic write does not support host-defined accessors or restricted properties");
  }
  Object.defineProperty(target, key3, {
    value: value2,
    writable: true,
    enumerable: existing ? existing.enumerable : true,
    configurable: true
  });
  return value2;
}

// ../engine/src/layaAir/flash/utils/AS3ObjectReflection.ts
var reflection = copyFlashCompleteReflection({
  "kind": "source-complete",
  "classDocument": {
    "attributes": {
      "isDynamic": "true",
      "name": "Object",
      "isFinal": "true",
      "base": "Class",
      "isStatic": "true"
    },
    "children": [
      {
        "attributes": {
          "type": "Class"
        },
        "children": [],
        "tag": "extendsClass"
      },
      {
        "attributes": {
          "type": "Object"
        },
        "children": [],
        "tag": "extendsClass"
      },
      {
        "attributes": {
          "type": "int",
          "name": "length"
        },
        "children": [],
        "tag": "constant"
      },
      {
        "attributes": {
          "type": "*",
          "name": "prototype",
          "access": "readonly",
          "declaredBy": "Class"
        },
        "children": [],
        "tag": "accessor"
      },
      {
        "attributes": {
          "type": "Object"
        },
        "children": [],
        "tag": "factory"
      }
    ],
    "tag": "type"
  },
  "instanceDocument": {
    "attributes": {
      "isDynamic": "true",
      "isFinal": "false",
      "name": "Object",
      "isStatic": "false"
    },
    "children": [],
    "tag": "type"
  },
  "instanceFlagsAuthority": "captured-instance"
});
var classAuthority = Object.freeze({ kind: "source-complete", document: reflection.classDocument });
var instanceAuthority = Object.freeze({ kind: "source-complete", document: reflection.instanceDocument });

// ../engine/src/layaAir/flash/utils/FlashTypeMetadata.ts
var constructors2 = /* @__PURE__ */ new WeakMap();
var prototypes = /* @__PURE__ */ new WeakMap();
var legacyReflection = Object.freeze({ kind: "legacy-incomplete" });
function projectedMembers(node) {
  const lists = { variables: [], accessors: [], methods: [], constants: [] };
  for (const child of node.children) {
    const a = child.attributes;
    const common = { name: a.name, declaredBy: a.declaredBy, ...a.uri === void 0 ? {} : { uri: a.uri } };
    if (child.tag === "accessor") lists.accessors.push({ ...common, access: a.access });
    if (child.tag === "variable" || child.tag === "constant") lists[child.tag === "variable" ? "variables" : "constants"].push({ ...common, type: a.type });
    if (child.tag === "method") {
      const parameters = child.children.filter((item) => item.tag === "parameter");
      parameters.forEach((parameter, index) => {
        if (parameter.attributes.index !== String(index + 1) || !parameter.attributes.type || !["true", "false"].includes(parameter.attributes.optional)) throw new TypeError("Invalid complete method parameters");
      });
      if (!a.returnType) throw new TypeError("Complete method requires return type");
      lists.methods.push({ ...common, parameterCount: parameters.length });
    }
  }
  return members(lists);
}
function validateComplete(metadata, source) {
  const factory = flashReflectionFactory(source), instance = source.instanceDocument ?? factory;
  if (source.instanceDocument) {
    const record5 = (node) => JSON.stringify([
      node.tag,
      Object.keys(node.attributes).sort().map((key3) => [key3, node.attributes[key3]]),
      node.children.map(record5)
    ]);
    const ancestry = (node) => node.children.filter((child) => child.tag === "extendsClass").map(record5);
    const surface = (node) => node.children.filter((child) => child.tag !== "extendsClass").map(record5).sort();
    if (JSON.stringify(ancestry(factory)) !== JSON.stringify(ancestry(instance)) || JSON.stringify(surface(factory)) !== JSON.stringify(surface(instance)))
      throw new TypeError("Complete Class factory and instance reflection differ");
  }
  const classAttributes = source.classDocument.attributes;
  if (classAttributes.name !== metadata.name || factory.attributes.type !== metadata.name || classAttributes.isDynamic !== "true" || classAttributes.isFinal !== "true" || source.instanceDocument && (instance.attributes.name !== metadata.name || instance.attributes.base !== metadata.base || instance.attributes.isDynamic !== String(metadata.isDynamic) || instance.attributes.isFinal !== String(metadata.isFinal)) || instance.children.find((child) => child.tag === "extendsClass")?.attributes.type !== metadata.base)
    throw new TypeError("Complete reflection identity differs from declaration projection");
  if (JSON.stringify(projectedMembers(instance)) !== JSON.stringify(metadata.instance) || JSON.stringify(projectedMembers(source.classDocument)) !== JSON.stringify(metadata.statics))
    throw new TypeError("Complete reflection traits differ from declaration projection");
}
function name(value2) {
  if (typeof value2 !== "string" || value2.length === 0)
    throw new TypeError("Flash reflection metadata requires nonempty names");
  return value2;
}
function members(input) {
  if (!input || typeof input !== "object")
    throw new TypeError("Flash reflection metadata requires complete member lists");
  const list = (key3, optional = false) => {
    const property2 = Object.getOwnPropertyDescriptor(input, key3);
    if (optional && (!property2 || "value" in property2 && property2.value === void 0)) return void 0;
    if (!property2 || !("value" in property2) || !Array.isArray(property2.value))
      throw new TypeError("Flash reflection metadata requires complete member lists");
    const source = property2.value, copied = [];
    for (let index = 0; index < source.length; index++) {
      const slot = Object.getOwnPropertyDescriptor(source, String(index));
      if (!slot || !("value" in slot) || slot.value === null || typeof slot.value !== "object")
        throw new TypeError("Flash reflection metadata requires dense member records");
      const record5 = {};
      for (const field of ["name", "declaredBy", "uri", "type", "access", "parameterCount"]) {
        const value2 = Object.getOwnPropertyDescriptor(slot.value, field);
        if (value2 && !("value" in value2))
          throw new TypeError("Flash reflection metadata requires data member records");
        if (value2) record5[field] = value2.value;
      }
      copied.push(record5);
    }
    return copied;
  };
  const variableRecords = list("variables");
  const accessorRecords = list("accessors");
  const methodRecords = list("methods");
  const constantRecords = list("constants", true);
  const names = /* @__PURE__ */ new Set();
  const common = (member, optionalOwner = false) => {
    const localName = name(member.name);
    if (member.uri !== void 0 && typeof member.uri !== "string")
      throw new TypeError("Invalid Flash reflection namespace URI");
    const key3 = JSON.stringify([member.uri ?? "", localName]);
    if (names.has(key3)) throw new TypeError("Duplicate Flash reflection member: " + key3);
    names.add(key3);
    return {
      name: localName,
      ...optionalOwner && member.declaredBy === void 0 ? {} : { declaredBy: name(member.declaredBy) },
      ...member.uri === void 0 ? {} : { uri: member.uri }
    };
  };
  const variables2 = variableRecords.map((member) => Object.freeze({
    ...common(member, true),
    type: name(member.type)
  }));
  const constants = constantRecords?.map((member) => Object.freeze({
    ...common(member, true),
    type: name(member.type)
  }));
  const accessors = accessorRecords.map((member) => {
    if (!["readonly", "writeonly", "readwrite"].includes(member.access))
      throw new TypeError("Invalid Flash reflection accessor access");
    return Object.freeze({
      ...common(member),
      declaredBy: name(member.declaredBy),
      access: member.access,
      ...member.type === void 0 ? {} : { type: name(member.type) }
    });
  });
  const methods5 = methodRecords.map((member) => {
    if (!Number.isSafeInteger(member.parameterCount) || member.parameterCount < 0)
      throw new TypeError("Invalid Flash reflection parameter count");
    return Object.freeze({ ...common(member), declaredBy: name(member.declaredBy), parameterCount: member.parameterCount });
  });
  return Object.freeze({
    variables: Object.freeze(variables2),
    accessors: Object.freeze(accessors),
    methods: Object.freeze(methods5),
    ...constants === void 0 ? {} : { constants: Object.freeze(constants) }
  });
}
function registerFlashTypeMetadata(constructor, input) {
  if (typeof constructor !== "function") throw new TypeError("Invalid Flash reflection constructor");
  const prototypeDescriptor = Object.getOwnPropertyDescriptor(constructor, "prototype");
  const prototype = prototypeDescriptor?.value;
  if (!prototype || typeof prototype !== "object") throw new TypeError("Invalid Flash reflection prototype");
  if (prototypeDescriptor.writable || prototypeDescriptor.configurable)
    throw new TypeError("Flash reflection requires a stable native class prototype");
  if (!input || typeof input !== "object")
    throw new TypeError("Invalid Flash reflection class metadata");
  const field = (key3) => {
    const property2 = Object.getOwnPropertyDescriptor(input, key3);
    if (!property2 || !("value" in property2))
      throw new TypeError("Flash reflection requires data class metadata");
    return property2.value;
  };
  const className = field("name"), base = field("base"), isDynamic = field("isDynamic"), isFinal = field("isFinal");
  const instanceInput = field("instance"), staticInput = field("statics");
  if (typeof isDynamic !== "boolean" || typeof isFinal !== "boolean" || base !== null && (typeof base !== "string" || !base))
    throw new TypeError("Invalid Flash reflection class metadata");
  const sourceDescriptor = Object.getOwnPropertyDescriptor(input, "sourceReflection");
  if (sourceDescriptor && !("value" in sourceDescriptor)) throw new TypeError("Source reflection must be data");
  const sourceReflection = sourceDescriptor?.value === void 0 ? void 0 : copyFlashCompleteReflection(sourceDescriptor.value);
  const metadata = Object.freeze({
    name: name(className),
    base,
    isDynamic,
    isFinal,
    instance: members(instanceInput),
    statics: members(staticInput),
    ...sourceReflection ? { sourceReflection } : {}
  });
  if (sourceReflection) validateComplete(metadata, sourceReflection);
  if (isCanonicalAS3DeclarationConstructor(constructor)) {
    const declaration2 = getAS3DeclarationType(constructor);
    const base2 = getAS3SourceBase(constructor);
    if (!sourceReflection || metadata.name !== declaration2.name || metadata.base !== (base2?.name ?? "Object"))
      throw new TypeError("Canonical Class requires complete matching source reflection");
  }
  const fingerprint = JSON.stringify(metadata);
  const existing = constructors2.get(constructor);
  if (existing) {
    if (existing.fingerprint !== fingerprint || prototypes.get(prototype) !== existing)
      throw new TypeError("Conflicting Flash reflection metadata");
    return;
  }
  if (prototypes.has(prototype)) throw new TypeError("Flash reflection prototype already registered");
  const instance = Object.freeze({
    name: metadata.name,
    base: metadata.base,
    isDynamic: metadata.isDynamic,
    isFinal: metadata.isFinal,
    isStatic: false,
    ...metadata.instance,
    factory: null,
    ...sourceReflection ? { reflectionAuthority: sourceReflection.instanceDocument ? Object.freeze({ kind: "source-complete", document: sourceReflection.instanceDocument }) : Object.freeze({
      kind: "declaration-projection",
      factory: flashReflectionFactory(sourceReflection),
      isDynamic: metadata.isDynamic,
      isFinal: metadata.isFinal,
      flagsAuthority: "sdk-declaration"
    }) } : {}
  });
  const statics = Object.freeze({
    name: metadata.name,
    base: "Class",
    isDynamic: true,
    isFinal: true,
    isStatic: true,
    ...metadata.statics,
    factory: metadata.instance,
    ...sourceReflection ? { reflectionAuthority: Object.freeze({
      kind: "source-complete",
      document: sourceReflection.classDocument
    }) } : {}
  });
  const record5 = { constructor, metadata, instance, statics, fingerprint };
  constructors2.set(constructor, record5);
  prototypes.set(prototype, record5);
}
function describeRegisteredFlashInstanceType(constructor) {
  const record5 = constructors2.get(constructor);
  if (!record5) return null;
  if (isCanonicalAS3DeclarationConstructor(constructor)) getAS3ExactSourceClass(constructor);
  return record5.instance;
}
function describeRegisteredFlashType(value2) {
  if (typeof value2 === "function") {
    const exact2 = constructors2.get(value2);
    if (exact2) {
      if (isCanonicalAS3DeclarationConstructor(value2)) getAS3ExactSourceClass(value2);
      return exact2.statics;
    }
    for (let parent = Object.getPrototypeOf(value2); parent !== null; parent = Object.getPrototypeOf(parent)) {
      if (constructors2.has(parent))
        throw new TypeError("Derived Flash class requires its own reflection metadata");
    }
    return null;
  }
  if (value2 === null || typeof value2 !== "object") return null;
  const builtin = sourceBuiltinClassFor(value2);
  if (builtin) {
    if (isCanonicalAS3DeclarationConstructor(builtin) && getAS3ExactSourceClass(value2)?.constructor !== builtin)
      throw new TypeError("Canonical reflection requires genuine exact Class identity");
    return constructors2.get(builtin)?.instance ?? null;
  }
  let prototype = Object.getPrototypeOf(value2);
  const exact = prototypes.get(prototype);
  if (exact) {
    if (isCanonicalAS3DeclarationConstructor(exact.constructor) && getAS3ExactSourceClass(value2)?.constructor !== exact.constructor)
      throw new TypeError("Canonical reflection requires genuine exact Class identity");
    return exact.instance;
  }
  for (; prototype !== null; prototype = Object.getPrototypeOf(prototype)) {
    if (prototypes.has(prototype))
      throw new TypeError("Derived Flash class requires its own reflection metadata");
  }
  return null;
}

// ../engine/src/layaAir/flash/utils/AS3DeclarationType.ts
var declarations = /* @__PURE__ */ new WeakMap();
var constructors3 = /* @__PURE__ */ new WeakMap();
var prototypes2 = /* @__PURE__ */ new WeakMap();
var instances = /* @__PURE__ */ new WeakMap();
var canonicalGenerations = [];
function invalid2(reason) {
  throw new TypeError("AS3_DECLARATION_UNSUPPORTED: " + reason);
}
function declaration(value2) {
  const found = value2 !== null && typeof value2 === "object" ? declarations.get(value2) : void 0;
  if (!found) return invalid2("unauthenticated declaration token");
  return found;
}
function isAS3DeclarationType(value2) {
  return value2 !== null && typeof value2 === "object" && declarations.has(value2);
}
function declareAS3ReferenceType(name2, base = null) {
  if (typeof name2 !== "string" || !name2) return invalid2("nonempty source name required");
  const baseRecord = base === null ? null : declaration(base);
  const type = Object.freeze({ name: name2 });
  const closure = new Set(baseRecord?.closure);
  const record5 = {
    token: type,
    base: baseRecord,
    closure,
    canonical: false,
    interfaces: new Set(baseRecord?.interfaces)
  };
  closure.add(record5);
  declarations.set(type, record5);
  return Object.freeze({ type, publishGeneration: (constructor) => publish(record5, constructor) });
}
function publish(record5, constructor) {
  if (typeof constructor !== "function") return invalid2("native constructor required");
  const metadata = describeRegisteredFlashType(constructor);
  if (!metadata?.isStatic || metadata.name !== record5.token.name)
    return invalid2("generation requires matching exact source reflection metadata");
  const descriptor2 = Object.getOwnPropertyDescriptor(constructor, "prototype");
  if (!descriptor2 || descriptor2.writable || descriptor2.configurable || descriptor2.value === null || typeof descriptor2.value !== "object")
    return invalid2("locked native class prototype required");
  const prototype = descriptor2.value;
  const instanceMetadata = describeRegisteredFlashType(Object.create(prototype));
  const previous = constructors3.get(constructor);
  if (previous) {
    if (previous.declaration !== record5 || previous.prototype !== prototype)
      return invalid2("constructor already belongs to another declaration");
    return previous.authority;
  }
  if (prototypes2.has(prototype)) return invalid2("prototype already belongs to another generation");
  const parent = Object.getPrototypeOf(prototype);
  if (record5.base) {
    if (prototypes2.get(parent)?.declaration !== record5.base || instanceMetadata?.base !== record5.base.token.name)
      return invalid2("native base does not match sealed source declaration ancestry");
  } else if (parent !== Object.prototype || instanceMetadata?.base !== "Object") {
    return invalid2("non-Object base requires explicit declaration authority");
  }
  const authority = Object.freeze({ enterInstance(value2) {
    if (value2 === null || typeof value2 !== "object") return invalid2("native instance required");
    let actual;
    for (let current = Object.getPrototypeOf(value2); current !== null; current = Object.getPrototypeOf(current)) {
      const registered = prototypes2.get(current);
      if (registered) {
        actual = registered;
        break;
      }
    }
    if (!actual || !actual.declaration.closure.has(record5))
      return invalid2("constructor entry does not match actual native generation");
    const existing = instances.get(value2);
    if (existing && existing !== actual) return invalid2("instance generation cannot be rebound");
    instances.set(value2, actual);
  } });
  const generation = {
    declaration: record5,
    constructor,
    prototype,
    authority,
    baseGeneration: record5.base ? prototypes2.get(parent) : null
  };
  constructors3.set(constructor, generation);
  prototypes2.set(prototype, generation);
  return authority;
}
function getAS3DeclarationTypeChain(type) {
  return Object.freeze([...declaration(type).closure].map((record5) => record5.token));
}
function as3DeclarationImplements(type, token) {
  return declaration(type).interfaces.has(token);
}
function getAS3DeclarationType(constructor) {
  return constructors3.get(constructor)?.declaration.token;
}
function getAS3DeclaredConstructorChain(constructor) {
  let generation = constructors3.get(constructor);
  if (!generation) return void 0;
  const result = [];
  for (; generation; generation = generation.baseGeneration ?? void 0) result.push(generation.constructor);
  return Object.freeze(result);
}
function isAS3DeclaredInstance(value2, type) {
  const target = declaration(type);
  if (value2 === null || typeof value2 !== "object") return false;
  const actual = instances.get(value2);
  if (actual) return actual.declaration.closure.has(target);
  if (!target.canonical) return false;
  const canonical = canonicalGenerations.find((generation) => generation.declaration === target);
  if (canonical) {
    const reference = matchSourceStageReference(value2, canonical.constructor);
    if (reference !== void 0) return reference;
  }
  return canonicalGenerations.some((generation) => generation.declaration.closure.has(target) && generation.proof(value2));
}
function getAS3SourceBase(constructor) {
  const generation = constructors3.get(constructor);
  if (generation?.nativeBase && (Object.getPrototypeOf(generation.prototype) !== generation.nativeBase.prototype || Object.getPrototypeOf(generation.constructor) !== (generation.nativeBase === Object ? Function.prototype : generation.nativeBase)))
    return invalid2("canonical native ancestry changed");
  return generation ? generation.declaration.base?.token ?? null : void 0;
}
function isAS3DeclaredInterface(value2, token) {
  if (value2 === null || typeof value2 !== "object") return false;
  const actual = instances.get(value2);
  if (actual) return actual.declaration.interfaces.has(token);
  return canonicalGenerations.some((generation) => generation.declaration.interfaces.has(token) && generation.proof(value2));
}
function getAS3EnteredSourceConstructors(value2) {
  if (value2 === null || typeof value2 !== "object") return void 0;
  let generation = instances.get(value2);
  if (!generation) return void 0;
  const result = [];
  for (; generation; generation = generation.baseGeneration ?? void 0) result.push(generation.constructor);
  return Object.freeze(result);
}
function isCanonicalAS3DeclarationConstructor(constructor) {
  return constructors3.get(constructor)?.declaration.canonical ?? false;
}
function getAS3PrototypeDeclarationType(prototype) {
  return prototypes2.get(prototype)?.declaration.token;
}
function getAS3ExactSourceClass(value2) {
  let generation;
  if (typeof value2 === "function") {
    generation = constructors3.get(value2);
    if (!generation) {
      for (let parent = Object.getPrototypeOf(value2); parent; parent = Object.getPrototypeOf(parent)) {
        if (constructors3.has(parent)) return invalid2("derived source Class requires its own exact generation");
      }
    }
  } else if (value2 !== null && typeof value2 === "object") {
    generation = instances.get(value2);
    const builtin = sourceBuiltinClassFor(value2);
    if (builtin) {
      if (generation) return invalid2("authored builtin identity conflicts with compiler constructor entry");
      generation = constructors3.get(builtin);
      if (!generation) return void 0;
      if (!generation.declaration.canonical || !generation.proof(value2) || canonicalGenerations.some((candidate) => candidate.proof(value2) && !generation.declaration.closure.has(candidate.declaration)))
        return invalid2("authored builtin identity conflicts with canonical constructor proof");
    }
    if (!generation) {
      const candidates = canonicalGenerations.filter((candidate) => candidate.proof(value2));
      if (candidates.length) {
        const prototype = Object.getPrototypeOf(value2);
        generation = candidates.find((candidate) => candidate.prototype === prototype);
        if (!generation) return invalid2("canonical descendant requires its own exact source Class generation");
        if (candidates.some((candidate) => !generation.declaration.closure.has(candidate.declaration)))
          return invalid2("canonical prototype conflicts with private source Class proof");
      } else {
        for (let prototype = Object.getPrototypeOf(value2); prototype; prototype = Object.getPrototypeOf(prototype)) {
          if (prototypes2.has(prototype)) return invalid2("source Class identity requires genuine constructor entry");
        }
      }
    }
  }
  if (!generation) return void 0;
  for (let current = generation; current; current = current.baseGeneration)
    getAS3SourceBase(current.constructor);
  return Object.freeze({
    constructor: generation.constructor,
    name: generation.declaration.token.name,
    baseConstructor: generation.baseGeneration?.constructor ?? null,
    baseName: generation.declaration.base?.token.name ?? "Object"
  });
}

// ../engine/src/layaAir/flash/utils/AS3Type.ts
var sourceArrayConstructor = Array;
var sourceArrayPrototype = Array.prototype;
var classes = /* @__PURE__ */ new WeakMap();
var prototypes3 = /* @__PURE__ */ new WeakMap();
var canonicalInterfaceClasses = [];
var declaredInterfaces = /* @__PURE__ */ new WeakMap();
function as3ReferenceTypeExtends(source, target) {
  if (isAS3DeclarationType(source)) {
    const chain2 = getAS3DeclarationTypeChain(source);
    if (target === Object) return true;
    if (isAS3Interface(target)) return chain2.some((type2) => declaredInterfaces.get(type2)?.has(target) || as3DeclarationImplements(type2, target));
    const type = isAS3DeclarationType(target) ? target : typeof target === "function" ? getAS3DeclarationType(target) : void 0;
    if (!type) return false;
    return chain2.includes(type);
  }
  if (isAS3DeclarationType(target)) {
    const type = typeof source === "function" ? getAS3DeclarationType(source) : void 0;
    return !!type && getAS3DeclarationTypeChain(type).includes(target);
  }
  const sourceInterface = isAS3Interface(source), targetInterface = isAS3Interface(target);
  if (!sourceInterface && typeof source !== "function" || !targetInterface && typeof target !== "function")
    throw new TypeError("Invalid source reference type relation");
  if (sourceInterface) return targetInterface && getAS3InterfaceClosure(source).includes(target);
  const constructor = source, chain = getAS3DeclaredConstructorChain(constructor);
  if (chain) {
    if (targetInterface) return chain.some((owner) => classes.get(owner)?.interfaces.has(target));
    if (target === Object) return true;
    const declaration2 = getAS3DeclarationType(target);
    return chain.some((owner) => declaration2 ? getAS3DeclarationType(owner) === declaration2 : owner === target);
  }
  if (!targetInterface && (source === target || target === Object)) return true;
  const targetPrototype = targetInterface ? null : Object.getOwnPropertyDescriptor(target, "prototype")?.value;
  for (let prototype = Object.getOwnPropertyDescriptor(constructor, "prototype")?.value; prototype && typeof prototype === "object"; prototype = Object.getPrototypeOf(prototype)) {
    const record5 = prototypes3.get(prototype);
    if (getAS3PrototypeDeclarationType(prototype)) {
      return !!record5 && as3ReferenceTypeExtends(record5.constructor, target);
    }
    if (targetInterface ? record5?.interfaces.has(target) : prototype === targetPrototype) return true;
  }
  return false;
}
function registerAS3Class(constructor, implemented) {
  if (typeof constructor !== "function") throw new TypeError("Invalid AS3 source class");
  const prototype = Object.getOwnPropertyDescriptor(constructor, "prototype")?.value;
  if (prototype === null || typeof prototype !== "object") throw new TypeError("Invalid AS3 source class prototype");
  const closure = /* @__PURE__ */ new Set();
  for (const token of implemented) {
    for (const member of getAS3InterfaceClosure(token)) closure.add(member);
  }
  const previous = classes.get(constructor);
  if (previous) {
    if (previous.interfaces.size !== closure.size || [...closure].some((token) => !previous.interfaces.has(token)) || prototypes3.get(prototype) !== previous)
      throw new TypeError("Conflicting AS3 source class publication");
    return;
  }
  if (prototypes3.has(prototype)) throw new TypeError("AS3 source class prototype already registered");
  const declaration2 = getAS3DeclarationType(constructor);
  if (declaration2) {
    const prior = declaredInterfaces.get(declaration2);
    if (prior && (prior.size !== closure.size || [...closure].some((token) => !prior.has(token))))
      throw new TypeError("Conflicting declaration interface publication");
    declaredInterfaces.set(declaration2, closure);
  }
  const record5 = { constructor, interfaces: closure };
  classes.set(constructor, record5);
  prototypes3.set(prototype, record5);
}
function registerCanonicalAS3ReferenceImplementation(constructor, proof, referenceName) {
  const descriptor2 = typeof constructor === "function" && Object.getOwnPropertyDescriptor(constructor, "prototype");
  if (!descriptor2 || descriptor2.writable || descriptor2.configurable || !descriptor2.value || typeof descriptor2.value !== "object" || typeof proof !== "function" || referenceName !== void 0 && (typeof referenceName !== "string" || !referenceName))
    throw new TypeError("Invalid canonical reference provider");
  const previous = classes.get(constructor);
  if (previous?.referenceProof && previous.referenceProof !== proof)
    throw new TypeError("Conflicting canonical reference provider");
  if (previous?.referenceName !== void 0 && previous.referenceName !== referenceName)
    throw new TypeError("Conflicting canonical reference name");
  if (!previous) registerAS3Class(constructor, []);
  classes.get(constructor).referenceProof = proof;
  if (referenceName !== void 0) classes.get(constructor).referenceName = referenceName;
}
function isCanonicalAS3ReferenceImplementation(constructor, name2) {
  const record5 = typeof constructor === "function" ? classes.get(constructor) : void 0;
  return !!record5?.referenceProof && record5.referenceName !== void 0 && record5.referenceName === name2;
}
var AS3Int = Object.freeze({ name: "int" });
var AS3Uint = Object.freeze({ name: "uint" });
var nativeBuiltinClasses = /* @__PURE__ */ new Set([Object, Array, Number, String, Boolean, Function]);
function isSourceFunction(value2) {
  if (typeof value2 !== "function") return false;
  if (nativeBuiltinClasses.has(value2) || describeRegisteredFlashType(value2)?.isStatic) return false;
  const prototype = Object.getOwnPropertyDescriptor(value2, "prototype");
  if (prototype && !prototype.writable)
    throw new TypeError("AS3_FUNCTION_UNSUPPORTED: native class lacks exact source metadata");
  return true;
}
function as3Is(value2, target) {
  if (isAS3DeclarationType(target)) return isAS3DeclaredInstance(value2, target);
  if (typeof target === "function") {
    const declaration2 = getAS3DeclarationType(target);
    if (declaration2) return isAS3DeclaredInstance(value2, declaration2);
    const referenceProof = classes.get(target)?.referenceProof;
    if (referenceProof) return referenceProof(value2);
    const reference = matchSourceStageReference(value2, target);
    if (reference !== void 0) return reference;
  }
  if (target === AS3Int || target === AS3Uint) {
    return typeof value2 === "number" && Number.isInteger(value2) && (target === AS3Int ? value2 >= -2147483648 && value2 <= 2147483647 : value2 >= 0 && value2 <= 4294967295);
  }
  if (isAS3Interface(target)) {
    if (value2 === null || typeof value2 !== "object" && typeof value2 !== "function") return false;
    const entered3 = getAS3EnteredSourceConstructors(value2);
    if (entered3) {
      if (isAS3DeclaredInterface(value2, target)) return true;
      return entered3.some((constructor2) => !isCanonicalAS3DeclarationConstructor(constructor2) && classes.get(constructor2)?.interfaces.has(target));
    }
    if (isAS3DeclaredInterface(value2, target)) return true;
    for (const record5 of canonicalInterfaceClasses) {
      if (record5.interfaceProof.interfaces.has(target) && record5.interfaceProof.proof(value2)) return true;
    }
    for (let prototype = Object.getPrototypeOf(value2); prototype !== null; prototype = Object.getPrototypeOf(prototype)) {
      if (getAS3PrototypeDeclarationType(prototype)) return false;
      const record5 = prototypes3.get(prototype);
      if (!record5) continue;
      if (record5.interfaceProof) return false;
      if (record5.interfaces.has(target)) return true;
    }
    return false;
  }
  if (typeof target !== "function") throw new TypeError("Invalid AS3 type operand");
  const constructor = target;
  if (value2 === null || value2 === void 0) return false;
  if (constructor === Object) return typeof value2 !== "symbol" && typeof value2 !== "bigint";
  if (constructor === Number) return typeof value2 === "number";
  if (constructor === String) return typeof value2 === "string";
  if (constructor === Boolean) return typeof value2 === "boolean";
  if (constructor === Function) return isSourceFunction(value2);
  if (constructor === sourceArrayConstructor && value2 === sourceArrayPrototype) return true;
  return value2 instanceof target;
}
function as3CoerceReference(value2, target) {
  const operand = target;
  if (operand === Number || operand === String || operand === Boolean || operand === AS3Int || operand === AS3Uint || !isAS3Interface(target) && !isAS3DeclarationType(target) && typeof target !== "function") {
    throw new TypeError("Invalid AS3 reference coercion type operand");
  }
  if (value2 === null || value2 === void 0) return null;
  if (as3Is(value2, target)) return value2;
  if (operand === sourceArrayConstructor) throw createAS3ArrayCoercionError();
  if (operand === Function) throw createAS3FunctionCoercionError();
  const declared = isAS3DeclarationType(target) || typeof target === "function" && getAS3DeclarationType(target);
  if (declared || isAS3Interface(target)) throw createAS3DeclaredReferenceCoercionError();
  if (typeof target === "function" && classes.get(target)?.referenceProof)
    throw createAS3CanonicalReferenceCoercionError();
  const error4 = new TypeError("Error #1034: Type Coercion failed.");
  Object.defineProperty(error4, "errorID", { value: 1034 });
  throw error4;
}
function as3CheckArgumentCount(actual, minimum, maximum = Infinity) {
  if (!Number.isInteger(actual) || actual < 0 || !Number.isInteger(minimum) || minimum < 0 || maximum !== Infinity && (!Number.isInteger(maximum) || maximum < minimum))
    throw new TypeError("Invalid AS3 argument count check");
  if (actual >= minimum && actual <= maximum) return;
  throw createAS3ArgumentCountError();
}

// ../engine/src/layaAir/flash/utils/AS3ConversionMethodResolver.ts
var resolver2;
function installAS3SourcePublicConversionResolver(value2) {
  if (typeof value2 !== "function" || resolver2 && resolver2 !== value2)
    throw new TypeError("Conflicting source conversion property authority");
  resolver2 = value2;
}
function resolveAS3SourcePublicConversionMethod(value2, name2) {
  return resolver2?.(value2, name2);
}
var xmlResolver;
function resolveAS3XMLConversionMethod(value2, name2) {
  return xmlResolver?.(value2, name2);
}

// ../engine/src/layaAir/flash/utils/AS3Number.ts
var powersOfTen = [
  1,
  10,
  100,
  1e3,
  1e4,
  1e5,
  1e6,
  1e7,
  1e8,
  1e9,
  1e10,
  1e11,
  1e12,
  1e13,
  1e14,
  1e15,
  1e16,
  1e17,
  1e18,
  1e19,
  1e20,
  1e21,
  1e22
];
var hiddenBit = BigInt(1) << BigInt(52);
var coercionNaNBits = new DataView(new ArrayBuffer(8));
coercionNaNBits.setUint32(0, 2147483647, false);
coercionNaNBits.setUint32(4, 3758096384, false);
function as3NumberNaN() {
  return coercionNaNBits.getFloat64(0, false);
}
function powerOfTen(exponent) {
  if (exponent >= 0 && exponent < 23) return powersOfTen[exponent];
  let base = 10, result = 1, power = Math.abs(exponent);
  while (power > 0) {
    if (power % 2 === 1) result = exponent < 0 ? result / base : result * base;
    power = Math.floor(power / 2);
    base *= base;
  }
  return result;
}
function split(value2) {
  const bytes = new DataView(new ArrayBuffer(8));
  bytes.setFloat64(0, value2);
  const bits = bytes.getBigUint64(0);
  const rawExponent = Number(bits >> BigInt(52) & BigInt(2047));
  let mantissa = bits & hiddenBit - BigInt(1);
  let exponent = rawExponent === 0 ? -1074 : rawExponent - 1075;
  if (rawExponent !== 0) mantissa |= hiddenBit;
  else if (mantissa !== BigInt(0)) {
    while (mantissa < hiddenBit) {
      mantissa <<= BigInt(1);
      exponent--;
    }
  }
  return { mantissa, exponent };
}
function integerFromDouble(value2) {
  if (!Number.isFinite(value2)) return BigInt(1024);
  const { mantissa, exponent } = split(value2);
  return exponent < 0 ? mantissa >> BigInt(-exponent) : mantissa << BigInt(exponent);
}
function integerToDouble(value2) {
  if (value2 === BigInt(0)) return 0;
  const bitLength = value2.toString(2).length;
  const wordCount = Math.ceil(bitLength / 32);
  const word = (index) => value2 >> BigInt(index * 32) & BigInt(4294967295);
  if (wordCount === 1) return Number(value2);
  let nextWord = wordCount - 1, position = 53, bits = bitLength - nextWord * 32;
  let shift = 0, mantissa = BigInt(0), current = BigInt(0);
  while (position > 0) {
    current = word(nextWord--);
    mantissa |= current >> BigInt(shift);
    position -= bits;
    if (position > 0) {
      if (nextWord < 0) break;
      bits = position > 31 ? 32 : position;
      shift = position > 31 ? 0 : 32 - bits;
      mantissa <<= BigInt(bits);
    }
  }
  let roundBit = false, rest = false;
  if (position <= 0) {
    if (bits === 32) {
      if (nextWord >= 0) {
        current = word(nextWord--);
        roundBit = (current & BigInt(2147483648)) !== BigInt(0);
        rest = (current & BigInt(2147483647)) !== BigInt(0);
      }
    } else {
      roundBit = (current & BigInt(1) << BigInt(shift - 1)) !== BigInt(0);
      if (shift > 1) rest = (current & (BigInt(1) << BigInt(shift - 1)) - BigInt(1)) !== BigInt(0);
      if (nextWord >= 0) rest || (rest = word(nextWord--) !== BigInt(0));
    }
  }
  if (roundBit && ((mantissa & BigInt(1)) !== BigInt(0) || rest)) mantissa++;
  const exponent = bitLength - 53;
  return Number(mantissa) * (exponent > 0 ? 2 ** exponent : 1);
}
var DecimalDigits = class {
  constructor(value2) {
    this.finished = false;
    const { mantissa, exponent } = split(value2);
    this.inclusive = (mantissa & BigInt(1)) === BigInt(0);
    if (exponent >= 0) {
      const scale2 = BigInt(1) << BigInt(exponent);
      if (mantissa !== hiddenBit) {
        this.r = integerFromDouble(value2) * BigInt(2);
        this.s = BigInt(2);
        this.plus = this.minus = scale2;
      } else {
        this.r = integerFromDouble(value2 * 4);
        this.s = BigInt(4);
        this.plus = scale2 * BigInt(2);
        this.minus = scale2;
      }
    } else if (mantissa !== hiddenBit) {
      this.r = mantissa * BigInt(2);
      this.s = BigInt(2) << BigInt(-exponent);
      this.plus = this.minus = BigInt(1);
    } else {
      this.r = mantissa * BigInt(4);
      this.s = BigInt(2) << BigInt(1 - exponent);
      this.plus = BigInt(2);
      this.minus = BigInt(1);
    }
    const estimate = Math.ceil((exponent + 52) * 0.3010299956639812 - 1e-10);
    const scale = BigInt(10) ** BigInt(Math.abs(estimate));
    if (estimate >= 0) this.s *= scale;
    else {
      this.r *= scale;
      this.plus *= scale;
      this.minus *= scale;
    }
    if (this.inclusive ? this.r + this.plus >= this.s : this.r + this.plus > this.s)
      this.exponent = estimate + 1;
    else {
      this.r *= BigInt(10);
      this.plus *= BigInt(10);
      this.minus *= BigInt(10);
      this.exponent = estimate;
    }
  }
  next() {
    if (this.finished) return -1;
    let digit2 = Number(this.r / this.s);
    this.r %= this.s;
    const low = this.inclusive ? this.r <= this.minus : this.r < this.minus;
    const high = this.inclusive ? this.r + this.plus >= this.s : this.r + this.plus > this.s;
    if (digit2 < 0 || digit2 > 9) digit2 = 0;
    if (!low && !high) {
      this.r *= BigInt(10);
      this.plus *= BigInt(10);
      this.minus *= BigInt(10);
    } else {
      if (!low || high && this.r * BigInt(2) >= this.s) digit2++;
      this.finished = true;
    }
    return digit2;
  }
};
function as3NumberToString(value2) {
  if (typeof value2 !== "number") throw new TypeError("AS3 numeric formatting requires a number");
  if (Number.isNaN(value2)) return "NaN";
  if (value2 === Infinity) return "Infinity";
  if (value2 === -Infinity) return "-Infinity";
  if (value2 === 0) return "0";
  if (Number.isInteger(value2) && value2 > -2147483648 && value2 <= 2147483647) {
    let integer = Math.abs(value2), text2 = "";
    while (integer > 0) {
      const quotient = Math.floor(integer / 10);
      text2 = String.fromCharCode(48 + integer - quotient * 10) + text2;
      integer = quotient;
    }
    return (value2 < 0 ? "-" : "") + text2;
  }
  const negative = value2 < 0;
  const digits = new DecimalDigits(Math.abs(value2));
  let exponent = digits.exponent - 1, output = "";
  if (exponent < 0 && exponent > -7) {
    output = "00." + "0".repeat(-exponent - 1);
    while (!digits.finished) output += String.fromCharCode(48 + digits.next());
    exponent = 0;
  } else if (exponent > 20) {
    output += String.fromCharCode(48 + digits.next());
    if (!digits.finished) {
      output += ".";
      for (let index = 0; index < 14 && !digits.finished; index++) output += String.fromCharCode(48 + digits.next());
    }
  } else {
    output = "0";
    const first = digits.next();
    if (first > 0) output += String.fromCharCode(48 + first);
    while (exponent > 0) {
      output += String.fromCharCode(48 + (digits.finished ? 0 : digits.next()));
      exponent--;
    }
    if (!digits.finished) {
      output += ".";
      while (!digits.finished) output += String.fromCharCode(48 + digits.next());
    }
  }
  if (exponent !== 0) {
    let first = 0;
    while (first < output.length && output[first] === "0") first++;
    if (first === output.length) {
      output += "1";
      exponent++;
    } else {
      let last = output.length - 1;
      while (last > first && output[last] === "0") last--;
      if (first === last) {
        exponent += output.length - first - 1;
        output = output.slice(0, last + 1);
      }
    }
    output += "e" + (exponent > 0 ? "+" : "") + exponent;
  }
  if (output[0] === "0" && output[1] !== ".") output = output.slice(1);
  return (negative ? "-" : "") + output;
}
function isSpace(code) {
  return code === 32 || code >= 9 && code <= 13 || code >= 8192 && code <= 8203 || code === 8232 || code === 8233 || code === 8287 || code === 12288;
}
function skipSpace(text2, index) {
  while (index < text2.length && isSpace(text2.charCodeAt(index))) index++;
  return index;
}
function digit(code) {
  return code >= 48 && code <= 57;
}
function decimal(text2) {
  let index = skipSpace(text2, 0), negative = false, count = 0, exponent = 0, code = 0;
  if (index >= text2.length) return 0;
  if (text2[index] === "+" || text2[index] === "-") negative = text2[index++] === "-";
  const start = index;
  let length = text2.length;
  while (index < length) {
    code = text2.charCodeAt(index);
    if (digit(code)) {
      count++;
      index++;
    } else {
      if (code === 0) length = index;
      break;
    }
  }
  if (code === 46) {
    while (++index < length) {
      code = text2.charCodeAt(index);
      if (digit(code)) count++;
      else {
        if (code === 0) length = index;
        break;
      }
    }
  }
  if (index < length && (text2[index] === "e" || text2[index] === "E")) {
    let amount = 0, negativeExponent = false;
    index++;
    if (text2[index] === "+" || text2[index] === "-") negativeExponent = text2[index++] === "-";
    if (negativeExponent && index >= length) return null;
    while (index < length) {
      code = text2.charCodeAt(index);
      if (digit(code)) {
        amount = amount * 10 + code - 48 | 0;
        index++;
      } else {
        if (code === 0) length = index;
        break;
      }
    }
    exponent = negativeExponent ? -amount | 0 : amount;
  }
  index = skipSpace(text2, index);
  if (count === 0) {
    if (text2.slice(index, index + 8) !== "Infinity") return null;
    index += 8;
    if (index < length && skipSpace(text2, index) === index) return null;
    return negative ? -Infinity : Infinity;
  }
  if (index < length) return null;
  const limit = index;
  index = start;
  let fraction = -1, exact = BigInt(0), result = 0;
  while (index < limit) {
    code = text2.charCodeAt(index);
    if (!digit(code) && code !== 46) break;
    if (fraction !== -1) fraction++;
    if (code === 46) fraction = 0;
    else if (count > 15) exact = exact * BigInt(10) + BigInt(code - 48);
    else result = result * 10 + code - 48;
    index++;
  }
  if (fraction > 0) exponent = exponent - fraction | 0;
  if (count > 15) {
    if (exponent > 0) {
      const factor = integerFromDouble(powerOfTen(exponent));
      const words = (integer) => Math.ceil(integer.toString(2).length / 32);
      if (words(exact) + words(factor) > 130) return null;
      exact *= factor;
      exponent = 0;
    }
    result = integerToDouble(exact);
  } else if (exponent >= 0) result *= powerOfTen(exponent);
  if (exponent < 0) {
    if (exponent < -307) {
      const difference = exponent + 307;
      result /= powerOfTen(-difference);
      exponent -= difference;
    }
    result /= powerOfTen(-exponent);
  }
  return negative ? -result : result;
}
function integerDigit(code) {
  return digit(code) ? code - 48 : code >= 65 && code <= 90 ? code - 55 : code >= 97 && code <= 122 ? code - 87 : -1;
}
function roundedHexInteger(text2, start) {
  let end = start;
  while (end < text2.length && text2[end] === "0") end++;
  if (end >= text2.length) return 0;
  let next = 0, value2 = 0, result = 0;
  for (; next * 4 <= 52; next++) {
    value2 = integerDigit(text2.charCodeAt(end++));
    if (value2 < 0 || value2 >= 16) {
      value2 = 0;
      break;
    }
    result = result * 16 + value2;
    if (end >= text2.length) break;
  }
  if (next * 4 > 52) {
    const bit53 = (value2 & 1) !== 0;
    let bit54 = false, roundUp = false, factor = 1;
    value2 = integerDigit(text2.charCodeAt(end));
    if (value2 >= 0 && value2 < 16) {
      factor *= 16;
      bit54 = (value2 & 8) !== 0;
      roundUp = (value2 & 3) !== 0;
    } else roundUp = bit53;
    while (++end < text2.length) {
      value2 = integerDigit(text2.charCodeAt(end));
      if (value2 < 0 || value2 >= 16) break;
      roundUp || (roundUp = value2 !== 0);
      factor *= 16;
    }
    result += bit54 && (bit53 || roundUp) ? 1 : 0;
    result *= factor;
  }
  return result;
}
function integerFallback(text2) {
  let index = skipSpace(text2, 0), negative = false;
  if (text2[index] === "+" || text2[index] === "-") negative = text2[index++] === "-";
  let radix = 10;
  if (text2[index] === "0" && (text2[index + 1] === "x" || text2[index + 1] === "X")) {
    radix = 16;
    index += 2;
  }
  const start = index;
  let count = 0, result = 0;
  while (index < text2.length) {
    const number = integerDigit(text2.charCodeAt(index));
    if (number < 0 || number >= radix) break;
    result = result * radix + number;
    count++;
    index++;
  }
  if (count === 0 || skipSpace(text2, index) < text2.length) return as3NumberNaN();
  if (radix === 16 && result >= 9007199254740992) result = roundedHexInteger(text2, start);
  return negative ? -result : result;
}
function as3NumberFromString(text2) {
  if (typeof text2 !== "string") throw new TypeError("AS3 numeric parsing requires a string");
  const value2 = decimal(text2);
  return value2 === null ? integerFallback(text2) : value2;
}

// ../engine/src/layaAir/flash/utils/AS3Coercion.ts
var objectValueOf = Object.prototype.valueOf;
var objectToString = Object.prototype.toString;
var functionToString = Function.prototype.toString;
var builtinClasses = [Object, Function, Number, Array];
function unsupported2(reason) {
  throw new TypeError("AS3_COERCION_UNSUPPORTED: " + reason);
}
function scalar(value2) {
  if (value2 === null) return 0;
  switch (typeof value2) {
    case "undefined":
      return as3NumberNaN();
    case "number":
      return value2;
    case "boolean":
      return value2 ? 1 : 0;
    case "string":
      return as3NumberFromString(value2);
    default:
      return unsupported2("host-only primitive");
  }
}
function primitive(value2) {
  return value2 !== null && typeof value2 !== "object" && typeof value2 !== "function";
}
function method(value2, name2) {
  const xml = resolveAS3XMLConversionMethod(value2, name2);
  if (xml) return xml.method;
  const resolved = resolveAS3SourcePublicConversionMethod(value2, name2);
  if (resolved) return resolved.method;
  if (getAS3BuiltinClassName(value2) !== void 0)
    return name2 === "valueOf" ? objectValueOf : functionToString;
  const metadata = describeRegisteredFlashType(value2);
  if (metadata) {
    const member = [...metadata.variables, ...metadata.accessors, ...metadata.methods].find((member2) => member2.name === name2 && !member2.uri);
    if (member && member.declaredBy !== "Object") {
      if ("access" in member && member.access === "writeonly") {
        const error4 = new ReferenceError("Error #1077");
        Object.defineProperty(error4, "errorID", { value: 1077 });
        throw error4;
      }
      return Reflect.get(value2, name2);
    }
    if (metadata.isDynamic && Object.prototype.hasOwnProperty.call(value2, name2))
      return unsupported2("dynamic class conversion slot lacks public/private authority");
    return name2 === "valueOf" ? objectValueOf : metadata.isStatic ? functionToString : objectToString;
  }
  const prototype = Object.getPrototypeOf(value2);
  if (typeof value2 === "function") {
    const descriptor2 = Object.getOwnPropertyDescriptor(value2, "prototype");
    if (descriptor2 && !descriptor2.writable && !builtinClasses.includes(value2))
      return unsupported2("native class conversion needs exact source metadata");
    if (prototype !== Function.prototype)
      return unsupported2("function prototype needs source binding");
  } else if (prototype !== Object.prototype && !(Array.isArray(value2) && prototype === Array.prototype)) {
    return unsupported2("object conversion needs exact source metadata");
  }
  return Reflect.get(value2, name2);
}
function as3CoerceNumber(value2) {
  return scalar(as3DefaultPrimitive(value2, "number"));
}
function as3DefaultPrimitive(value2, hint) {
  if (value2 === null || primitive(value2)) return sourcePrimitive(value2);
  const reference = value2;
  const firstName = hint === "number" ? "valueOf" : "toString";
  const secondName = hint === "number" ? "toString" : "valueOf";
  const firstMethod = method(reference, firstName);
  const first = firstName === "valueOf" ? as3InvokeValueOfMethod(reference, firstMethod) : as3InvokeToStringMethod(reference, firstMethod);
  if (primitive(first)) return sourcePrimitive(first);
  const secondMethod = method(reference, secondName);
  const second = secondName === "valueOf" ? as3InvokeValueOfMethod(reference, secondMethod) : as3InvokeToStringMethod(reference, secondMethod);
  if (primitive(second)) return sourcePrimitive(second);
  throw createAS3PrimitiveConversionError();
}
function sourcePrimitive(value2) {
  if (value2 === null) return null;
  if (value2 === void 0) return void 0;
  if (typeof value2 === "number" || typeof value2 === "string" || typeof value2 === "boolean") return value2;
  return unsupported2("host-only primitive");
}
function as3CoerceInt(value2) {
  return as3CoerceNumber(value2) | 0;
}
function as3CoerceUint(value2) {
  return as3CoerceNumber(value2) >>> 0;
}
function as3CoerceObject(value2) {
  if (typeof value2 === "symbol" || typeof value2 === "bigint")
    return unsupported2("host-only primitive");
  return value2 === void 0 ? null : value2;
}

// ../engine/src/layaAir/flash/utils/AS3Class.ts
var AS3ClassType = Object.freeze({ name: "Class" });
var builtinClasses2 = /* @__PURE__ */ new Set([
  Object,
  Array,
  Number,
  String,
  Boolean,
  Function,
  AS3Int,
  AS3Uint,
  AS3ClassType
]);
function getAS3BuiltinClassName(value2) {
  if (value2 === AS3ClassType) return "Class";
  if (value2 === AS3Int) return "int";
  if (value2 === AS3Uint) return "uint";
  if (value2 === Object) return "Object";
  if (value2 === Function) return "Function";
  if (value2 === Number) return "Number";
  if (value2 === String) return "String";
  if (value2 === Boolean) return "Boolean";
  if (value2 === Array) return "Array";
  return void 0;
}
var constructors4 = /* @__PURE__ */ new WeakMap();
function unsupported3(reason) {
  throw new TypeError("AS3_CLASS_UNSUPPORTED: " + reason);
}
function sourceError(name2, errorID) {
  const error4 = name2 === "TypeError" ? new TypeError("Error #" + errorID) : new Error("Error #" + errorID);
  error4.name = name2;
  Object.defineProperty(error4, "errorID", { value: errorID });
  throw error4;
}
function as3CallClass(value2, arguments_ = []) {
  const target = as3AsClass(value2);
  if (target === null) return sourceError("TypeError", 1006);
  const args = suppliedArguments(arguments_);
  if (target === Array) return as3CreateArray(args);
  if (target === Object) return args[0] == null ? as3CreateDynamicObject() : args[0];
  if (target === Number) return args.length === 0 ? 0 : as3CoerceNumber(args[0]);
  if (target === String) return args.length === 0 ? "" : as3String(args[0]);
  if (target === Boolean) return args.length === 0 ? false : Boolean(args[0]);
  if (target === AS3Int) return args.length === 0 ? 0 : as3CoerceInt(args[0]);
  if (target === AS3Uint) return args.length === 0 ? 0 : as3CoerceUint(args[0]);
  if (target === Function) {
    if (args.length) return sourceError("EvalError", 1066);
    return function() {
    };
  }
  const canonicalCall = typeof target === "function" ? constructors4.get(target)?.call : void 0;
  if (canonicalCall) return canonicalCall(Object.freeze(args));
  if (args.length !== 1) throw as3CreateArgumentError("Error #1112", 1112);
  if (target === AS3ClassType) return as3CoerceClass(args[0]);
  return as3CoerceReference(args[0], target);
}
function as3AsClass(value2) {
  if (builtinClasses2.has(value2) || isAS3Interface(value2)) return value2;
  if (typeof value2 === "symbol" || typeof value2 === "bigint") return unsupported3("host-only primitive");
  if (typeof value2 !== "function") return null;
  const description = describeRegisteredFlashType(value2);
  if (description?.isStatic) return value2;
  const descriptor2 = Object.getOwnPropertyDescriptor(value2, "prototype");
  if (descriptor2 && !descriptor2.writable) return unsupported3("native class lacks exact source metadata");
  return null;
}
function as3CoerceClass(value2) {
  if (value2 === null || value2 === void 0) return null;
  const result = as3AsClass(value2);
  if (result === null) throw createAS3CanonicalReferenceCoercionError();
  return result;
}
function registerAS3Constructor(constructor, context2) {
  if (typeof constructor !== "function" || !describeRegisteredFlashType(constructor)?.isStatic)
    return unsupported3("constructor registration requires exact source class metadata");
  if (context2?.call !== void 0 && !isCanonicalAS3DeclarationConstructor(constructor))
    return unsupported3("builtin Class call requires a canonical declaration");
  if (!context2 || !Number.isSafeInteger(context2.minimum) || context2.minimum < 0 || context2.maximum !== Infinity && (!Number.isSafeInteger(context2.maximum) || context2.maximum < context2.minimum) || typeof context2.coerceArguments !== "function" || context2.call !== void 0 && typeof context2.call !== "function" || context2.withAllocationContext !== void 0 && typeof context2.withAllocationContext !== "function")
    throw new TypeError("Invalid source constructor signature");
  const previous = constructors4.get(constructor);
  if (previous) {
    if (previous.minimum !== context2.minimum || previous.maximum !== context2.maximum || previous.coerceArguments !== context2.coerceArguments || previous.call !== context2.call || previous.withAllocationContext !== context2.withAllocationContext)
      throw new TypeError("Conflicting source constructor signature");
    return;
  }
  constructors4.set(constructor, Object.freeze({
    minimum: context2.minimum,
    maximum: context2.maximum,
    coerceArguments: context2.coerceArguments,
    call: context2.call,
    withAllocationContext: context2.withAllocationContext
  }));
}
function suppliedArguments(value2) {
  if (!Array.isArray(value2) || Object.getPrototypeOf(value2) !== Array.prototype)
    return unsupported3("constructor arguments require an ordinary compiler argument list");
  const result = [];
  for (let index = 0; index < value2.length; index++) {
    const item = Object.getOwnPropertyDescriptor(value2, String(index));
    if (!item || !("value" in item)) return unsupported3("constructor argument list must contain dense data slots");
    result.push(item.value);
  }
  return result;
}
function as3ConstructClass(value2, arguments_ = [], scriptGlobal) {
  const constructor = as3AsClass(value2);
  if (constructor === null) throw createAS3ConstructionError(1007);
  if (constructor === AS3ClassType) throw createAS3ConstructionError(1115);
  if (isAS3Interface(constructor)) throw createAS3InterfaceConstructionError(constructor.name);
  if (builtinClasses2.has(constructor)) return as3CallClass(constructor, arguments_);
  if (typeof constructor !== "function") return unsupported3("invalid constructor representation");
  const context2 = constructors4.get(constructor);
  if (!context2) return unsupported3("source class lacks a proven constructor context");
  const supplied = suppliedArguments(arguments_);
  if (supplied.length < context2.minimum || supplied.length > context2.maximum)
    throw createAS3ArgumentCountError();
  const coerced = suppliedArguments(context2.coerceArguments(Object.freeze(supplied)));
  if (coerced.length !== supplied.length) return unsupported3("constructor prefix changed source argument count");
  if (scriptGlobal !== void 0) {
    const chain = getAS3DeclaredConstructorChain(constructor) ?? [constructor];
    const policy = chain.map((owner) => constructors4.get(owner)?.withAllocationContext).find((value3) => value3 !== void 0);
    if (policy) return policy(scriptGlobal, () => Reflect.construct(constructor, coerced));
  }
  return Reflect.construct(constructor, coerced);
}

// ../engine/src/layaAir/flash/utils/AS3String.ts
var objectToString2 = Object.prototype.toString;
var functionToString2 = Function.prototype.toString;
var numberToString = Number.prototype.toString;
var stringToString = String.prototype.toString;
var booleanToString = Boolean.prototype.toString;
var arrayToString = Array.prototype.toString;
var arrayJoin = Array.prototype.join;
var intrinsicToStrings = [
  objectToString2,
  functionToString2,
  numberToString,
  stringToString,
  booleanToString,
  arrayToString
];
var builtinClasses3 = /* @__PURE__ */ new Map([
  [Object, "Object"],
  [Function, "Function"],
  [Number, "Number"],
  [Array, "Array"]
]);
var convertingArrays = /* @__PURE__ */ new Set();
function typeError(errorID) {
  const error4 = new TypeError("Error #" + errorID);
  Object.defineProperty(error4, "errorID", { value: errorID });
  throw error4;
}
function unsupported4(message) {
  throw new TypeError("AS3_STRING_UNSUPPORTED: " + message);
}
function primitive2(value2) {
  return value2 !== null && typeof value2 !== "object" && typeof value2 !== "function";
}
function scalar2(value2) {
  switch (typeof value2) {
    case "undefined":
      return "undefined";
    case "string":
      return value2;
    case "boolean":
      return value2 ? "true" : "false";
    case "number":
      return as3NumberToString(value2);
    default:
      return unsupported4("value has no source scalar representation");
  }
}
function registeredLabel(value2) {
  const metadata = describeRegisteredFlashType(value2);
  if (!metadata) return null;
  const local = metadata.name.split(/::|\./).pop();
  return "[" + (metadata.isStatic ? "class " : "object ") + local + "]";
}
function defaultFunctionString(value2) {
  const builtin = builtinClasses3.get(value2);
  if (builtin) return "[class " + builtin + "]";
  const label = registeredLabel(value2);
  if (label !== null) return label;
  const prototype = Object.getOwnPropertyDescriptor(value2, "prototype");
  if (prototype && !prototype.writable)
    return unsupported4("native class requires exact source metadata");
  return "function Function() {}";
}
function defaultObjectString(value2) {
  const label = registeredLabel(value2);
  if (label !== null) return label;
  if (Object.getPrototypeOf(value2) === Object.prototype) return "[object Object]";
  return unsupported4("object prototype requires exact source metadata");
}
function defaultArrayString(value2) {
  if (value2.join !== arrayJoin) return unsupported4("custom Array.join requires source method binding");
  return as3ArrayToString(value2);
}
function as3ArrayToString(value2) {
  if (convertingArrays.has(value2)) return unsupported4("cyclic Array conversion has no captured authority");
  convertingArrays.add(value2);
  try {
    const parts = [];
    const length = value2.length;
    for (let index = 0; index < length; index++) {
      const item = value2[index];
      parts.push(item == null ? "" : as3String(item));
    }
    return parts.join(",");
  } finally {
    convertingArrays.delete(value2);
  }
}
function as3InvokeToStringMethod(value2, method2) {
  if (value2 === null) return typeError(1009);
  if (value2 === void 0) return typeError(1010);
  if (typeof value2 === "symbol" || typeof value2 === "bigint")
    return unsupported4("host-only primitive");
  if (as3AsClass(method2) !== null) return as3CallClass(method2, []);
  if (typeof method2 !== "function") return typeError(1006);
  if (method2 === numberToString && typeof value2 === "number") return as3NumberToString(value2);
  if (method2 === stringToString && typeof value2 === "string") return value2;
  if (method2 === booleanToString && typeof value2 === "boolean") return value2 ? "true" : "false";
  if (method2 === functionToString2) {
    const builtin = getAS3BuiltinClassName(value2);
    if (builtin !== void 0) return "[class " + builtin + "]";
    if (typeof value2 === "function") return defaultFunctionString(value2);
  }
  if (method2 === objectToString2 && typeof value2 === "object") return defaultObjectString(value2);
  if (method2 === arrayToString && Array.isArray(value2)) return defaultArrayString(value2);
  if (intrinsicToStrings.includes(method2))
    return unsupported4("borrowed intrinsic toString requires source receiver evidence");
  return Reflect.apply(method2, value2, []);
}
function as3InvokeValueOfMethod(value2, method2) {
  if (as3AsClass(method2) !== null) return as3CallClass(method2, []);
  if (typeof method2 !== "function") return typeError(1006);
  return Reflect.apply(method2, value2, []);
}
function as3String(value2) {
  if (value2 === null) return "null";
  if (primitive2(value2)) return scalar2(value2);
  const selected = resolveAS3SourcePublicConversionMethod(value2, "toString");
  const toStringMethod = selected ? selected.method : getAS3BuiltinClassName(value2) !== void 0 ? functionToString2 : value2.toString;
  const first = as3InvokeToStringMethod(value2, toStringMethod);
  if (first === null && hasAS3StringReturn(toStringMethod)) return "null";
  if (primitive2(first)) return scalar2(first);
  const resolved = resolveAS3SourcePublicConversionMethod(value2, "valueOf");
  const method2 = resolved ? resolved.method : getAS3BuiltinClassName(value2) !== void 0 ? Object.prototype.valueOf : value2.valueOf;
  const second = as3InvokeValueOfMethod(value2, method2);
  if (primitive2(second)) return scalar2(second);
  throw createAS3StringConversionError();
}
function as3CoerceString(value2) {
  return value2 == null ? null : as3String(value2);
}

// ../engine/src/layaAir/flash/errors/AS3SourceError.ts
var values = /* @__PURE__ */ new WeakMap();
var prototypes4 = /* @__PURE__ */ new Map();
var NativeError = Error;
var NativeRangeError = RangeError;
var NativeTypeError = TypeError;
var NativeReferenceError = ReferenceError;
var NativeSyntaxError = SyntaxError;
var fields = /* @__PURE__ */ new Set(["name", "message", "errorID"]);
var generatedErrors = /* @__PURE__ */ new WeakMap();
var AS3Error = class _AS3Error extends NativeError {
  constructor(message, id) {
    super();
    if (new.target === AS3IOError || new.target === AS3IllegalOperationError) return;
    if (new.target !== _AS3Error) return unsupported5("derived Error requires compiler constructor entry");
    if (arguments.length > 2) throw createAS3ArgumentCountError();
    return construct("Error", arguments.length ? message : "", arguments.length > 1 ? id : 0);
  }
  get errorID() {
    const state3 = generatedErrors.get(this);
    if (!state3) return unsupported5("Error accessor requires native constructor entry");
    return state3.id;
  }
  getStackTrace() {
    return unsupported5("source stack trace requires qualification");
  }
};
var AS3IOError = class _AS3IOError extends AS3Error {
  constructor(message, id) {
    super();
    if (new.target !== _AS3IOError) return unsupported5("derived IOError requires qualified constructor entry");
    if (arguments.length > 2) throw createAS3ArgumentCountError();
    return construct("IOError", as3CoerceString(arguments.length ? message : ""), arguments.length > 1 ? id : 0);
  }
};
function as3IsSourceIOErrorInstance(value2) {
  return as3IsSourceErrorInstance(value2) && (values.get(value2)?.kind === "IOError" || values.get(value2)?.kind === "EOFError");
}
function as3IsSourceEOFErrorInstance(value2) {
  return as3IsSourceErrorInstance(value2) && values.get(value2)?.kind === "EOFError";
}
function as3IsSourceSecurityErrorInstance(value2) {
  return as3IsSourceErrorInstance(value2) && values.get(value2)?.kind === "SecurityError";
}
var AS3IllegalOperationError = class _AS3IllegalOperationError extends AS3Error {
  constructor(message, id) {
    super();
    if (new.target !== _AS3IllegalOperationError) return unsupported5("derived IllegalOperationError requires qualified constructor entry");
    if (arguments.length > 2) throw createAS3ArgumentCountError();
    return construct("IllegalOperationError", as3CoerceString(arguments.length ? message : ""), arguments.length > 1 ? id : 0);
  }
};
function as3IsSourceIllegalOperationErrorInstance(value2) {
  return as3IsSourceErrorInstance(value2) && values.get(value2)?.kind === "IllegalOperationError";
}
function generatedReceiver(receiver3) {
  const chain = getAS3EnteredSourceConstructors(receiver3);
  if (!chain || chain.length < 2 || !chain.includes(AS3Error))
    return unsupported5("generated Error constructor entry required");
}
function generatedField(receiver3, name2, value2) {
  const field = Object.getOwnPropertyDescriptor(receiver3, name2);
  if (!field || field.configurable || field.enumerable || !field.get || !field.set)
    return unsupported5("generated Error variable storage required");
  field.set.call(receiver3, value2);
}
function prepareGeneratedAS3Error(receiver3) {
  generatedReceiver(receiver3);
  if (generatedErrors.has(receiver3)) return unsupported5("Error instance already prepared");
  generatedField(receiver3, "name", null);
  generatedField(receiver3, "message", null);
  generatedErrors.set(receiver3, { id: 0, attempted: false });
}
function initializeGeneratedAS3Error(receiver3, args) {
  generatedReceiver(receiver3);
  const state3 = generatedErrors.get(receiver3);
  if (!state3 || state3.attempted) return unsupported5("prepared unentered Error base required");
  state3.attempted = true;
  if (!Array.isArray(args) || Object.getPrototypeOf(args) !== Array.prototype)
    return unsupported5("compiler argument list required");
  const input = [];
  for (let index = 0; index < args.length; index++) {
    const slot = Object.getOwnPropertyDescriptor(args, String(index));
    if (!slot || !("value" in slot)) return unsupported5("dense data arguments required");
    input.push(slot.value);
  }
  if (input.length > 2) throw createAS3ArgumentCountError();
  const id = as3CoerceInt(input.length > 1 ? input[1] : 0);
  const name2 = sourceErrorField(getAS3SourceErrorPrototype(), "name").value;
  generatedField(receiver3, "message", input.length ? input[0] : "");
  generatedField(receiver3, "name", name2);
  state3.id = id;
}
function unsupported5(reason) {
  throw new NativeTypeError("AS3_ERROR_UNSUPPORTED: " + reason);
}
function record(value2) {
  const found = values.get(value2);
  if (!found) return unsupported5("unissued instance");
  for (const name2 of found.fixed ? fields : []) {
    const descriptor2 = Object.getOwnPropertyDescriptor(value2, name2);
    if (!descriptor2 || !("value" in descriptor2) || descriptor2.configurable || descriptor2.enumerable || descriptor2.writable !== (name2 !== "errorID") || name2 === "errorID" && descriptor2.value !== found.id)
      return unsupported5("native field descriptor changed");
  }
  return found;
}
function issue(kind, message, id, name2, parent) {
  const value2 = kind === "TypeError" ? new NativeTypeError() : kind === "RangeError" ? new NativeRangeError() : kind === "ReferenceError" ? new NativeReferenceError() : kind === "SyntaxError" ? new NativeSyntaxError() : new NativeError();
  if (kind === "Error") Object.setPrototypeOf(value2, AS3Error.prototype);
  if (kind === "IOError" || kind === "EOFError") Object.setPrototypeOf(value2, AS3IOError.prototype);
  if (kind === "IllegalOperationError") Object.setPrototypeOf(value2, AS3IllegalOperationError.prototype);
  Object.defineProperties(value2, {
    name: { value: name2, writable: true, configurable: false, enumerable: false },
    message: { value: message, writable: true, configurable: false, enumerable: false },
    errorID: { value: id, writable: false, configurable: false, enumerable: false }
  });
  values.set(value2, { value: value2, kind, fixed: true, id, parent, slots: /* @__PURE__ */ new Map(), hidden: /* @__PURE__ */ new Set() });
  return value2;
}
function getAS3SourceErrorPrototype(kind = "Error") {
  if (kind !== "Error" && kind !== "TypeError" && kind !== "ReferenceError" && kind !== "ArgumentError" && kind !== "SecurityError" && kind !== "SyntaxError" && kind !== "IOError" && kind !== "IllegalOperationError" && kind !== "EOFError" && kind !== "RangeError" && kind !== "VerifyError")
    return unsupported5("prototype kind");
  let value2 = prototypes4.get(kind);
  if (!value2) {
    if (kind === "Error") value2 = issue(kind, "Error", 0, kind, null);
    else {
      const parent = getAS3SourceErrorPrototype(kind === "EOFError" ? "IOError" : "Error");
      value2 = /* @__PURE__ */ Object.create(null);
      values.set(value2, { value: value2, kind: null, fixed: false, id: 0, parent, slots: /* @__PURE__ */ new Map([["name", kind]]), hidden: /* @__PURE__ */ new Set() });
    }
    prototypes4.set(kind, value2);
  }
  return value2;
}
function construct(kind, message, id) {
  const number = as3CoerceInt(id), prototype = getAS3SourceErrorPrototype(kind);
  const namePrototype = kind === "IOError" || kind === "IllegalOperationError" || kind === "EOFError" ? getAS3SourceErrorPrototype() : prototype;
  const field = sourceErrorField(namePrototype, "name");
  const name2 = field ? field.value : sourceErrorDynamic(namePrototype, "name")?.value;
  return issue(kind, message, number, name2, prototype);
}
function createAS3ConstructionError(code) {
  if (code === 1007) return construct("TypeError", "Error #1007: Instantiation attempted on a non-constructor.", code);
  if (code === 1115) return construct("TypeError", "Error #1115: Class$ is not a constructor.", code);
  return unsupported5("construction error code");
}
function createAS3InterfaceConstructionError(name2) {
  if (typeof name2 !== "string" || !name2) return unsupported5("interface diagnostic name");
  return construct("VerifyError", `Error #1001: The method ${name2}() is not implemented.`, 1001);
}
function createAS3MethodConstructionError(name2) {
  if (typeof name2 !== "string" || !name2) return unsupported5("method diagnostic name");
  return construct("TypeError", `Error #1064: Cannot call method ${name2}() as constructor.`, 1064);
}
function as3CreateError(message, id) {
  if (arguments.length > 2) throw construct("ArgumentError", "Error #1063", 1063);
  return construct("Error", arguments.length ? message : "", arguments.length > 1 ? id : 0);
}
function as3CreateArgumentError(message, id) {
  if (arguments.length > 2) throw construct("ArgumentError", "Error #1063", 1063);
  return construct("ArgumentError", arguments.length ? message : "", arguments.length > 1 ? id : 0);
}
function as3CreateReferenceError(message, id) {
  if (arguments.length > 2) throw construct("ArgumentError", "Error #1063", 1063);
  return construct("ReferenceError", arguments.length ? message : "", arguments.length > 1 ? id : 0);
}
function as3CreateRangeError(message, id) {
  if (arguments.length > 2) throw construct("ArgumentError", "Error #1063", 1063);
  return construct("RangeError", arguments.length ? message : "", arguments.length > 1 ? id : 0);
}
function createAS3FullscreenSecurityError() {
  return construct("SecurityError", "Error #2152", 2152);
}
function createAS3ArrayCoercionError() {
  return construct("TypeError", "Error #1034", 1034);
}
function createAS3FunctionCoercionError() {
  return construct("TypeError", "Error #1034", 1034);
}
function createAS3TweenHandleCoercionError() {
  return construct("TypeError", "Error #1034", 1034);
}
function createAS3DeclaredReferenceCoercionError() {
  return construct("TypeError", "Error #1034:", 1034);
}
function createAS3VectorCoercionError() {
  return construct("TypeError", "Error #1034", 1034);
}
function createAS3DisplayCoordinateArgumentError(method2, code, actual = 0) {
  if (code === 2004) return construct("ArgumentError", "Error #2004: One of the parameters is invalid.", 2004);
  if (code === 1063) return construct("ArgumentError", `Error #1063: Argument count mismatch on flash.display::DisplayObject/${method2}(). Expected 1, got ${actual}.`, 1063);
  if (code === 2007) return construct("TypeError", `Error #2007: Parameter ${method2 === "local3DToGlobal" ? "position" : "point"} must be non-null.`, 2007);
  return construct("TypeError", "Error #1034", 1034);
}
function createAS3VectorFixedError() {
  return construct("RangeError", "Error #1126: Cannot change the length of a fixed Vector.", 1126);
}
function createAS3ArgumentCountError() {
  return construct("ArgumentError", "Error #1063", 1063);
}
function createAS3ShaderArgumentError(code) {
  return construct(code === 2007 ? "TypeError" : "ArgumentError", "Error #" + code, code);
}
function createAS3StringConversionError() {
  return construct("TypeError", "Error #1050", 1050);
}
function createAS3PrimitiveConversionError() {
  return construct("TypeError", "Error #1050", 1050);
}
function createAS3EventListenerArgumentError() {
  return construct("TypeError", "Error #2007", 2007);
}
function createAS3StagePointArgumentError(nullish) {
  if (typeof nullish !== "boolean") return unsupported5("Stage Point argument failure kind");
  return nullish ? construct("TypeError", "Error #2007", 2007) : construct("TypeError", "Error #1034", 1034);
}
function createAS3BitmapDataMergeError(code) {
  if (code !== 1034 && code !== 2007 && code !== 2015) return unsupported5("BitmapData.merge error code");
  return construct(code === 2015 ? "ArgumentError" : "TypeError", `Error #${code}`, code);
}
function createAS3DisplayChildOwnershipError() {
  return construct("ArgumentError", "Error #2025", 2025);
}
function createAS3ErrorReadonlyFailure() {
  return construct("ReferenceError", "Error #1074", 1074);
}
function createAS3CompressedSoundError(code) {
  if (code !== 2007 && code !== 2084 && code !== 2030 && code !== 2068) return unsupported5("compressed Sound error code");
  return construct(code === 2007 ? "TypeError" : code === 2084 || code === 2068 ? "ArgumentError" : "Error", `Error #${code}`, code);
}
function createAS3URLStreamClosedError() {
  return construct("IOError", "Error #2029: This URLStream object does not have a stream opened.", 2029);
}
function createAS3SoundLoadError(code) {
  if (code !== 2029 && code !== 2037) return unsupported5("Sound load error code");
  return code === 2029 ? construct("IOError", "Error #2029: This URLStream object does not have a stream opened.", code) : construct("IllegalOperationError", "Error #2037: Functions called in incorrect sequence, or earlier call was unsuccessful.", code);
}
function createAS3XMLParseError(code) {
  if (![1083, 1085, 1088, 1090, 1091, 1093, 1094, 1095, 1097, 1104].includes(code)) return unsupported5("XML parse error code");
  return construct("TypeError", `Error #${code}`, code);
}
function createAS3StyleSheetArgumentError() {
  return construct("ArgumentError", "Error #2008: Parameter align must be one of the accepted values.", 2008);
}
function createAS3TextFieldStyleError(code) {
  return construct(code === 2007 ? "TypeError" : "Error", "Error #" + code, code);
}
function createAS3PropertyError(name2, code) {
  const allowed = name2 === "TypeError" ? [1009, 1010] : name2 === "ReferenceError" ? [1037, 1056, 1069, 1074, 1077] : [];
  if (!allowed.includes(code)) return unsupported5("property error code/kind");
  const message = code === 1009 ? "Error #1009: Cannot access a property or method of a null object reference." : code === 1010 ? "Error #1010: A term is undefined and has no properties." : "Error #" + code;
  return construct(name2, message, code);
}
function createAS3NamedCallError(name2) {
  if (typeof name2 !== "string") return unsupported5("named call diagnostic");
  return construct("TypeError", "Error #1006: " + name2 + " is not a function.", 1006);
}
function createAS3PrimitivePropertyError(name2, type) {
  if (typeof name2 !== "string" || !["String", "Number", "Boolean"].includes(type)) return unsupported5("primitive property diagnostic");
  return construct("ReferenceError", "Error #1069: Property " + name2 + " not found on " + type + " and there is no default value.", 1069);
}
function createAS3PrimitiveWriteError(name2, type, code) {
  if (typeof name2 !== "string" || !["String", "Number", "Boolean"].includes(type)) return unsupported5("primitive write diagnostic");
  if (code === 1037) return construct("ReferenceError", `Error #1037: Cannot assign to a method ${name2} on ${type}.`, code);
  if (code === 1056) return construct("ReferenceError", `Error #1056: Cannot create property ${name2} on ${type}.`, code);
  if (code === 1074) return construct("ReferenceError", `Error #1074: Illegal write to read-only property ${name2} on ${type}.`, code);
  return unsupported5("primitive write error code");
}
function as3IsSourceErrorInstance(value2) {
  if (value2 === null || typeof value2 !== "object" && typeof value2 !== "function") return false;
  if (generatedErrors.has(value2)) return true;
  const found = values.get(value2);
  return !!found && found.fixed && !!record(value2);
}
function as3IsSourceTypeErrorInstance(value2) {
  return as3IsSourceErrorInstance(value2) && getAS3SourceErrorClassName(value2) === "TypeError";
}
function isAS3SourceError(value2) {
  return value2 !== null && typeof value2 === "object" && values.has(value2);
}
function getAS3SourceErrorClassName(value2) {
  if (value2 === AS3Error) return "Error";
  if (as3IsSourceEOFErrorInstance(value2)) return "flash.errors::EOFError";
  if (value2 === AS3IOError || as3IsSourceIOErrorInstance(value2)) return "flash.errors::IOError";
  if (value2 === AS3IllegalOperationError || as3IsSourceIllegalOperationErrorInstance(value2)) return "flash.errors::IllegalOperationError";
  return value2 !== null && typeof value2 === "object" ? values.get(value2)?.kind ?? null : null;
}
function createAS3URLStreamError(code, parameter) {
  if (code === 2029) return construct("Error", "Error #2029: This URLStream object does not have a stream opened.", code);
  if (code === 2030) return construct("Error", "Error #2030: End of file was encountered.", code);
  if (code === 2007) return construct("TypeError", "Error #2007: Parameter request must be non-null.", code);
  if (code === 2008 && (parameter === "type" || parameter === "objectEncoding"))
    return construct("ArgumentError", `Error #2008: Parameter ${parameter} must be one of the accepted values.`, code);
  return unsupported5("URLStream error code");
}
function createAS3ByteArrayReadError(code) {
  if (code !== 2007 && code !== 2030) return unsupported5("ByteArray read error code");
  return construct(code === 2007 ? "TypeError" : "EOFError", `Error #${code}`, code);
}
function createAS3ByteArrayDecompressionError(code) {
  if (code === 2007) return construct("TypeError", "Error #2007: Parameter algorithm must be non-null.", 2007);
  if (code === 2058) return construct("Error", "Error #2058: There was an error decompressing the data.", 2058);
  return unsupported5("ByteArray decompression error code");
}
function createAS3ByteArrayDecompressionArityError(method2, count) {
  if (!["inflate", "uncompress", "compress", "deflate"].includes(method2) || !Number.isInteger(count) || count <= (method2 === "inflate" || method2 === "deflate" ? 0 : 1))
    return unsupported5("ByteArray decompression arity");
  return construct("ArgumentError", `Error #1063: Argument count mismatch on flash.utils::ByteArray/${method2}(). Expected 0, got ${count}.`, 1063);
}
function sourceErrorField(value2, name2) {
  const r = record(value2);
  return r.fixed && fields.has(name2) ? { value: Object.getOwnPropertyDescriptor(r.value, name2).value } : void 0;
}
function setSourceErrorField(value2, name2, input) {
  const r = record(value2);
  if (!r.fixed || !fields.has(name2)) return false;
  if (name2 === "errorID") throw createAS3ErrorReadonlyFailure();
  Object.defineProperty(r.value, name2, { value: input });
  return true;
}
function sourceErrorDynamic(value2, name2) {
  const r = record(value2);
  return r.slots.has(name2) ? { value: r.slots.get(name2) } : void 0;
}
function setSourceErrorDynamic(value2, name2, input) {
  record(value2).slots.set(name2, input);
}
function deleteSourceErrorDynamic(value2, name2) {
  const r = record(value2);
  if (r.fixed && fields.has(name2)) return false;
  r.slots.delete(name2);
  r.hidden.delete(name2);
  return true;
}
function sourceErrorParent(value2) {
  return record(value2).parent;
}
function sourceErrorEnumerable(value2, name2) {
  const r = record(value2);
  return r.slots.has(name2) && !r.hidden.has(name2);
}
function setSourceErrorEnumerable(value2, name2, flag) {
  const r = record(value2);
  if (r.slots.has(name2)) {
    if (flag) r.hidden.delete(name2);
    else r.hidden.add(name2);
  }
}
function as3SourceErrorEnumerableKeys(value2) {
  const r = record(value2);
  return Object.freeze([...r.slots.keys()].filter((key3) => !r.hidden.has(key3)));
}
function createAS3SecurityDomainConstructionError() {
  return construct("ArgumentError", "Error #2012", 2012);
}
function createAS3CanonicalReferenceCoercionError() {
  return construct("TypeError", "Error #1034", 1034);
}
function sourceErrorObjectTag(value2) {
  return "[object " + (record(value2).kind ?? "Object") + "]";
}
function createAS3JSONSyntaxError() {
  return construct("SyntaxError", "Error #1132", 1132);
}
function as3IsSourceSyntaxErrorInstance(value2) {
  return as3IsSourceErrorInstance(value2) && values.get(value2)?.kind === "SyntaxError";
}
function createAS3ApplicationDomainNameError() {
  return construct("TypeError", "Error #2007: Parameter definitionName must be non-null.", 2007);
}
function createAS3SharedObjectPropertyNameError() {
  return construct("TypeError", "Error #2007", 2007);
}
function createAS3DisplayNameNullError() {
  return construct("TypeError", "Error #2007", 2007);
}
function createAS3TimelineNameError() {
  return construct("Error", "Error #2078", 2078);
}
function createAS3DisplayTransformNullError() {
  return construct("TypeError", "Error #2007", 2007);
}
function createAS3ColorTransformNullError() {
  return construct("TypeError", "Error #2007", 2007);
}
function createAS3StageTransformAssignmentError() {
  return construct("Error", "Error #2071", 2071);
}
function createAS3AccessibilityImplementationError(code) {
  return construct("Error", code === 2143 ? "Error #2143: AccessibilityImplementation.get_accRole() must be overridden from its default." : "Error #" + code, code);
}
function createAS3DisplayMetadataArgumentError() {
  return construct("TypeError", "Error #2004: One of the parameters is invalid.", 2004);
}
function createAS3SoundTransformNullError() {
  return construct("TypeError", "Error #2007", 2007);
}
function createAS3Matrix3DRecompositionError(code) {
  return construct(code === 2004 ? "ArgumentError" : code === 2007 ? "TypeError" : "Error", "Error #" + code, code);
}
function createAS3Matrix3DScaleError() {
  return construct("ArgumentError", "Error #2183", 2183);
}
function createAS3DisplayMatrix3DError(code) {
  return construct("ArgumentError", "Error #" + code, code);
}
function createAS3PerspectiveProjectionError(code) {
  return construct(code === 2007 ? "TypeError" : "ArgumentError", "Error #" + code, code);
}
function createAS3URLVariablesDecodeError() {
  return construct("Error", "Error #2101", 2101);
}
function createAS3ExternalInterfaceUnavailableError() {
  return construct("Error", "Error #2067: The ExternalInterface is not available in this container. ExternalInterface requires Internet Explorer ActiveX, Firefox, Mozilla 1.7.5 and greater, or other browsers that support NPRuntime.", 2067);
}
function createAS3TextRunRangeError() {
  return construct("ArgumentError", "Error #2005", 2005);
}
function createAS3TextSnapshotError(code) {
  return construct(code === 2012 ? "ArgumentError" : "TypeError", "Error #" + code, code);
}
function createAS3TextFormatRangeError() {
  return construct("RangeError", "Error #2006", 2006);
}
function createAS3RichTextError(code) {
  return construct(code === 1034 ? "TypeError" : "Error", "Error #" + code, code);
}
function createAS3ArraySortCoercionError(spelling, target) {
  return construct("TypeError", "Error #1034: Type Coercion failed: cannot convert " + spelling + " to " + target + ".", 1034);
}
function createAS3TabStopError(code, parameter) {
  if (code === 2004 && parameter === void 0)
    return construct("ArgumentError", "Error #2004: One of the parameters is invalid.", code);
  if (code === 2007 && (parameter === "alignment" || parameter === "decimalAlignmentToken"))
    return construct("TypeError", "Error #2007: Parameter " + parameter + " must be non-null.", code);
  if (code === 2008 && parameter === "alignment")
    return construct("ArgumentError", "Error #2008: Parameter alignment must be one of the accepted values.", code);
  return unsupported5("TabStop validation error");
}
function createAS3ContentElementError(code) {
  if (code === 2004) return construct("ArgumentError", "Error #2004: One of the parameters is invalid.", code);
  if (code === 2006) return construct("RangeError", "Error #2006: The supplied index is out of bounds.", code);
  if (code === 2007) return construct("TypeError", "Error #2007: Parameter textRotation must be non-null.", code);
  if (code === 2008) return construct("ArgumentError", "Error #2008: Parameter textRotation must be one of the accepted values.", code);
  if (code === 2012) return construct("ArgumentError", "Error #2012: ContentElement class cannot be instantiated.", code);
  return unsupported5("ContentElement validation error");
}
function createAS3TextLineError(code) {
  if (code === 2012) return construct("ArgumentError", "Error #2012: TextLine$ class cannot be instantiated.", code);
  if (code === 2007) return construct("TypeError", "Error #2007: Parameter validity must be non-null.", code);
  return construct("ArgumentError", "Error #2008: Parameter validity must be one of the accepted values.", code);
}
function createAS3ElementFormatError(code, parameter) {
  if (code === 2184 && parameter === void 0)
    return construct("Error", "Error #2184: The ElementFormat object is locked and cannot be modified.", code);
  if (code === 2004 && parameter === void 0)
    return construct("ArgumentError", "Error #2004: One of the parameters is invalid.", code);
  const properties = ["fontDescription", "textRotation", "dominantBaseline", "alignmentBaseline", "kerning", "locale", "breakOpportunity", "digitCase", "digitWidth", "ligatureLevel", "typographicCase"];
  if (properties.includes(parameter) && code === 2007)
    return construct("TypeError", "Error #2007: Parameter " + parameter + " must be non-null.", code);
  if (properties.includes(parameter) && parameter !== "fontDescription" && parameter !== "locale" && code === 2008)
    return construct("ArgumentError", "Error #2008: Parameter " + parameter + " must be one of the accepted values.", code);
  return unsupported5("ElementFormat validation error");
}
function createAS3FontDescriptionError(code, parameter) {
  if (code === 2185 && parameter === void 0)
    return construct("Error", "Error #2185: The FontDescription object is locked and cannot be modified.", code);
  const properties = ["fontName", "fontWeight", "fontPosture", "fontLookup", "renderingMode", "cffHinting"];
  if (properties.includes(parameter) && code === 2007)
    return construct("TypeError", "Error #2007: Parameter " + parameter + " must be non-null.", code);
  if (properties.includes(parameter) && parameter !== "fontName" && code === 2008)
    return construct("ArgumentError", "Error #2008: Parameter " + parameter + " must be one of the accepted values.", code);
  return unsupported5("FontDescription validation error");
}
function createAS3TextBlockError(code, parameter) {
  if (code === 2004) return construct("ArgumentError", "Error #2004", code);
  if (code === 2007 && ["firstLine", "lastLine"].includes(parameter)) return construct("TypeError", "Error #2007", code);
  if ((code === 2007 || code === 2008) && ["lineRotation", "baselineZero", "textJustifier"].includes(parameter))
    return construct(code === 2007 ? "TypeError" : "ArgumentError", "Error #" + code, code);
  return unsupported5("TextBlock configuration validation error");
}
function createAS3TextBoundaryError(outOfRange) {
  return construct(outOfRange ? "RangeError" : "ArgumentError", "Error #2006", 2006);
}
function createAS3TextJustifierError(code, parameter) {
  if (code === 2004) return construct("ArgumentError", "Error #2004: One of the parameters is invalid.", code);
  if (code === 2012) return construct("ArgumentError", "Error #2012: TextJustifier class cannot be instantiated.", code);
  if (code === 2007 && ["locale", "lineJustification", "justificationStyle", "textJustifier"].includes(parameter))
    return construct("TypeError", "Error #2007: Parameter " + parameter + " must be non-null.", code);
  if (code === 2008 && ["lineJustification", "justificationStyle"].includes(parameter))
    return construct("ArgumentError", "Error #2008: Parameter " + parameter + " must be one of the accepted values.", code);
  return unsupported5("TextJustifier validation error");
}
function createAS3VectorLengthArgumentError() {
  return construct("ArgumentError", "Error #2005: Parameter 0 is of the incorrect type. Should be type uint.", 2005);
}
function createAS3RegExpCopyFlagsError() {
  return construct("TypeError", "Error #1100: Cannot supply flags when constructing one RegExp from another.", 1100);
}
function createAS3NumberMethodError(code) {
  return construct(code === 1003 ? "RangeError" : "TypeError", "Error #" + code, code);
}
function createAS3StringMethodReceiverError() {
  return construct("TypeError", "Error #1004", 1004);
}
function createAS3BooleanMethodReceiverError() {
  return construct("TypeError", "Error #1004", 1004);
}
function createAS3XMLMutationError() {
  return construct("TypeError", "Error #1089", 1089);
}

// ../engine/src/layaAir/flash/utils/AS3GeneratedClass.ts
var AS3GeneratedClass_exports = {};
__export(AS3GeneratedClass_exports, {
  applyAS3GeneratedSuperMethod: () => applyAS3GeneratedSuperMethod,
  declareAS3GeneratedStaticConstant: () => declareAS3GeneratedStaticConstant,
  declareAS3ReferenceType: () => declareAS3ReferenceType,
  defineAS3GeneratedStaticConstant: () => defineAS3GeneratedStaticConstant,
  getAS3GeneratedNativePositionAccessor: () => getAS3GeneratedNativePositionAccessor,
  registerAS3GeneratedAccessibilityBase: () => registerAS3GeneratedAccessibilityBase,
  registerAS3GeneratedClass: () => registerAS3GeneratedClass,
  registerAS3GeneratedMouseEventTargetBase: () => registerAS3GeneratedMouseEventTargetBase,
  registerAS3GeneratedSpritePositionBase: () => registerAS3GeneratedSpritePositionBase
});

// ../engine/src/layaAir/flash/geom/Rectangle.ts
var RECTANGLE_VALUES = /* @__PURE__ */ new WeakSet();
function isFlashRectangle(value2) {
  return typeof value2 === "object" && value2 !== null && RECTANGLE_VALUES.has(value2);
}

// ../engine/src/layaAir/flash/accessibility/AccessibilityImplementation.ts
var VALUES = /* @__PURE__ */ new WeakMap();
function state(value2) {
  const result = VALUES.get(value2);
  if (!result) throw new TypeError("AccessibilityImplementation receiver required");
  return result;
}
var AccessibilityImplementation = class {
  constructor() {
    as3CheckArgumentCount(arguments.length, 0, 0);
    VALUES.set(this, { stub: false, errno: 0 });
  }
  get stub() {
    return state(this).stub;
  }
  set stub(value2) {
    state(this).stub = Boolean(value2);
  }
  get errno() {
    return state(this).errno;
  }
  set errno(value2) {
    state(this).errno = as3CoerceUint(value2);
  }
  accDoDefaultAction(childID) {
    state(this);
    as3CheckArgumentCount(arguments.length, 1, 1);
    as3CoerceUint(childID);
  }
  accLocation(childID) {
    state(this);
    as3CheckArgumentCount(arguments.length, 1, 1);
    as3CoerceUint(childID);
    return null;
  }
  get_accSelection() {
    state(this);
    as3CheckArgumentCount(arguments.length, 0, 0);
    return null;
  }
  get_accFocus() {
    state(this);
    as3CheckArgumentCount(arguments.length, 0, 0);
    return 0;
  }
  isLabeledBy(rectangle) {
    state(this);
    as3CheckArgumentCount(arguments.length, 1, 1);
    if (rectangle != null && !isFlashRectangle(rectangle)) throw createAS3CanonicalReferenceCoercionError();
    return false;
  }
  accSelect(flags2, childID) {
    state(this);
    as3CheckArgumentCount(arguments.length, 2, 2);
    as3CoerceUint(flags2);
    as3CoerceUint(childID);
  }
  getChildIDArray() {
    state(this);
    as3CheckArgumentCount(arguments.length, 0, 0);
    return null;
  }
  get_accRole(childID) {
    state(this);
    as3CheckArgumentCount(arguments.length, 1, 1);
    as3CoerceUint(childID);
    throw createAS3AccessibilityImplementationError(2143);
  }
  get_accName(childID) {
    state(this);
    as3CheckArgumentCount(arguments.length, 1, 1);
    as3CoerceUint(childID);
    return null;
  }
  get_accValue(childID) {
    state(this);
    as3CheckArgumentCount(arguments.length, 1, 1);
    as3CoerceUint(childID);
    return null;
  }
  get_accState(childID) {
    state(this);
    as3CheckArgumentCount(arguments.length, 1, 1);
    as3CoerceUint(childID);
    throw createAS3AccessibilityImplementationError(2144);
  }
  get_accDefaultAction(childID) {
    state(this);
    as3CheckArgumentCount(arguments.length, 1, 1);
    as3CoerceUint(childID);
    return null;
  }
};

// ../engine/src/layaAir/flash/utils/Proxy.ts
var proxyValues = /* @__PURE__ */ new WeakSet();
var flash_proxy = "http://www.adobe.com/2006/actionscript/flash/proxy";
var flashProxyHookNames = Object.freeze([
  "getProperty",
  "setProperty",
  "callProperty",
  "hasProperty",
  "deleteProperty",
  "nextNameIndex",
  "nextName",
  "nextValue",
  "isAttribute",
  "getDescendants"
]);
function flashProxyNamespaceKey(name2) {
  if (!flashProxyHookNames.includes(name2))
    throw new TypeError("AS3_PROXY_UNSUPPORTED: unknown namespace hook");
  return Symbol.for("as3.namespace.member@1:" + JSON.stringify([flash_proxy, name2]));
}
var _Proxy = class _Proxy {
  constructor() {
    if (arguments.length) throw createAS3ArgumentCountError();
    const declared = collectDeclaredProperties(new.target);
    const handler = {
      get: (target, name2, receiver3) => {
        if (typeof name2 === "symbol" || Reflect.has(target, name2))
          return Reflect.get(target, name2, receiver3);
        return target.getProperty(name2);
      },
      set: (target, name2, value3) => {
        if (typeof name2 === "symbol" || declared.has(name2) || Reflect.has(target, name2))
          return Reflect.set(target, name2, value3, target);
        target.setProperty(name2, value3);
        return true;
      },
      deleteProperty: (target, name2) => {
        if (typeof name2 === "symbol" || declared.has(name2) || Reflect.has(target, name2)) return false;
        return Boolean(target.deleteProperty(name2));
      },
      has: (target, name2) => Reflect.has(target, name2) || Boolean(target.hasProperty(name2))
    };
    const value2 = new globalThis.Proxy(this, handler);
    proxyValues.add(value2);
    return value2;
  }
  // The native Flash defaults are independent failures, not fallbacks through
  // another hook. In particular call/has/value must never invoke getProperty.
  getProperty(_name) {
    return missingHook("getProperty", 2088);
  }
  setProperty(_name, _value) {
    missingHook("setProperty", 2089);
  }
  callProperty(_name, ..._args) {
    return missingHook("callProperty", 2090);
  }
  deleteProperty(_name) {
    return missingHook("deleteProperty", 2092);
  }
  hasProperty(_name) {
    return missingHook("hasProperty", 2091);
  }
  nextNameIndex(_index) {
    return missingHook("nextNameIndex", 2105);
  }
  nextName(_index) {
    return missingHook("nextName", 2106);
  }
  nextValue(_index) {
    return missingHook("nextValue", 2107);
  }
  /** @internal Compiler/runtime lowering entry for a dynamic call. */
  static call(receiver3, name2, args) {
    if (!(receiver3 instanceof _Proxy)) throw new TypeError("Flash proxy receiver must be canonical");
    return receiver3.callProperty(name2, ...args);
  }
  /** @internal Source for-each lowering uses nextValue, not getProperty(nextName). */
  static *values(receiver3) {
    if (receiver3 == null) return;
    if (!(receiver3 instanceof _Proxy)) throw new TypeError("Flash proxy receiver must be canonical");
    let index = 0;
    while ((index = receiver3.nextNameIndex(index) | 0) !== 0)
      yield receiver3.nextValue(index);
  }
};
_Proxy.flashProxyDeclaredProperties = Object.freeze([]);
var Proxy2 = _Proxy;
function missingHook(name2, code) {
  throw as3CreateError(`Error #${code}: The Proxy class does not implement ${name2}. It must be overridden by a subclass.`, code);
}
function isCanonicalFlashProxy(value2) {
  return typeof value2 === "object" && value2 !== null && proxyValues.has(value2);
}
function collectDeclaredProperties(constructor) {
  const result = /* @__PURE__ */ new Set();
  for (let current = constructor; typeof current === "function" && current !== Function.prototype; current = Object.getPrototypeOf(current)) {
    const descriptor2 = Object.getOwnPropertyDescriptor(current, "flashProxyDeclaredProperties");
    if (!descriptor2 || !("value" in descriptor2)) continue;
    if (!Array.isArray(descriptor2.value))
      throw new TypeError("flashProxyDeclaredProperties must be created by declareFlashProxyProperties");
    for (const name2 of descriptor2.value) {
      if (typeof name2 !== "string" && typeof name2 !== "number" && typeof name2 !== "symbol")
        throw new TypeError("Flash proxy declared property names must be property keys");
      result.add(name2);
    }
  }
  return result;
}

// ../engine/src/layaAir/flash/utils/AS3Property.ts
var AS3Property_exports = {};
__export(AS3Property_exports, {
  as3AddAssignProperty: () => as3AddAssignProperty,
  as3CallNamedProperty: () => as3CallNamedProperty,
  as3CallNamespaceProperty: () => as3CallNamespaceProperty,
  as3CallProperty: () => as3CallProperty,
  as3CallRegExpStringProperty: () => as3CallRegExpStringProperty,
  as3DeleteProperty: () => as3DeleteProperty,
  as3EnumerableKeys: () => as3EnumerableKeys,
  as3EnumerableValues: () => as3EnumerableValues,
  as3GetClassNamespaceProperty: () => as3GetClassNamespaceProperty,
  as3GetNamespaceProperty: () => as3GetNamespaceProperty,
  as3GetProperty: () => as3GetProperty,
  as3HasOwnProperty: () => as3HasOwnProperty,
  as3HasProperty: () => as3HasProperty,
  as3SetProperty: () => as3SetProperty,
  coerceAS3PropertyValue: () => coerceAS3PropertyValue,
  defineAS3GeneratedVariable: () => defineAS3GeneratedVariable,
  getAS3ObjectDelegateProperty: () => getAS3ObjectDelegateProperty,
  getAS3ObjectIntrinsic: () => getAS3ObjectIntrinsic,
  getAS3SerializableProperties: () => getAS3SerializableProperties,
  hasAS3PublicPropertyTrait: () => hasAS3PublicPropertyTrait,
  registerAS3ClassProperties: () => registerAS3ClassProperties,
  registerAS3PropertyTraits: () => registerAS3PropertyTraits,
  resolveAS3SourcePublicConversionMethod: () => resolveAS3SourcePublicConversionMethod2,
  validateAS3PropertyType: () => validateAS3PropertyType
});

// ../engine/src/layaAir/flash/utils/AS3ScriptGlobal.ts
var AS3ScriptGlobal_exports = {};
__export(AS3ScriptGlobal_exports, {
  createAS3ScriptDomain: () => createAS3ScriptDomain,
  deleteAS3ScriptGlobalProperty: () => deleteAS3ScriptGlobalProperty,
  getAS3BuiltinScriptGlobal: () => getAS3BuiltinScriptGlobal,
  getAS3ScriptApplicationDomain: () => getAS3ScriptApplicationDomain,
  getAS3ScriptDefinitionByName: () => getAS3ScriptDefinitionByName,
  hasAS3ScriptGlobalDeclaration: () => hasAS3ScriptGlobalDeclaration,
  instantiateAS3ClassScriptUnit: () => instantiateAS3ClassScriptUnit,
  instantiateAS3ScriptUnit: () => instantiateAS3ScriptUnit,
  instantiateAS3SourceClassUnit: () => instantiateAS3SourceClassUnit,
  isAS3ScriptGlobal: () => isAS3ScriptGlobal,
  readAS3ScriptGlobalDeclaration: () => readAS3ScriptGlobalDeclaration,
  selectAS3ScriptDomainClass: () => selectAS3ScriptDomainClass,
  selectAS3ScriptDomainDefinition: () => selectAS3ScriptDomainDefinition,
  selectAS3ScriptDomainType: () => selectAS3ScriptDomainType,
  setAS3ScriptGlobalProperty: () => setAS3ScriptGlobalProperty,
  snapshotAS3ScriptMovie: () => snapshotAS3ScriptMovie,
  unloadAS3ScriptDomain: () => unloadAS3ScriptDomain,
  validateAS3ScriptDomain: () => validateAS3ScriptDomain,
  validateAS3ScriptPrivateScope: () => validateAS3ScriptPrivateScope,
  withAS3ScriptAllocationContext: () => withAS3ScriptAllocationContext
});

// ../engine/src/layaAir/flash/utils/AS3SourceNamespace.ts
var values2 = /* @__PURE__ */ new WeakSet();
var declarations2 = /* @__PURE__ */ new WeakMap();
function isAS3SourceNamespace(value2) {
  return value2 !== null && typeof value2 === "object" && values2.has(value2);
}
function isAS3SourceNamespaceDeclaration(value2) {
  return value2 !== null && typeof value2 === "object" && declarations2.has(value2);
}
function resolveAS3SourceNamespace(declaration2) {
  const value2 = declarations2.get(declaration2);
  if (!value2) throw new TypeError("Genuine source namespace declaration required");
  return value2;
}

// ../engine/src/layaAir/flash/utils/DefinitionRegistry.ts
function isNativeSourceDeclaration(value2) {
  return isNativeSourceType(value2) || isAS3SourceNamespaceDeclaration(value2);
}
function isNativeSourceType(value2) {
  return isAS3DeclarationType(value2) || isAS3Interface(value2);
}
function isNativeDefinition(value2) {
  return typeof value2 === "function" || isAS3Interface(value2) || isAS3SourceNamespace(value2);
}
var definitions = /* @__PURE__ */ new Map();
var domainOwnedDefinitions = /* @__PURE__ */ new WeakSet();
var domainOwnedDeclarations = /* @__PURE__ */ new WeakSet();
var sourceRecords = /* @__PURE__ */ new WeakMap();
function selectNativeSourceDefinition(record5) {
  assertOwnedNativeDefinitionRecord(record5);
  const source = sourceRecords.get(record5);
  if (source) return source.selection;
  const definition = record5.definition;
  if (isAS3SourceNamespace(definition)) throw new TypeError("Namespace definition requires its exact source declaration for selection");
  const declaration2 = isAS3Interface(definition) ? definition : getAS3DeclarationType(definition);
  if (!declaration2) return void 0;
  return Object.freeze({ declaration: declaration2, resolve: () => {
    assertOwnedNativeDefinitionRecord(record5);
    record5.initialize?.();
    assertOwnedNativeDefinitionRecord(record5);
    return record5.definition;
  } });
}
function requireNativeSourceType(selection) {
  if (!selection) return void 0;
  if (!isNativeSourceType(selection.declaration)) throw new TypeError("Source definition is a namespace, not a type");
  return Object.freeze({ declaration: selection.declaration, resolve: () => {
    const value2 = selection.resolve();
    if (typeof value2 !== "function" && !isAS3Interface(value2)) throw new TypeError("Source type resolved to a non-type value");
    return value2;
  } });
}
function selectRegisteredSourceDefinition(name2) {
  const record5 = definitions.get(normalizeDefinitionName(name2));
  return record5 ? selectNativeSourceDefinition(record5) : void 0;
}
function requireNativeSourceClass(selection) {
  if (!selection) return void 0;
  if (!isAS3DeclarationType(selection.declaration)) throw new TypeError("Source definition is an interface, not a class");
  return Object.freeze({ declaration: selection.declaration, resolve: () => {
    const value2 = selection.resolve();
    if (typeof value2 !== "function") throw new TypeError("Source class must resolve to a constructor");
    return value2;
  } });
}
function matchesNativeDefinition(record5, expected) {
  if (!record5 || !isNativeDefinition(expected)) return false;
  const source = sourceRecords.get(record5);
  return (source ? source.peek() : record5.definition) === expected;
}
var ownedRecords = /* @__PURE__ */ new WeakMap();
function isOwnedNativeDefinitionRecord(record5) {
  return ownedRecords.has(record5);
}
function assertOwnedNativeDefinitionRecord(record5) {
  ownedRecords.get(record5)?.guard();
}
function withdrawOwnedNativeDefinitionRecord(record5) {
  const owner = ownedRecords.get(record5);
  if (!owner) return false;
  owner.cancel();
  return true;
}
function publishOwnedDomainDefinitionBindings(bindings4, local, names, root, assertLive) {
  if (typeof assertLive !== "function" || !Array.isArray(bindings4)) throw new TypeError("Owned definitions require a batch and live authority guard");
  const descriptors = Object.getOwnPropertyDescriptors(bindings4);
  const length = descriptors.length?.value;
  if (!Number.isSafeInteger(length) || length <= 0 || Reflect.ownKeys(descriptors).length !== length + 1)
    throw new TypeError("Owned definition batch must be nonempty, dense own data");
  const snapshot = [];
  for (let i = 0; i < length; i++) if (!descriptors[i] || !("value" in descriptors[i]))
    throw new TypeError("Owned definition batch requires own data entries");
  for (let i = 0; i < length; i++) {
    const value2 = descriptors[i].value;
    if (!value2 || typeof value2 !== "object") throw new TypeError("Invalid owned definition");
    const fields2 = Object.getOwnPropertyDescriptors(value2);
    if (Reflect.ownKeys(fields2).some((key3) => typeof key3 !== "string" || !["name", "definition", "initialize"].includes(key3) || !("value" in fields2[key3])) || typeof fields2.name?.value !== "string" || !fields2.name.value.length || !isNativeDefinition(fields2.definition?.value) || fields2.initialize?.value !== void 0 && typeof fields2.initialize.value !== "function")
      throw new TypeError("Owned definition requires explicit data fields");
    snapshot.push({ name: normalizeDefinitionName(fields2.name.value), definition: fields2.definition.value, initialize: fields2.initialize?.value });
  }
  if (new Set(snapshot.map((row) => row.name)).size !== snapshot.length) throw new Error("Owned definition names must be unique");
  return commitOwnedDefinitions(snapshot.map((row) => ({
    name: row.name,
    knownDefinition: row.definition,
    createRecord: (guard) => Object.freeze({ ...row, initialize: () => {
      guard();
      row.initialize?.();
      guard();
    } })
  })), local, names, root, assertLive);
}
function publishOwnedSourceDefinitionBindings(bindings4, local, names, root, assertLive, kind = "definition") {
  if (typeof assertLive !== "function" || !Array.isArray(bindings4)) throw new TypeError("Source classes require a batch and live authority guard");
  const descriptors = Object.getOwnPropertyDescriptors(bindings4);
  const length = descriptors.length?.value;
  if (!Number.isSafeInteger(length) || length <= 0 || Reflect.ownKeys(descriptors).length !== length + 1)
    throw new TypeError("Source class batch must be nonempty, dense own data");
  for (let i = 0; i < length; i++) if (!descriptors[i] || !("value" in descriptors[i]))
    throw new TypeError("Source class batch requires own data entries");
  const snapshot = [];
  for (let i = 0; i < length; i++) {
    const value2 = descriptors[i].value;
    if (!value2 || typeof value2 !== "object") throw new TypeError("Invalid source class binding");
    const fields2 = Object.getOwnPropertyDescriptors(value2);
    if (Reflect.ownKeys(fields2).some((key3) => typeof key3 !== "string" || !["name", "declaration", "resolve"].includes(key3) || !("value" in fields2[key3])) || typeof fields2.name?.value !== "string" || !fields2.name.value.length || !isNativeSourceDeclaration(fields2.declaration?.value) || typeof fields2.resolve?.value !== "function" || kind === "class" && !isAS3DeclarationType(fields2.declaration.value) || kind === "type" && !isNativeSourceType(fields2.declaration.value) || normalizeDefinitionName(fields2.name.value) !== normalizeDefinitionName(fields2.declaration.value.name))
      throw new TypeError("Source class requires exact declaration and explicit data fields");
    snapshot.push({ name: normalizeDefinitionName(fields2.name.value), declaration: fields2.declaration.value, resolve: fields2.resolve.value });
  }
  if (new Set(snapshot.map((row) => row.name)).size !== snapshot.length) throw new Error("Source class names must be unique");
  return commitOwnedDefinitions(snapshot.map((row) => ({
    name: row.name,
    declaration: row.declaration,
    createRecord: (guard) => {
      let ready, resolving = false, reentered = false;
      const resolve = () => {
        guard();
        if (ready) return ready;
        if (resolving) {
          reentered = true;
          throw new Error("Source Class resolution is reentrant");
        }
        resolving = true;
        reentered = false;
        try {
          const result = row.resolve();
          guard();
          if (reentered || (isAS3SourceNamespaceDeclaration(row.declaration) ? result !== resolveAS3SourceNamespace(row.declaration) : isAS3Interface(row.declaration) ? result !== row.declaration : typeof result !== "function" || getAS3DeclarationType(result) !== row.declaration))
            throw new TypeError("Source Class resolver did not complete its exact declaration");
          markDomainOwnedDefinition(result);
          ready = result;
          return result;
        } finally {
          resolving = false;
        }
      };
      const record5 = Object.freeze({ name: row.name, get definition() {
        return resolve();
      }, initialize: () => {
        resolve();
      } });
      sourceRecords.set(record5, { selection: Object.freeze({ declaration: row.declaration, resolve }), peek: () => ready });
      return record5;
    }
  })), local, names, root, assertLive);
}
function publishOwnedSourceTypeBindings(bindings4, local, names, root, assertLive) {
  return publishOwnedSourceDefinitionBindings(bindings4, local, names, root, assertLive, "type");
}
function publishOwnedSourceClassBindings(bindings4, local, names, root, assertLive) {
  return publishOwnedSourceDefinitionBindings(bindings4, local, names, root, assertLive, "class");
}
function commitOwnedDefinitions(entries2, local, names, root, assertLive) {
  assertLive();
  for (const row of entries2) if (local.has(row.name) || root && definitions.has(row.name))
    throw new Error(`Definition ${row.name} already has an owner.`);
  let cancelled = false, checking = false;
  const records2 = /* @__PURE__ */ new Map();
  const active = () => !cancelled && [...records2].every(([name2, record5]) => local.get(name2) === record5 && (!root || definitions.get(name2) === record5));
  const cancel = () => {
    if (cancelled) return;
    cancelled = true;
    for (const [name2, record5] of records2) {
      if (local.get(name2) === record5) {
        local.delete(name2);
        names.delete(name2);
      }
      if (root && definitions.get(name2) === record5) definitions.delete(name2);
    }
  };
  const guard = () => {
    try {
      if (!active() || checking) throw new Error("Owned definition publication is inactive or reentrant");
      checking = true;
      assertLive();
      if (!active()) throw new Error("Owned definition publication changed during authority check");
    } catch (error4) {
      cancel();
      throw error4;
    } finally {
      checking = false;
    }
  };
  for (const row of entries2) records2.set(row.name, row.createRecord(guard));
  const lookup = (name2) => {
    guard();
    if (typeof name2 !== "string") throw new TypeError("Definition name must be a string");
    const record5 = records2.get(normalizeDefinitionName(name2));
    if (!record5) throw new ReferenceError(`Definition ${name2} is not owned by this publication.`);
    record5.initialize();
    return record5.definition;
  };
  const publication = Object.freeze({
    get active() {
      return active();
    },
    names: Object.freeze([...records2.keys()]),
    getDefinition: lookup,
    hasDefinition(name2) {
      try {
        lookup(name2);
        return true;
      } catch {
        return false;
      }
    },
    cancel
  });
  for (const [name2, record5] of records2) {
    ownedRecords.set(record5, { guard, cancel });
    local.set(name2, record5);
    names.add(name2);
    if (root) definitions.set(name2, record5);
  }
  for (const row of entries2) {
    if (row.knownDefinition) domainOwnedDefinitions.add(row.knownDefinition);
    if (row.declaration) domainOwnedDeclarations.add(row.declaration);
  }
  return publication;
}
function markDomainOwnedDefinition(definition) {
  if (!isNativeDefinition(definition)) throw new TypeError("Invalid native definition");
  domainOwnedDefinitions.add(definition);
}
function prepareNativeDefinitionBindings(bindings4, existing) {
  const pending = /* @__PURE__ */ new Map();
  for (const binding of bindings4) {
    if (binding.name == null || !isNativeDefinition(binding.definition) || binding.initialize !== void 0 && typeof binding.initialize !== "function")
      throw new TypeError("Invalid native definition binding");
    const name2 = normalizeDefinitionName(binding.name);
    const previous = pending.get(name2) ?? existing.get(name2);
    if (previous && isOwnedNativeDefinitionRecord(previous))
      throw new Error(`Definition ${name2} already has an owner.`);
    if (previous && (previous.definition !== binding.definition || previous.initialize !== void 0 && binding.initialize !== void 0 && previous.initialize !== binding.initialize))
      throw new Error(`Definition ${name2} already has a different identity.`);
    pending.set(name2, Object.freeze({
      name: name2,
      definition: binding.definition,
      initialize: previous?.initialize ?? binding.initialize
    }));
  }
  return [...pending.values()];
}
function registerDefinitionBindings(bindings4) {
  const pending = prepareNativeDefinitionBindings(bindings4, definitions);
  for (const row of pending) if (ownedRecords.has(definitions.get(row.name)))
    throw new Error(`Definition ${row.name} already has an owner.`);
  for (const binding of pending) definitions.set(binding.name, binding);
  return pending;
}
function normalizeDefinitionName(value2) {
  const name2 = String(value2);
  if (name2.includes("::"))
    return name2;
  const lastDot = name2.lastIndexOf(".");
  return lastDot < 0 ? name2 : `${name2.slice(0, lastDot)}::${name2.slice(lastDot + 1)}`;
}
function unregisterDefinitionByName(name2, expected) {
  const key3 = normalizeDefinitionName(name2);
  if (!matchesNativeDefinition(definitions.get(key3), expected)) return false;
  if (withdrawOwnedNativeDefinitionRecord(definitions.get(key3))) return true;
  return definitions.delete(key3);
}
function registerObservedDefinition(name2, definition) {
  if (domainOwnedDefinitions.has(definition) || domainOwnedDeclarations.has(getAS3DeclarationType(definition))) return;
  const key3 = normalizeDefinitionName(name2);
  if (!definitions.has(key3))
    definitions.set(key3, Object.freeze({ name: key3, definition }));
}
function getDefinitionByName(name2) {
  if (arguments.length !== 1)
    throw as3CreateArgumentError(`Error #1063: Argument count mismatch on global/flash.utils::getDefinitionByName(). Expected 1, got ${arguments.length}.`, 1063);
  const sourceName = as3CoerceString(name2);
  if (sourceName === null)
    throw as3CreateArgumentError("Error #1507: Argument name cannot be null.", 1507);
  const key3 = normalizeDefinitionName(sourceName);
  const definition = definitions.get(key3);
  if (!definition) {
    const separator = key3.lastIndexOf("::");
    const localName = separator < 0 ? key3 : key3.slice(separator + 2);
    throw as3CreateReferenceError(`Error #1065: Variable ${localName} is not defined.`, 1065);
  }
  definition.initialize?.();
  return definition.definition;
}
function hasDefinitionByName(name2) {
  const binding = definitions.get(normalizeDefinitionName(name2));
  try {
    binding?.initialize?.();
    return binding !== void 0;
  } catch {
    return false;
  }
}
function hasRegisteredDefinition(name2) {
  return definitions.has(normalizeDefinitionName(name2));
}
function getRegisteredDefinitionNames() {
  const checked = /* @__PURE__ */ new Map();
  for (const [name2, record5] of [...definitions]) {
    try {
      ownedRecords.get(record5)?.guard();
    } catch {
      continue;
    }
    checked.set(name2, record5);
  }
  return [...checked].filter(([name2, record5]) => definitions.get(name2) === record5).map(([name2]) => name2).sort();
}
for (const definition of [
  Object,
  Array,
  String,
  Number,
  Boolean,
  Date,
  Function,
  Error,
  RegExp,
  Promise
]) registerObservedDefinition(definition.name, definition);

// ../engine/src/layaAir/flash/system/ApplicationDomain.ts
var DOMAIN_STORAGE = /* @__PURE__ */ new WeakMap();
function storage(domain) {
  const state3 = DOMAIN_STORAGE.get(domain);
  if (!state3) throw new TypeError("Expected a genuine ApplicationDomain");
  return state3;
}
function view(state3) {
  const domain = Object.create(ApplicationDomain.prototype);
  DOMAIN_STORAGE.set(domain, state3);
  return domain;
}
function getNativeApplicationDomainIdentity(domain) {
  return storage(domain).identity;
}
function createNativeApplicationDomainView(domain) {
  return view(storage(domain));
}
var OWNED_DEFINITION_GUARDS = /* @__PURE__ */ new WeakMap();
function isIsolatedNativeDefinitionScope(value2) {
  return typeof value2 === "object" && value2 !== null && DOMAIN_STORAGE.get(value2)?.isolated === true;
}
function isFlashApplicationDomain(value2) {
  return typeof value2 === "object" && value2 !== null && DOMAIN_STORAGE.has(value2);
}
function normalizeDefinitionName2(value2) {
  const name2 = String(value2);
  if (name2.includes("::"))
    return name2;
  const separator = name2.lastIndexOf(".");
  return separator < 0 ? name2 : `${name2.slice(0, separator)}::${name2.slice(separator + 1)}`;
}
function requireDefinitionName(value2) {
  if (value2 == null)
    throw new TypeError("definition name must not be null");
  return normalizeDefinitionName2(value2);
}
var _ApplicationDomain = class _ApplicationDomain {
  get definitions() {
    return storage(this).definitions;
  }
  get definitionNames() {
    return storage(this).definitionNames;
  }
  get projectsNativeRegistry() {
    return storage(this).projectsNativeRegistry;
  }
  get _parentDomain() {
    const parent = storage(this).parent;
    return parent ? view(parent) : null;
  }
  constructor(parentDomain = null) {
    const projectsNativeRegistry = _ApplicationDomain.root == null;
    DOMAIN_STORAGE.set(this, {
      identity: Object.freeze({}),
      definitions: /* @__PURE__ */ new Map(),
      definitionNames: /* @__PURE__ */ new Set(),
      parent: projectsNativeRegistry ? null : storage(parentDomain ?? _ApplicationDomain.root),
      projectsNativeRegistry,
      isolated: false
    });
  }
  static get currentDomain() {
    return view(storage(_ApplicationDomain.root));
  }
  /** Allocate an explicit scope with no parent/global lookup fallback. */
  static createIsolatedScope() {
    const scope2 = new _ApplicationDomain();
    storage(scope2).isolated = true;
    return scope2;
  }
  get parentDomain() {
    return storage(this).isolated ? null : this._parentDomain;
  }
  hasDefinition(name2) {
    if (arguments.length !== 1)
      throw as3CreateArgumentError(`Error #1063: Argument count mismatch on flash.system::ApplicationDomain/hasDefinition(). Expected 1, got ${arguments.length}.`, 1063);
    const sourceName = as3CoerceString(name2);
    if (sourceName === null)
      return false;
    const definitionKey = normalizeDefinitionName2(sourceName);
    const local = this.definitions.get(definitionKey);
    if (local) {
      try {
        local.initialize?.();
        return true;
      } catch {
        return false;
      }
    }
    if (this.projectsNativeRegistry && hasDefinitionByName(definitionKey))
      return true;
    return storage(this).isolated ? false : this._parentDomain?.hasDefinition(definitionKey) ?? false;
  }
  getDefinition(name2) {
    if (arguments.length !== 1)
      throw as3CreateArgumentError(`Error #1063: Argument count mismatch on flash.system::ApplicationDomain/getDefinition(). Expected 1, got ${arguments.length}.`, 1063);
    const sourceName = as3CoerceString(name2);
    if (sourceName === null) throw createAS3ApplicationDomainNameError();
    const definitionKey = normalizeDefinitionName2(sourceName);
    const local = this.definitions.get(definitionKey);
    if (local != null) {
      local.initialize?.();
      return local.definition;
    }
    if (this.projectsNativeRegistry && hasRegisteredDefinition(definitionKey))
      return getDefinitionByName(definitionKey);
    if (!storage(this).isolated && this._parentDomain != null)
      return this._parentDomain.getDefinition(definitionKey);
    const separator = definitionKey.lastIndexOf("::");
    const localName = separator < 0 ? definitionKey : definitionKey.slice(separator + 2);
    throw as3CreateReferenceError(`Error #1065: Variable ${localName} is not defined.`, 1065);
  }
  /** Loader/authored-content integration seam for native linkage classes. */
  registerDefinition(name2, definition) {
    this.registerDefinitions([{ name: requireDefinitionName(name2), definition }]);
  }
  /** Publish an explicit native module without evaluating its class initializers. */
  registerDefinitions(bindings4) {
    let pending = prepareNativeDefinitionBindings(bindings4, this.definitions);
    for (const binding of pending) {
      const previous = this.definitions.get(binding.name);
      if (previous && (OWNED_DEFINITION_GUARDS.has(previous) || isOwnedNativeDefinitionRecord(previous)))
        throw new Error(`Definition ${binding.name} already has an owner.`);
    }
    if (this.projectsNativeRegistry) pending = registerDefinitionBindings(pending);
    else for (const binding of pending) markDomainOwnedDefinition(binding.definition);
    for (const binding of pending) {
      this.definitions.set(binding.name, binding);
      this.definitionNames.add(binding.name);
    }
  }
  /** Atomic local-only batch with exact record ownership. Even same-constructor
   * overlap rejects, because constructor equality cannot transfer a claim. The
   * code-owned guard checks authority on lookup/enumeration, not class setup. */
  publishOwnedDefinitions(bindings4, assertLive) {
    if (!isIsolatedNativeDefinitionScope(this) || typeof assertLive !== "function")
      throw new TypeError("Owned definitions require a genuine isolated scope and authority guard");
    const pending = prepareNativeDefinitionBindings(bindings4, /* @__PURE__ */ new Map());
    if (!pending.length || pending.length !== bindings4.length) throw new Error("Owned definition batch must be nonempty and unique");
    for (const binding of pending) if (this.definitions.has(binding.name))
      throw new Error(`Definition ${binding.name} already has an owner.`);
    const records2 = new Map(pending.map((binding) => [binding.name, Object.freeze({
      ...binding,
      initialize: () => {
        assertLive();
        binding.initialize?.();
      }
    })]));
    let cancelled = false;
    const active = () => !cancelled && [...records2].every(([name2, record5]) => this.definitions.get(name2) === record5);
    const lookup = (name2) => {
      const key3 = requireDefinitionName(name2), record5 = records2.get(key3);
      if (!active() || !record5 || this.definitions.get(key3) !== record5)
        throw new ReferenceError(`Definition ${key3} is not owned by this publication.`);
      record5.initialize();
      return record5.definition;
    };
    const publication = Object.freeze({
      get active() {
        return active();
      },
      names: Object.freeze([...records2.keys()]),
      getDefinition: lookup,
      hasDefinition(name2) {
        try {
          lookup(name2);
          return true;
        } catch {
          return false;
        }
      },
      cancel: () => {
        if (cancelled) return;
        cancelled = true;
        for (const [name2, record5] of records2) if (this.definitions.get(name2) === record5) {
          this.definitions.delete(name2);
          this.definitionNames.delete(name2);
        }
      }
    });
    for (const [name2, record5] of records2) {
      markDomainOwnedDefinition(record5.definition);
      OWNED_DEFINITION_GUARDS.set(record5, assertLive);
      this.definitions.set(name2, record5);
      this.definitionNames.add(name2);
    }
    return publication;
  }
  /** Explicit ordinary-domain claim. Root definitions also participate in the
   * native registry; child definitions remain local with normal parent fallback.
   * Constructors retain their own resource authority; this guards visibility. */
  publishOwnedDomainDefinitions(bindings4, assertLive) {
    if (!isFlashApplicationDomain(this) || storage(this).isolated)
      throw new TypeError("Owned domain publication requires a genuine ordinary ApplicationDomain");
    return publishOwnedDomainDefinitionBindings(bindings4, this.definitions, this.definitionNames, this.projectsNativeRegistry, assertLive);
  }
  /** Native compiler/loader seam, not a source-visible ApplicationDomain API.
   * Select inherited type headers before allocating or publishing local tokens. */
  selectSourceDefinition(name2) {
    if (typeof name2 !== "string" || !name2.length) throw new TypeError("Source Class name must be nonempty");
    const key3 = normalizeDefinitionName2(name2), state3 = storage(this);
    const local = state3.definitions.get(key3);
    if (local) return selectNativeSourceDefinition(local);
    if (state3.projectsNativeRegistry && hasRegisteredDefinition(key3)) return selectRegisteredSourceDefinition(key3);
    return state3.isolated ? void 0 : this._parentDomain?.selectSourceDefinition(key3);
  }
  selectSourceType(name2) {
    return requireNativeSourceType(this.selectSourceDefinition(name2));
  }
  selectSourceClass(name2) {
    return requireNativeSourceClass(this.selectSourceType(name2));
  }
  /** Publish lazy source headers; neither publication nor selection initializes a Class. */
  publishOwnedSourceClasses(bindings4, assertLive) {
    if (!isFlashApplicationDomain(this) || storage(this).isolated)
      throw new TypeError("Source Class publication requires a genuine ordinary ApplicationDomain");
    return publishOwnedSourceClassBindings(bindings4, this.definitions, this.definitionNames, this.projectsNativeRegistry, assertLive);
  }
  /** Atomic mixed class/interface headers. Names do not grant nominal identity. */
  publishOwnedSourceTypes(bindings4, assertLive) {
    if (!isFlashApplicationDomain(this) || storage(this).isolated)
      throw new TypeError("Source type publication requires a genuine ordinary ApplicationDomain");
    return publishOwnedSourceTypeBindings(bindings4, this.definitions, this.definitionNames, this.projectsNativeRegistry, assertLive);
  }
  /** Source values and types share ownership without conflating their headers. */
  publishOwnedSourceDefinitions(bindings4, assertLive) {
    if (!isFlashApplicationDomain(this) || storage(this).isolated)
      throw new TypeError("Source definition publication requires a genuine ordinary ApplicationDomain");
    return publishOwnedSourceDefinitionBindings(bindings4, this.definitions, this.definitionNames, this.projectsNativeRegistry, assertLive);
  }
  /** Releases an owned local publication without removing inherited or replacement definitions. */
  unregisterDefinition(name2, expected) {
    const definitionKey = requireDefinitionName(name2);
    if (!matchesNativeDefinition(this.definitions.get(definitionKey), expected)) return false;
    if (withdrawOwnedNativeDefinitionRecord(this.definitions.get(definitionKey))) return true;
    this.definitions.delete(definitionKey);
    this.definitionNames.delete(definitionKey);
    if (this.projectsNativeRegistry) unregisterDefinitionByName(definitionKey, expected);
    return true;
  }
  getQualifiedDefinitionNames() {
    const names = new Set(this.definitionNames);
    const records2 = new Map(this.definitions);
    for (const [name2, record5] of records2) {
      const guard = OWNED_DEFINITION_GUARDS.get(record5);
      if (guard) try {
        guard();
      } catch {
        names.delete(name2);
      }
      if (isOwnedNativeDefinitionRecord(record5)) {
        try {
          assertOwnedNativeDefinitionRecord(record5);
        } catch {
          names.delete(name2);
        }
      }
    }
    const registryNames = this.projectsNativeRegistry ? getRegisteredDefinitionNames() : [];
    for (const [name2, record5] of records2) if (this.definitions.get(name2) !== record5) names.delete(name2);
    for (const name2 of registryNames) names.add(name2);
    return [...names].sort();
  }
};
_ApplicationDomain.root = new _ApplicationDomain(null);
var ApplicationDomain = _ApplicationDomain;

// ../engine/src/layaAir/laya/display/SourceProjectionViewport.ts
var allocationViewport = null;
function withSourceProjectionViewport(viewport, create2) {
  const { width, height } = viewport;
  if (!(Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0))
    throw new RangeError("Authored projection dimensions must be positive and finite");
  const previous = allocationViewport;
  allocationViewport = Object.freeze({ width, height });
  try {
    return create2();
  } finally {
    allocationViewport = previous;
  }
}

// ../engine/src/layaAir/flash/utils/AS3MethodBinding.ts
var AS3MethodBinding_exports = {};
__export(AS3MethodBinding_exports, {
  bindAS3Method: () => bindAS3Method,
  getAS3FunctionParameterCount: () => getAS3FunctionParameterCount,
  getAS3MethodDiagnosticName: () => getAS3MethodDiagnosticName,
  getAS3MethodSource: () => getAS3MethodSource,
  getBoundAS3Method: () => getBoundAS3Method,
  isAS3MethodClosure: () => isAS3MethodClosure,
  registerAS3BoundMethodClosure: () => registerAS3BoundMethodClosure,
  registerAS3FunctionParameterCount: () => registerAS3FunctionParameterCount,
  registerAS3FunctionParameterCounts: () => registerAS3FunctionParameterCounts
});
var bindings2 = /* @__PURE__ */ new WeakMap();
var methodClosures = /* @__PURE__ */ new WeakMap();
var parameterCounts = /* @__PURE__ */ new WeakMap();
var diagnosticNames = /* @__PURE__ */ new WeakMap();
function record2(instance, name2, source, closure) {
  let methods5 = bindings2.get(instance);
  if (!methods5) bindings2.set(instance, methods5 = /* @__PURE__ */ new Map());
  methods5.set(name2, { source, closure });
  methodClosures.set(closure, source);
}
function isAS3MethodClosure(value2) {
  return typeof value2 === "function" && methodClosures.has(value2);
}
function bindAS3Method(instance, methodName, parameterCount) {
  const method2 = instance[methodName];
  if (typeof method2 !== "function")
    throw new TypeError(`Cannot bind ActionScript method '${String(methodName)}'`);
  const previous = bindings2.get(instance)?.get(methodName);
  const source = previous && previous.closure === method2 ? previous.source : method2;
  if (parameterCount !== void 0) registerAS3FunctionParameterCount(source, parameterCount);
  const closure = method2.bind(instance);
  Object.defineProperty(instance, methodName, {
    configurable: true,
    enumerable: false,
    writable: true,
    value: closure
  });
  record2(instance, methodName, source, closure);
}
function getAS3MethodDiagnosticName(value2) {
  return diagnosticNames.get(value2);
}
function diagnostic(closure, name2) {
  if (name2 === void 0) return;
  if (typeof name2 !== "string" || !name2) throw new TypeError("Invalid source method diagnostic name");
  const previous = diagnosticNames.get(closure);
  if (previous !== void 0 && previous !== name2) throw new TypeError("Conflicting source method diagnostic name");
  diagnosticNames.set(closure, name2);
}
function getBoundAS3Method(instance, name2, source, sourceName) {
  if (typeof source !== "function") throw new TypeError("Invalid source method");
  if (sourceName !== void 0 && (typeof sourceName !== "string" || !sourceName))
    throw new TypeError("Invalid source method diagnostic name");
  const previous = bindings2.get(instance)?.get(name2);
  const own2 = Object.getOwnPropertyDescriptor(instance, name2);
  if (previous) {
    if (previous.source !== source || own2 && (!("value" in own2) || own2.value !== previous.closure))
      throw new TypeError("Source method binding was replaced by a host property");
    diagnostic(previous.closure, sourceName);
    if (!own2 && Object.isExtensible(instance)) Object.defineProperty(instance, name2, {
      configurable: true,
      enumerable: false,
      writable: true,
      value: previous.closure
    });
    return previous.closure;
  }
  if (own2 && (!("value" in own2) || own2.value !== source))
    throw new TypeError("Source method requires authenticated closure provenance");
  const closure = source.bind(instance);
  if (own2 || Object.isExtensible(instance)) Object.defineProperty(instance, name2, {
    configurable: true,
    enumerable: false,
    writable: true,
    value: closure
  });
  record2(instance, name2, source, closure);
  diagnostic(closure, sourceName);
  return closure;
}
function getAS3MethodSource(instance, name2, method2) {
  const previous = bindings2.get(instance)?.get(name2);
  if (!previous) return method2;
  if (method2 !== previous.source && method2 !== previous.closure)
    throw new TypeError("Source method binding differs from registered descriptor");
  return previous.source;
}
function registerAS3FunctionParameterCounts(entries2) {
  const next = /* @__PURE__ */ new Map();
  for (const [fn, count] of entries2) {
    if (typeof fn !== "function" || !Number.isSafeInteger(count) || count < 0)
      throw new TypeError("Invalid source function parameter count");
    const previous = next.get(fn) ?? parameterCounts.get(fn);
    if (previous !== void 0 && previous !== count)
      throw new TypeError("Conflicting source function parameter count");
    next.set(fn, count);
  }
  for (const [fn, count] of next) parameterCounts.set(fn, count);
}
function registerAS3FunctionParameterCount(fn, count) {
  registerAS3FunctionParameterCounts([[fn, count]]);
}
function getAS3FunctionParameterCount(fn) {
  return parameterCounts.get(fn) ?? parameterCounts.get(methodClosures.get(fn));
}
function registerAS3BoundMethodClosure(fn, parameterCount) {
  registerAS3FunctionParameterCount(fn, parameterCount);
  if (!methodClosures.has(fn)) methodClosures.set(fn, fn);
}

// ../engine/src/layaAir/flash/utils/AS3ObjectModel.ts
var parents = /* @__PURE__ */ new WeakMap();
var delegates = /* @__PURE__ */ new WeakSet();
var classPrototypes = /* @__PURE__ */ new WeakMap();
var instancePrototypes = /* @__PURE__ */ new WeakMap();
var nativeConstructors = /* @__PURE__ */ new WeakMap();
var builtinObjectConstructors = /* @__PURE__ */ new WeakSet();
var as3ObjectPrototype = as3CreateDynamicObject();
parents.set(as3ObjectPrototype, null);
delegates.add(as3ObjectPrototype);
Object.defineProperty(as3ObjectPrototype, "constructor", { value: Object, writable: true, configurable: true });
var classPrototype = createAS3Prototype(AS3ClassType, as3ObjectPrototype);
classPrototypes.set(Object, as3ObjectPrototype);
classPrototypes.set(AS3ClassType, classPrototype);
classPrototypes.set(Function, Function.prototype);
parents.set(Function.prototype, as3ObjectPrototype);
delegates.add(Function.prototype);
for (const ctor of [Object, Function, AS3ClassType]) parents.set(ctor, classPrototype);
function createAS3Prototype(constructor, parent = as3ObjectPrototype) {
  const value2 = as3CreateDynamicObject();
  Object.defineProperty(value2, "constructor", { value: constructor, writable: true, configurable: true });
  parents.set(value2, parent);
  delegates.add(value2);
  return value2;
}
function registerAS3ClassPrototype(constructor, base, nativeDelegate) {
  if (!describeRegisteredFlashType(constructor)?.isStatic)
    throw new TypeError("AS3_PROTOTYPE_UNSUPPORTED: exact source Class metadata required");
  const exact = getAS3ExactSourceClass(constructor);
  if (exact && exact.baseConstructor !== base)
    throw new TypeError("AS3_PROTOTYPE_UNSUPPORTED: base differs from captured source generation");
  if (nativeDelegate !== void 0 && (base !== null || !isCanonicalAS3DeclarationConstructor(constructor) || getAS3ExactSourceClass(nativeDelegate)?.constructor !== constructor))
    throw new TypeError("AS3_PROTOTYPE_UNSUPPORTED: exact canonical root delegate required");
  const previous = classPrototypes.get(constructor);
  if (previous) {
    if (nativeDelegate !== void 0 && previous !== nativeDelegate)
      throw new TypeError("AS3_PROTOTYPE_UNSUPPORTED: conflicting native source delegate");
    return previous;
  }
  const parent = base === null || base === Object ? as3ObjectPrototype : classPrototypes.get(base);
  if (!parent) throw new TypeError("AS3_PROTOTYPE_UNSUPPORTED: source base delegate is not registered");
  const native = Object.getOwnPropertyDescriptor(constructor, "prototype");
  if (!native || native.writable || native.configurable || !native.value)
    throw new TypeError("AS3_PROTOTYPE_UNSUPPORTED: source Class prototype identity is not stable");
  const previousConstructor = nativeConstructors.get(native.value);
  if (previousConstructor && previousConstructor !== constructor)
    throw new TypeError("AS3_PROTOTYPE_UNSUPPORTED: native prototype belongs to another constructor");
  const value2 = nativeDelegate ?? createAS3Prototype(constructor, parent);
  if (nativeDelegate) {
    parents.set(value2, parent);
    delegates.add(value2);
  }
  classPrototypes.set(constructor, value2);
  instancePrototypes.set(native.value, value2);
  nativeConstructors.set(native.value, constructor);
  parents.set(constructor, classPrototype);
  return value2;
}
function getRegisteredAS3ClassPrototype(constructor) {
  return classPrototypes.get(constructor);
}
function isAS3Prototype(value2) {
  return delegates.has(value2);
}
function as3PrototypeOf(value2) {
  if (isAS3ScriptGlobal(value2)) return as3ObjectPrototype;
  if (parents.has(value2)) return parents.get(value2);
  if (typeof value2 === "function") return Function.prototype;
  const builtin = sourceBuiltinClassFor(value2);
  if (builtin) {
    if (getAS3ExactSourceClass(value2)?.constructor !== builtin)
      throw new TypeError("AS3_PROTOTYPE_UNSUPPORTED: authored builtin requires exact canonical identity");
    return classPrototypes.get(builtin) ?? null;
  }
  const native = Object.getPrototypeOf(value2);
  if (instancePrototypes.has(native)) return instancePrototypes.get(native);
  if (native === Object.prototype) return as3ObjectPrototype;
  if (delegates.has(native)) return native;
  return null;
}
function as3PrototypeContains(prototype, value2) {
  if (value2 === null || typeof value2 !== "object" && typeof value2 !== "function") return false;
  const seen = /* @__PURE__ */ new Set();
  for (let parent = as3PrototypeOf(value2); parent; parent = as3PrototypeOf(parent)) {
    if (seen.has(parent)) throw new TypeError("AS3_PROTOTYPE_UNSUPPORTED: cyclic source delegate");
    if (parent === prototype) return true;
    seen.add(parent);
  }
  return false;
}
function registerAS3FunctionPrototypeObject(value2) {
  if (delegates.has(value2)) return;
  if (Object.getPrototypeOf(value2) !== Object.prototype)
    throw new TypeError("AS3_PROTOTYPE_UNSUPPORTED: nonordinary Function instance delegate");
  parents.set(value2, as3ObjectPrototype);
  delegates.add(value2);
}
function registerAS3BuiltinObjectDelegate(constructor) {
  if (typeof constructor !== "function" || constructor === Object || constructor === Function)
    throw new TypeError("AS3_PROTOTYPE_UNSUPPORTED: builtin constructor identity");
  const native = Object.getOwnPropertyDescriptor(constructor, "prototype");
  if (!native || native.writable || native.configurable || !native.value || typeof native.value !== "object" || Object.getPrototypeOf(native.value) !== Object.prototype || Object.getOwnPropertyDescriptor(native.value, "constructor")?.value !== constructor)
    throw new TypeError("AS3_PROTOTYPE_UNSUPPORTED: builtin direct Object prototype identity");
  const owner = nativeConstructors.get(native.value);
  if (owner && owner !== constructor)
    throw new TypeError("AS3_PROTOTYPE_UNSUPPORTED: native prototype belongs to another constructor");
  const previous = classPrototypes.get(constructor);
  if (previous) {
    if (!builtinObjectConstructors.has(constructor))
      throw new TypeError("AS3_PROTOTYPE_UNSUPPORTED: different delegate authority already published");
    return previous;
  }
  const value2 = constructor === Array ? [] : createAS3Prototype(constructor, as3ObjectPrototype);
  if (constructor === Array) {
    Object.defineProperty(value2, "constructor", { value: constructor, writable: true, configurable: true });
    parents.set(value2, as3ObjectPrototype);
    delegates.add(value2);
  }
  classPrototypes.set(constructor, value2);
  instancePrototypes.set(native.value, value2);
  nativeConstructors.set(native.value, constructor);
  builtinObjectConstructors.add(constructor);
  parents.set(constructor, classPrototype);
  return value2;
}
function getAS3RegisteredPrototypeConstructor(prototype) {
  return nativeConstructors.get(prototype);
}
function registerAS3ClassValueParent(constructor) {
  if (getAS3BuiltinClassName(constructor) === void 0 && !describeRegisteredFlashType(constructor)?.isStatic)
    throw new TypeError("AS3_PROTOTYPE_UNSUPPORTED: exact source Class metadata required");
  const previous = parents.get(constructor);
  if (previous !== void 0 && previous !== classPrototype)
    throw new TypeError("AS3_PROTOTYPE_UNSUPPORTED: conflicting Class value parent");
  parents.set(constructor, classPrototype);
}

// ../engine/src/layaAir/flash/utils/AS3Invocation.ts
var functions = /* @__PURE__ */ new WeakMap();
var intrinsics = /* @__PURE__ */ new WeakMap();
registerAS3FunctionParameterCount(Function.prototype, 0);
function error(id) {
  const e = new TypeError("Error #" + id);
  Object.defineProperty(e, "errorID", { value: id });
  throw e;
}
function unsupported6(reason) {
  throw new TypeError("AS3_INVOCATION_UNSUPPORTED: " + reason);
}
function sourceFunction(value2) {
  if (!as3Is(value2, Function)) throw createAS3NamedCallError("value");
  const global = functions.get(value2)?.global;
  if (global && !isAS3ScriptGlobal(global)) return unsupported6("failed source function creation context");
  return value2;
}
function record3(fn) {
  let value2 = functions.get(fn);
  if (!value2) functions.set(fn, value2 = {});
  return value2;
}
function registerAS3Function(fn, scriptGlobal, parameterCount, returnType) {
  sourceFunction(fn);
  if (returnType !== void 0 && returnType !== "String") return unsupported6("unsupported source return type");
  if (!isAS3ScriptGlobal(scriptGlobal) || !Number.isSafeInteger(parameterCount) || parameterCount < 0)
    return unsupported6("invalid source function creation context");
  const value2 = record3(fn);
  if (value2.global && (value2.global !== scriptGlobal || value2.parameterCount !== parameterCount))
    return unsupported6("conflicting source function creation context");
  registerAS3FunctionParameterCount(fn, parameterCount);
  value2.global = scriptGlobal;
  value2.parameterCount = parameterCount;
  if (returnType === "String") registerAS3StringReturn(fn);
  return fn;
}
function argumentsList(values5) {
  if (!Array.isArray(values5) || Object.getPrototypeOf(values5) !== Array.prototype)
    return unsupported6("ordinary argument list required");
  const result = [];
  for (let index = 0; index < values5.length; index++) {
    const own2 = Object.getOwnPropertyDescriptor(values5, String(index));
    if (own2 && !("value" in own2)) return unsupported6("host argument accessor");
    result.push(own2?.value);
  }
  return result;
}
function registerAS3ArrayReceiverFunction(fn) {
  const value2 = functions.get(fn);
  if (!value2?.global || isAS3MethodClosure(fn)) return unsupported6("Array receiver requires registered public Function");
  value2.arrayReceiver = true;
}
function registerAS3NumberReceiverFunction(fn) {
  const value2 = functions.get(fn);
  if (!value2?.global || isAS3MethodClosure(fn)) return unsupported6("Number receiver requires registered public Function");
  value2.numberReceiver = true;
}
function registerAS3StringReceiverFunction(fn) {
  const value2 = functions.get(fn);
  if (!value2?.global || isAS3MethodClosure(fn)) return unsupported6("String receiver requires registered public Function");
  value2.stringReceiver = true;
}
function registerAS3BooleanReceiverFunction(fn) {
  const value2 = functions.get(fn);
  if (!value2?.global || isAS3MethodClosure(fn)) return unsupported6("Boolean receiver requires registered public Function");
  value2.booleanReceiver = true;
}
function as3CallValue(value2, arguments_, receiver3) {
  const args = argumentsList(arguments_());
  if (as3AsClass(value2) !== null) return as3CallClass(value2, args);
  const fn = sourceFunction(value2);
  const target = receiver3;
  if (functions.get(fn)?.numberReceiver || functions.get(fn)?.stringReceiver || functions.get(fn)?.booleanReceiver) return Reflect.apply(fn, target, args);
  if (functions.get(fn)?.arrayReceiver && !Array.isArray(target)) throw createAS3ArrayCoercionError();
  if (target == null && !isAS3MethodClosure(fn) && fn !== Function.prototype)
    return unsupported6("direct call requires its caller global or explicit receiver");
  if (target != null && typeof target !== "object" && typeof target !== "function" && !isAS3MethodClosure(fn))
    return unsupported6("primitive call receiver boxing");
  return Reflect.apply(fn, target, args);
}
function getAS3FunctionPrototype(value2) {
  const fn = sourceFunction(value2), state3 = record3(fn);
  if (isAS3MethodClosure(fn)) return null;
  if (fn === Function.prototype) {
    if (!state3.prototype) state3.prototype = createAS3Prototype(fn);
    return state3.prototype;
  }
  if (!state3.prototype) {
    const descriptor2 = Object.getOwnPropertyDescriptor(fn, "prototype");
    if (!descriptor2?.writable) return unsupported6("source function needs a native constructable function body");
    const original = descriptor2.value;
    if (!original || typeof original !== "object" || Reflect.ownKeys(original).length !== 1 || Object.getOwnPropertyDescriptor(original, "constructor")?.value !== fn)
      return unsupported6("host modified the initial native function prototype");
    state3.prototype = createAS3Prototype(fn);
    Object.defineProperty(fn, "prototype", { ...descriptor2, value: state3.prototype });
  }
  if (Object.getOwnPropertyDescriptor(fn, "prototype")?.value !== state3.prototype)
    return unsupported6("host changed source function prototype");
  return state3.prototype;
}
function setAS3FunctionPrototype(value2, prototype) {
  const fn = sourceFunction(value2);
  if (isAS3MethodClosure(fn)) {
    const e = new ReferenceError("Error #1074");
    Object.defineProperty(e, "errorID", { value: 1074 });
    throw e;
  }
  getAS3FunctionPrototype(fn);
  if (prototype == null) prototype = as3ObjectPrototype;
  if (typeof prototype !== "object" && typeof prototype !== "function") return error(1049);
  if (as3AsClass(prototype) !== null || typeof prototype === "function") return unsupported6("function/Class-valued instance prototype");
  registerAS3FunctionPrototypeObject(prototype);
  record3(fn).prototype = prototype;
  if (fn !== Function.prototype) Object.defineProperty(fn, "prototype", { value: prototype });
}
function getAS3FunctionIntrinsic(value2, name2) {
  const fn = sourceFunction(value2);
  if (name2 !== "call" && name2 !== "apply") return void 0;
  let cache = intrinsics.get(fn);
  if (!cache) intrinsics.set(fn, cache = /* @__PURE__ */ new Map());
  let closure = cache.get(name2);
  if (!closure) {
    closure = (...args) => {
      const callReceiver = () => {
        if (args[0] != null || isAS3MethodClosure(fn)) return args[0];
        const global = functions.get(fn)?.global;
        if (!global && fn !== Function.prototype) return unsupported6("callee script global was not registered");
        return global;
      };
      if (name2 === "call") return as3CallValue(fn, () => args.slice(1), callReceiver());
      as3CheckArgumentCount(args.length, 0, 2);
      const values5 = args[1];
      if (values5 != null && !Array.isArray(values5)) return error(1116);
      return as3CallValue(fn, () => values5 == null ? [] : argumentsList(values5), callReceiver());
    };
    cache.set(name2, closure);
    registerAS3BoundMethodClosure(closure, name2 === "call" ? 1 : 2);
  }
  return closure;
}
function getAS3FunctionLength(fn) {
  const length = getAS3FunctionParameterCount(sourceFunction(fn));
  if (length === void 0) return unsupported6("source formal parameter count was not registered");
  return length;
}
var publicFunctionWrappers = /* @__PURE__ */ new Map();
function getAS3FunctionPrototypeIntrinsic(name2) {
  if (name2 !== "call" && name2 !== "apply") return void 0;
  let wrapper = publicFunctionWrappers.get(name2);
  if (!wrapper) {
    wrapper = function(...args) {
      const method2 = getAS3FunctionIntrinsic(sourceFunction(this), name2);
      return Reflect.apply(method2, void 0, args);
    };
    registerAS3Function(wrapper, getAS3BuiltinScriptGlobal(), name2 === "call" ? 1 : 2);
    publicFunctionWrappers.set(name2, wrapper);
  }
  return wrapper;
}

// ../engine/src/layaAir/flash/utils/AS3ScriptGlobal.ts
var domains = /* @__PURE__ */ new WeakMap();
var globals = /* @__PURE__ */ new WeakMap();
var privateScopes = /* @__PURE__ */ new WeakMap();
var sourceDefinitionOwners = /* @__PURE__ */ new WeakMap();
var builtinClasses4 = /* @__PURE__ */ new Map([
  [Object, "Object"],
  [Function, "Function"],
  [Number, "Number"],
  [String, "String"],
  [Boolean, "Boolean"],
  [Array, "Array"]
]);
function unsupported7(message) {
  throw new TypeError("AS3_SCRIPT_GLOBAL_UNSUPPORTED: " + message);
}
function sourceError2(errorID) {
  const error4 = new ReferenceError("Error #" + errorID);
  Object.defineProperty(error4, "errorID", { value: errorID });
  throw error4;
}
function key(name2, uri = "", visibility = "public") {
  return JSON.stringify([visibility, uri, name2]);
}
function validateAS3ScriptPrivateScope(scope2) {
  if (scope2 !== void 0 && (!scope2 || !privateScopes.has(scope2) || privateScopes.get(scope2).state === "failed")) return unsupported7("unknown file-private namespace");
}
function scopedBinding(state3, name2, uri, scope2) {
  validateAS3ScriptPrivateScope(scope2);
  if (!uri && scope2 && privateScopes.get(scope2) === state3) {
    const found = state3.bindings.get(key(name2, "", "file-private"));
    if (found) return found;
  }
  return state3.bindings.get(key(name2, uri));
}
function data2(object2, name2, optional = false) {
  const descriptor2 = Object.getOwnPropertyDescriptor(object2, name2);
  if (!descriptor2 && optional) return void 0;
  if (!descriptor2 || !("value" in descriptor2)) return unsupported7("declarations must contain own data fields: " + name2);
  return descriptor2.value;
}
function text(value2, label, allowEmpty = false) {
  if (typeof value2 !== "string" || !allowEmpty && !value2.length) return unsupported7("invalid " + label);
  return value2;
}
function record4(value2) {
  const found = globals.get(value2);
  if (!found || found.state !== "ready" && found.state !== "retained") return unsupported7("script instance is not initialized");
  return found;
}
function read(binding) {
  return binding.declaration.kind === "constant" ? binding.storage.value : binding.storage.get();
}
function scalarType(value2, type) {
  switch (type) {
    case "*":
      return value2;
    case "Number":
      return as3CoerceNumber(value2);
    case "int":
      return as3CoerceInt(value2);
    case "uint":
      return as3CoerceUint(value2);
    case "String":
      return as3CoerceString(value2);
    case "Boolean":
      return !!value2;
    case "Object":
      return as3CoerceObject(value2);
    case "Function":
      return as3CoerceReference(value2, Function);
    default:
      return unsupported7("variable reference type requires emitted coercion authority: " + type);
  }
}
function validateConstant(value2, type) {
  if (type === "Namespace" && isAS3SourceNamespace(value2)) return;
  if (isAS3Interface(value2) && value2.name === type) return;
  if (typeof value2 === "function") {
    const actual = builtinClasses4.get(value2) ?? describeRegisteredFlashType(value2)?.name;
    if (actual === type || !actual && (type === "Function" || type === "*")) return;
    return unsupported7("native Class differs from declared source binding");
  }
  const valid = type === "*" || type === "Object" && value2 !== void 0 || type === "String" && (value2 === null || typeof value2 === "string") || type === "Boolean" && typeof value2 === "boolean" || type === "Number" && typeof value2 === "number" || type === "int" && typeof value2 === "number" && Number.isInteger(value2) && value2 >= -2147483648 && value2 <= 2147483647 || type === "uint" && typeof value2 === "number" && Number.isInteger(value2) && value2 >= 0 && value2 <= 4294967295 || type === "Function" && value2 === null;
  if (!valid) return unsupported7("constant value lacks its declared source type authority: " + type);
}
function createAS3ScriptDomain(applicationDomain, movie) {
  const selected = applicationDomain === void 0 ? void 0 : createNativeApplicationDomainView(applicationDomain);
  const domain = Object.freeze({ kind: "AS3ScriptDomain" });
  const authoredMovie = movie === void 0 ? void 0 : snapshotAS3ScriptMovie(movie);
  domains.set(domain, { closed: false, units: /* @__PURE__ */ new Map(), applicationDomain: selected, movie: authoredMovie });
  return domain;
}
function validateAS3ScriptDomain(domain) {
  const state3 = domains.get(domain);
  if (!state3 || state3.closed) return unsupported7("unknown or unloaded script domain");
}
function snapshotAS3ScriptMovie(movie) {
  if (!movie || typeof movie !== "object") return unsupported7("authored movie record required");
  const width = data2(movie, "width"), height = data2(movie, "height"), sourceSha256 = data2(movie, "sourceSha256");
  if (typeof width !== "number" || !Number.isFinite(width) || width <= 0 || width > 2147483647 || typeof height !== "number" || !Number.isFinite(height) || height <= 0 || height > 2147483647 || typeof sourceSha256 !== "string" || !/^[a-f0-9]{64}$/.test(sourceSha256))
    return unsupported7("invalid authored movie dimensions or source hash");
  return Object.freeze({ width, height, sourceSha256 });
}
function withAS3ScriptAllocationContext(global, allocate) {
  const state3 = globals.get(global);
  if (!state3 || state3.state === "failed") return unsupported7("unknown or failed lexical script global");
  const movie = domains.get(state3.domain)?.movie;
  if (!movie) return unsupported7("script domain has no explicit authored movie binding");
  return withSourceProjectionViewport(movie, allocate);
}
function getAS3ScriptApplicationDomain(global) {
  const state3 = globals.get(global);
  if (!state3 || state3.state === "failed") return unsupported7("unknown or failed lexical script global");
  const selected = domains.get(state3.domain)?.applicationDomain;
  if (!selected) return unsupported7("script domain has no explicit ApplicationDomain binding");
  return createNativeApplicationDomainView(selected);
}
function getAS3ScriptDefinitionByName(global, ...args) {
  if (args.length !== 1)
    throw as3CreateArgumentError(`Error #1063: Argument count mismatch on global/flash.utils::getDefinitionByName(). Expected 1, got ${args.length}.`, 1063);
  return getAS3ScriptApplicationDomain(global).getDefinition(args[0]);
}
function selectAS3ScriptDomainDefinition(domain, name2) {
  const requireScope = () => {
    const state3 = domains.get(domain);
    if (!state3 || state3.closed) return unsupported7("unknown or unloaded script domain");
    if (!state3.applicationDomain) return unsupported7("script domain has no explicit ApplicationDomain binding");
    return state3.applicationDomain;
  };
  const selected = requireScope().selectSourceDefinition(name2);
  return selected && Object.freeze({ declaration: selected.declaration, resolve: () => {
    requireScope();
    return selected.resolve();
  } });
}
function selectAS3ScriptDomainType(domain, name2) {
  return requireNativeSourceType(selectAS3ScriptDomainDefinition(domain, name2));
}
function selectAS3ScriptDomainClass(domain, name2) {
  return requireNativeSourceClass(selectAS3ScriptDomainType(domain, name2));
}
function unloadAS3ScriptDomain(domain) {
  const state3 = domains.get(domain);
  if (!state3) return unsupported7("unknown script domain");
  state3.closed = true;
  state3.units.clear();
}
function instantiateAS3ScriptUnit(domain, input, factory) {
  return instantiateUnit(domain, input, factory, false);
}
function instantiateAS3ClassScriptUnit(domain, input, factory) {
  return instantiateUnit(domain, input, factory, false, true);
}
function instantiateAS3SourceClassUnit(domain, input, factory) {
  if (typeof factory !== "function") return unsupported7("source unit factory required");
  return instantiateUnit(domain, input, (context2) => factory(context2), false, true, true);
}
function instantiateUnit(domain, input, factory, nativeProvider, classScript = false, sourceClasses = false) {
  const owner = domains.get(domain);
  if (!owner || owner.closed) return unsupported7("unknown or unloaded script domain");
  if (!input || typeof input !== "object" || typeof factory !== "function") return unsupported7("source unit declaration required");
  const sourceId = text(data2(input, nativeProvider ? "providerId" : "sourceId"), "source identity");
  const sourceSha256 = text(data2(input, nativeProvider ? "evidenceSha256" : "sourceSha256"), "authority digest");
  if (!/^[a-f0-9]{64}$/.test(sourceSha256)) return unsupported7("source digest must be SHA-256");
  if (owner.units.has(sourceId)) return unsupported7("source unit was already instantiated in this domain");
  const sourceBindings = data2(input, "bindings");
  if (!Array.isArray(sourceBindings) || sourceBindings.length === 0) return unsupported7("actual source declarations are required");
  const declarations4 = [];
  const names = /* @__PURE__ */ new Set();
  for (let index = 0; index < sourceBindings.length; index++) {
    const item = data2(sourceBindings, String(index));
    if (!item || typeof item !== "object") return unsupported7("dense declaration records required");
    const name2 = text(data2(item, "name"), "binding name"), uri = text(data2(item, "uri", true) ?? "", "namespace", true);
    const kind = data2(item, "kind"), type = text(data2(item, "type"), "binding type");
    const visibility = data2(item, "visibility", true) ?? "public";
    if (visibility !== "public" && visibility !== "file-private" || visibility === "file-private" && (uri !== "" || nativeProvider)) return unsupported7("invalid source namespace visibility");
    if (kind !== "constant" && kind !== "variable" || names.has(key(name2, uri, visibility))) return unsupported7("duplicate or invalid source binding");
    names.add(key(name2, uri, visibility));
    declarations4.push(Object.freeze({ name: name2, uri, visibility, kind, type }));
  }
  if (classScript) {
    const declaration2 = declarations4[0];
    if (!sourceClasses && declarations4.length !== 1 || declaration2.visibility !== "public" || declaration2.kind !== "constant" || declaration2.type !== (declaration2.uri ? declaration2.uri + "::" : "") + declaration2.name || !declaration2.uri && ["Object", "Function", "Number", "int", "uint", "String", "Boolean", "Array", "*"].includes(declaration2.type))
      return unsupported7("Class script requires one exact public Class declaration");
    if (sourceClasses && declarations4.slice(1).some((item) => item.visibility !== "file-private" || item.kind !== "constant" || item.uri !== "" || item.type !== "::" + item.name))
      return unsupported7("source Class helpers require exact file-private declarations");
  }
  const authority = nativeProvider ? Object.freeze({ kind: "native-provider", providerId: sourceId, evidenceSha256: sourceSha256 }) : Object.freeze({ kind: "authored-source", sourceId, sourceSha256 });
  class SourceGlobal {
  }
  Object.defineProperty(SourceGlobal, Symbol.for("laya.flash.classIdentifier"), { value: "global" });
  markDomainOwnedDefinition(SourceGlobal);
  const global = new SourceGlobal();
  const state3 = { domain, authority, bindings: /* @__PURE__ */ new Map(), state: "initializing" };
  globals.set(global, state3);
  const privateScope = Object.freeze({ kind: "file-private" });
  privateScopes.set(privateScope, state3);
  const unit = Object.freeze({ global, export: (name2, uri = "", scope2) => readAS3ScriptGlobalDeclaration(global, name2, uri, scope2)?.value });
  owner.units.set(sourceId, unit);
  const publishGlobalMetadata = () => registerFlashTypeMetadata(SourceGlobal, {
    name: "global",
    base: "Object",
    isDynamic: true,
    isFinal: true,
    instance: {
      methods: [],
      accessors: [],
      variables: declarations4.filter((item) => item.visibility !== "file-private" && item.kind === "variable").map((item) => ({ ...item, declaredBy: "global" })),
      constants: declarations4.filter((item) => item.visibility !== "file-private" && item.kind === "constant").map((item) => ({ ...item, declaredBy: "global" }))
    },
    statics: { variables: [], accessors: [], methods: [], constants: [] }
  });
  let factoryThrew = false, invalidPublication = false;
  const published = /* @__PURE__ */ new Set();
  let nextClass = 0;
  try {
    if (classScript) {
      for (const declaration2 of sourceClasses ? declarations4 : [declarations4[0]])
        state3.bindings.set(key(declaration2.name, declaration2.uri, declaration2.visibility), Object.freeze({
          declaration: declaration2,
          storage: Object.freeze({ name: declaration2.name, uri: declaration2.uri, value: null })
        }));
      publishGlobalMetadata();
    }
    const publishClass = (index, value2) => {
      try {
        if (!sourceClasses || state3.state !== "initializing" || owner.closed || index !== nextClass || index >= declarations4.length)
          return unsupported7("source Class publication order or lifetime");
        const declaration2 = declarations4[index];
        if (typeof value2 !== "function" || builtinClasses4.has(value2) || !describeRegisteredFlashType(value2)?.isStatic)
          return unsupported7("source Class publication requires a registered Class");
        validateConstant(value2, declaration2.type);
        if (sourceDefinitionOwners.has(value2)) return unsupported7("source Class already belongs to a script instance");
        sourceDefinitionOwners.set(value2, domain);
        markDomainOwnedDefinition(value2);
        published.add(value2);
        state3.bindings.set(key(declaration2.name, declaration2.uri, declaration2.visibility), Object.freeze({
          declaration: declaration2,
          storage: Object.freeze({ name: declaration2.name, uri: declaration2.uri, visibility: declaration2.visibility, value: value2 })
        }));
        nextClass++;
      } catch (error4) {
        invalidPublication = true;
        throw error4;
      }
    };
    const context2 = Object.freeze({ global, privateScope, ...sourceClasses ? { publishClass } : {}, registerFunction: (fn, parameterCount) => {
      if (state3.state === "failed") return unsupported7("failed script creation context");
      registerAS3Function(fn, global, parameterCount);
      return fn;
    } });
    let emitted;
    try {
      emitted = factory(context2);
    } catch (error4) {
      factoryThrew = true;
      throw error4;
    }
    if (owner.closed) return unsupported7("script domain unloaded during initialization");
    if (sourceClasses && (invalidPublication || nextClass !== declarations4.length)) return unsupported7("source Class publication is incomplete");
    if (!Array.isArray(emitted) || emitted.length !== declarations4.length) return unsupported7("factory must supply every declared binding");
    const byName = /* @__PURE__ */ new Map();
    for (let index = 0; index < emitted.length; index++) {
      const item = data2(emitted, String(index));
      if (!item || typeof item !== "object") return unsupported7("dense emitted binding records required");
      const name2 = text(data2(item, "name"), "emitted binding name"), uri = text(data2(item, "uri", true) ?? "", "namespace", true);
      const visibility = data2(item, "visibility", true) ?? "public";
      if (visibility !== "public" && visibility !== "file-private") return unsupported7("invalid emitted namespace visibility");
      const id = key(name2, uri, visibility);
      if (!names.has(id) || byName.has(id)) return unsupported7("factory binding differs from source declaration");
      byName.set(id, Object.freeze({
        name: name2,
        uri,
        visibility,
        value: data2(item, "value", true),
        get: data2(item, "get", true),
        set: data2(item, "set", true)
      }));
    }
    for (const item of declarations4) {
      const storage3 = byName.get(key(item.name, item.uri, item.visibility));
      if (item.kind === "variable") {
        if (typeof storage3.get !== "function" || typeof storage3.set !== "function") return unsupported7("variables need actual native slot accessors");
      } else {
        if (storage3.get !== void 0 || storage3.set !== void 0) return unsupported7("constants require an actual immutable native value");
        validateConstant(storage3.value, item.type);
      }
      if (sourceClasses && state3.bindings.get(key(item.name, item.uri, item.visibility)).storage.value !== storage3.value)
        return unsupported7("source Class final value differs from published declaration");
      state3.bindings.set(key(item.name, item.uri, item.visibility), Object.freeze({ declaration: item, storage: storage3 }));
      if (item.visibility !== "file-private" && !item.uri && item.kind === "constant") Object.defineProperty(global, item.name, { value: storage3.value, enumerable: false });
    }
    const definitions2 = [...state3.bindings.values()].filter((binding) => !isAS3Interface(binding.storage.value) || binding.declaration.kind === "constant" && binding.declaration.type === binding.storage.value.name).map((binding) => binding.storage.value).filter((value2) => isAS3Interface(value2) || typeof value2 === "function" && !builtinClasses4.has(value2) && !!describeRegisteredFlashType(value2)?.isStatic);
    for (const value2 of definitions2) if (sourceDefinitionOwners.has(value2) && !published.has(value2))
      return unsupported7("source Class or interface must be created by this script instance, not reused across units or domains");
    if (!classScript) publishGlobalMetadata();
    for (const value2 of definitions2) {
      sourceDefinitionOwners.set(value2, domain);
      markDomainOwnedDefinition(value2);
    }
    state3.state = "ready";
    return unit;
  } catch (error4) {
    state3.state = classScript && factoryThrew && !invalidPublication && !owner.closed ? "retained" : "failed";
    owner.units.delete(sourceId);
    throw error4;
  }
}
function isAS3ScriptGlobal(value2) {
  return value2 !== null && typeof value2 === "object" && globals.has(value2) && globals.get(value2).state !== "failed";
}
function readAS3ScriptGlobalDeclaration(global, name2, uri = "", scope2) {
  const state3 = record4(global), binding = scopedBinding(state3, name2, uri, scope2);
  if (binding) return { value: read(binding) };
  if (state3.unavailable?.has(key(name2, uri))) return unsupported7("native builtin export is unavailable: " + name2);
  if (uri) return sourceError2(1069);
  return void 0;
}
function hasAS3ScriptGlobalDeclaration(global, name2, scope2) {
  const state3 = record4(global);
  if (state3.unavailable?.has(key(name2))) return unsupported7("native builtin export is unavailable: " + name2);
  return scopedBinding(state3, name2, "", scope2) !== void 0;
}
function setAS3ScriptGlobalProperty(global, name2, value2, uri = "", scope2) {
  const state3 = record4(global), binding = scopedBinding(state3, name2, uri, scope2);
  if (state3.unavailable?.has(key(name2, uri))) return unsupported7("native builtin export is unavailable: " + name2);
  if (binding) {
    if (binding.declaration.kind === "constant") return sourceError2(1074);
    binding.storage.set(scalarType(value2, binding.declaration.type));
    return;
  }
  if (uri) return sourceError2(1056);
  Object.defineProperty(global, name2, { value: value2, writable: true, enumerable: true, configurable: true });
}
function deleteAS3ScriptGlobalProperty(global, name2, scope2) {
  if (scopedBinding(record4(global), name2, "", scope2) || hasAS3ScriptGlobalDeclaration(global, name2)) return false;
  return Reflect.deleteProperty(global, name2);
}
var builtinGlobal;
function getAS3BuiltinScriptGlobal() {
  if (!builtinGlobal) {
    const unit = instantiateUnit(createAS3ScriptDomain(), {
      providerId: "laya.flash.native-object-function-provider",
      evidenceSha256: "6df723e747d964dd204c62e12a777123ad36d13fc864827095a082f606e7eca6",
      bindings: [{ name: "Object", kind: "constant", type: "Object" }, { name: "Function", kind: "constant", type: "Function" }]
    }, () => [{ name: "Object", value: Object }, { name: "Function", value: Function }], true);
    builtinGlobal = unit.global;
    const unavailable = /* @__PURE__ */ new Set([
      ...[
        "Class",
        "Number",
        "String",
        "Boolean",
        "Array",
        "Namespace",
        "int",
        "uint",
        "NaN",
        "Infinity",
        "undefined",
        "AS3",
        "decodeURI",
        "decodeURIComponent",
        "encodeURI",
        "encodeURIComponent",
        "isNaN",
        "isFinite",
        "parseFloat",
        "parseInt",
        "escape",
        "unescape",
        "isXMLName"
      ].map((name2) => key(name2)),
      ...["INCLUDE_BASES", "INCLUDE_INTERFACES", "INCLUDE_VARIABLES", "INCLUDE_ACCESSORS", "USE_ITRAITS", "INCLUDE_METHODS", "INCLUDE_METADATA", "INCLUDE_CONSTRUCTOR", "INCLUDE_TRAITS", "HIDE_OBJECT", "FLASH10_FLAGS", "HIDE_NSURI_METHODS", "getQualifiedSuperclassName", "describeType", "getQualifiedClassName"].map((name2) => key(name2, "avmplus")),
      key("Vector", "__AS3__.vec")
    ]);
    Object.defineProperty(globals.get(builtinGlobal), "unavailable", { value: unavailable });
  }
  return builtinGlobal;
}

// ../engine/src/layaAir/flash/utils/AS3AuthoredVariableBinding.ts
var variables = /* @__PURE__ */ new WeakMap();
function registerAS3AuthoredVariable(target, name2, read4, write) {
  let slots = variables.get(target);
  if (!slots) variables.set(target, slots = /* @__PURE__ */ new Map());
  if (slots.has(name2)) throw new TypeError("Authored source variable already registered");
  slots.set(name2, { prototype: Object.getPrototypeOf(target), read: read4, write });
}

// ../engine/src/layaAir/flash/utils/AS3Addition.ts
function as3Add(left, right) {
  if (resolveAS3XMLConversionMethod(left, "valueOf") !== void 0 || resolveAS3XMLConversionMethod(right, "valueOf") !== void 0)
    throw new TypeError("AS3_ADDITION_UNSUPPORTED: E4X addition requires its source provider");
  if (typeof left === "string")
    return left + as3String(as3DefaultPrimitive(right, "string"));
  const leftPrimitive = as3DefaultPrimitive(left, "number");
  const rightPrimitive = as3DefaultPrimitive(right, "number");
  if (typeof leftPrimitive === "string" || typeof rightPrimitive === "string")
    return as3String(leftPrimitive) + as3String(rightPrimitive);
  return as3CoerceNumber(leftPrimitive) + as3CoerceNumber(rightPrimitive);
}

// ../engine/src/layaAir/flash/utils/AS3ArraySort.ts
var AS3ArraySortOptions = Object.freeze({
  CASEINSENSITIVE: 1,
  DESCENDING: 2,
  UNIQUESORT: 4,
  RETURNINDEXEDARRAY: 8,
  NUMERIC: 16
});
function unsupported8(reason) {
  throw new TypeError("AS3_ARRAY_SORT_UNSUPPORTED: " + reason);
}
function isObject(value2) {
  return value2 !== null && (typeof value2 === "object" || typeof value2 === "function");
}
function numeric(value2) {
  if (value2 === null) return 0;
  switch (typeof value2) {
    case "undefined":
      return NaN;
    case "number":
      return value2;
    case "boolean":
      return value2 ? 1 : 0;
    case "string":
      return as3NumberFromString(value2);
    default:
      return unsupported8("numeric object conversion requires its own source context");
  }
}
function flags(value2) {
  if (Array.isArray(value2) && value2.valueOf !== Object.prototype.valueOf)
    return unsupported8("nondefault Array.valueOf requires numeric conversion context");
  return (Array.isArray(value2) ? as3NumberFromString(as3String(value2)) : numeric(value2)) | 0;
}
function ownArrayValue(array, index) {
  const descriptor2 = Object.getOwnPropertyDescriptor(array, String(index));
  if (descriptor2 && !("value" in descriptor2)) return unsupported8("array-index accessors need source binding");
  if (descriptor2 && (!descriptor2.writable || !descriptor2.configurable))
    return unsupported8("nonwritable array indices are host representations");
  if (!descriptor2 && index in array) return unsupported8("inherited array indices need source prototype context");
  return descriptor2?.value;
}
function property(value2, name2, presenceOnly = false) {
  const metadata = describeRegisteredFlashType(value2);
  if (metadata) {
    const member = [...metadata.variables, ...metadata.accessors, ...metadata.methods].find((member2) => member2.name === name2 && !member2.uri);
    if (member) {
      if ("access" in member && member.access === "writeonly")
        return unsupported8("write-only trait reads need source property error authority");
      return presenceOnly ? true : Reflect.get(value2, name2);
    }
    if (!metadata.isDynamic) {
      if (presenceOnly) return false;
      const failure3 = new ReferenceError("Error #1069");
      Object.defineProperty(failure3, "errorID", { value: 1069 });
      throw failure3;
    }
    return unsupported8("dynamic class slots need public/private binding metadata");
  } else if (Object.getPrototypeOf(value2) !== Object.prototype && !Array.isArray(value2)) {
    return unsupported8("class property reads require exact source metadata");
  }
  const own2 = Object.getOwnPropertyDescriptor(value2, name2);
  if (own2) return presenceOnly ? true : Reflect.get(value2, name2);
  if (name2 in value2) return unsupported8("inherited dynamic properties require source prototype context");
  return presenceOnly ? false : void 0;
}
function numericCompare(left, right) {
  const x = numeric(left), y = numeric(right), difference = x - y;
  if (!Number.isNaN(difference)) return difference < 0 ? -1 : difference > 0 ? 1 : 0;
  return !Number.isNaN(y) ? 1 : !Number.isNaN(x) ? -1 : 0;
}
function stringCompare(left, right, insensitive) {
  let x = as3String(left), y = as3String(right);
  if (insensitive) {
    if (/[^\x00-\x7f]/.test(x) || /[^\x00-\x7f]/.test(y))
      return unsupported8("non-ASCII case folding requires source Unicode tables");
    x = x.toLowerCase();
    y = y.toLowerCase();
  }
  return x < y ? -1 : x > y ? 1 : 0;
}
function quicksort(index, count, compare) {
  if (count < 2) return;
  const stack = [[0, count - 1]];
  const swap = (a, b) => {
    const old = index[a];
    index[a] = index[b];
    index[b] = old;
  };
  while (stack.length) {
    let [lo, hi] = stack.pop();
    for (; ; ) {
      const size = hi - lo + 1;
      if (size < 4) {
        if (size === 3) {
          if (compare(lo, lo + 1) > 0) swap(lo, lo + 1);
          if (compare(lo + 1, lo + 2) > 0) {
            swap(lo + 1, lo + 2);
            if (compare(lo, lo + 1) > 0) swap(lo, lo + 1);
          }
        } else if (size === 2 && compare(lo, lo + 1) > 0) swap(lo, lo + 1);
        break;
      }
      swap(lo + Math.floor(size / 2), lo);
      let left = lo, right = hi + 1;
      for (; ; ) {
        do {
          left++;
        } while (left <= hi && compare(left, lo) <= 0);
        do {
          right--;
        } while (right > lo && compare(right, lo) >= 0);
        if (right < left) break;
        swap(left, right);
      }
      swap(lo, right);
      if (right - 1 - lo >>> 0 >= hi - left >>> 0) {
        if (lo + 1 < right) stack.push([lo, right - 1]);
        if (left < hi) {
          lo = left;
          continue;
        }
      } else {
        if (left < hi) stack.push([left, hi]);
        if (lo + 1 < right) {
          hi = right - 1;
          continue;
        }
      }
      break;
    }
  }
}
function as3ArraySortOn(values5, fieldName, options = 0, ..._ignored) {
  if (arguments.length < 2) {
    const failure3 = new Error("Error #1063");
    failure3.name = "ArgumentError";
    Object.defineProperty(failure3, "errorID", { value: 1063 });
    throw failure3;
  }
  if (!Array.isArray(values5) || Object.getPrototypeOf(values5) !== Array.prototype)
    return unsupported8("receiver requires an ordinary source Array");
  if (!Object.isExtensible(values5) || !Object.getOwnPropertyDescriptor(values5, "length")?.writable)
    return unsupported8("nonwritable arrays are host representations");
  const names = [], fieldFlags = [];
  let globalFlags = 0;
  if (typeof fieldName === "string") {
    globalFlags = flags(options);
    names.push(fieldName);
    fieldFlags.push(globalFlags);
  } else if (Array.isArray(fieldName)) {
    const count = fieldName.length;
    for (let i = 0; i < count; i++) {
      names.push(as3String(ownArrayValue(fieldName, i)));
      fieldFlags.push(0);
    }
    if (Array.isArray(options)) {
      if (options.length === count) {
        globalFlags = flags(ownArrayValue(options, 0));
        for (let i = 0; i < count; i++) fieldFlags[i] = flags(ownArrayValue(options, i));
      }
    } else {
      globalFlags = flags(options);
      fieldFlags.fill(globalFlags);
    }
  }
  const length = values5.length;
  if (length === 0) return values5;
  if (length >= 268435456) return unsupported8("array size exceeds captured allocation context");
  const index = new Array(length), entries2 = new Array(length), keys = new Array(length);
  let sortedCount = length, presentCount = length;
  const single = names.length === 1;
  for (let i = length - 1; i >= 0; i--) {
    index[i] = i;
    const value2 = ownArrayValue(values5, i);
    entries2[i] = value2;
    if (single && isObject(value2)) keys[i] = property(value2, names[0]);
    else if (single || value2 === void 0) {
      --sortedCount;
      const old = index[i];
      index[i] = index[sortedCount];
      if (!Object.prototype.hasOwnProperty.call(values5, i)) {
        --presentCount;
        index[sortedCount] = index[presentCount];
        index[presentCount] = old;
      } else index[sortedCount] = old;
    }
  }
  const compare = (a, b) => {
    if (single) {
      const option2 = fieldFlags[0];
      const left2 = keys[index[option2 & 2 ? b : a]], right2 = keys[index[option2 & 2 ? a : b]];
      return option2 & 16 ? numericCompare(left2, right2) : stringCompare(left2, right2, !!(option2 & 1));
    }
    const left = entries2[index[a]], right = entries2[index[b]];
    let option = globalFlags, difference = 0;
    if (!isObject(left) || !isObject(right)) {
      difference = isObject(right) ? 1 : isObject(left) ? -1 : 0;
      return option & 2 ? -difference : difference;
    }
    for (let i = 0; i < names.length; i++) {
      option = fieldFlags[i];
      const x = property(left, names[i]), y = property(right, names[i]);
      if (x === void 0 || y === void 0) {
        if (y !== void 0) difference = 1;
        else if (x !== void 0) difference = -1;
        else {
          const hasX = property(left, names[i], true), hasY = property(right, names[i], true);
          difference = !hasX && hasY ? 1 : hasX && !hasY ? -1 : 0;
        }
      } else difference = option & 16 ? numericCompare(x, y) : stringCompare(x, y, !!(option & 1));
      if (difference !== 0) break;
    }
    return option & 2 ? -difference : difference;
  };
  quicksort(index, sortedCount, compare);
  if (globalFlags & 4) {
    for (let i = 0; i < length - 1; i++) if (compare(i, i + 1) === 0) return 0;
  }
  if (globalFlags & 8) return index;
  for (let i = 0; i < presentCount; i++) values5[i] = entries2[index[i]];
  for (let i = presentCount; i < length; i++) delete values5[i];
  return values5;
}
var diagnosticIds = /* @__PURE__ */ new WeakMap();
var nextDiagnosticId = 1;
function sortCoercionFailure(value2, target) {
  let spelling;
  if (isObject(value2)) {
    let id = diagnosticIds.get(value2);
    if (!id) diagnosticIds.set(value2, id = nextDiagnosticId++);
    const type = describeRegisteredFlashType(value2)?.name || (Array.isArray(value2) ? "[]" : "Object");
    spelling = type + "@" + id.toString(16);
  } else spelling = typeof value2 === "string" ? '"' + value2 + '"' : as3String(value2);
  throw createAS3ArraySortCoercionError(spelling, target);
}
function as3ArraySort(values5, ...args) {
  if (!Array.isArray(values5) || Object.getPrototypeOf(values5) !== Array.prototype)
    return unsupported8("receiver requires an ordinary source Array");
  if (!Object.isExtensible(values5) || !Object.getOwnPropertyDescriptor(values5, "length")?.writable)
    return unsupported8("nonwritable arrays are host representations");
  let option = 0, comparator;
  if (args.length) {
    if (typeof args[0] === "number") option = args[0] | 0;
    else if (typeof args[0] === "function" && as3Is(args[0], Function)) {
      comparator = args[0];
      if (args.length > 1) {
        if (typeof args[1] !== "number") return sortCoercionFailure(args[1], "Number");
        option = args[1] | 0;
      }
    } else return sortCoercionFailure(args[0], "Function");
  }
  const length = values5.length;
  if (!length) return values5;
  if (length >= 268435456) return unsupported8("array size exceeds captured allocation context");
  const index = new Array(length), entries2 = new Array(length);
  let sortedCount = length, presentCount = length;
  for (let i = length - 1; i >= 0; i--) {
    index[i] = i;
    const value2 = ownArrayValue(values5, i);
    entries2[i] = value2;
    if (!comparator && option & 16 && typeof value2 !== "number" && Number.isNaN(as3CoerceNumber(value2)))
      return sortCoercionFailure(value2, "Number");
    if (value2 === void 0) {
      --sortedCount;
      const old = index[i];
      index[i] = index[sortedCount];
      if (!Object.prototype.hasOwnProperty.call(values5, i)) {
        --presentCount;
        index[sortedCount] = index[presentCount];
        index[presentCount] = old;
      } else index[sortedCount] = old;
    }
  }
  const compare = (a, b) => {
    const left = entries2[index[option & 2 ? b : a]], right = entries2[index[option & 2 ? a : b]];
    if (comparator) {
      const result = as3CoerceNumber(as3CallValue(comparator, () => [left, right], values5));
      return result > 0 ? 1 : result < 0 ? -1 : 0;
    }
    if (option & 16) {
      const x = as3CoerceNumber(left), y = as3CoerceNumber(right), result = x - y;
      return !Number.isNaN(result) ? result < 0 ? -1 : result > 0 ? 1 : 0 : !Number.isNaN(y) ? 1 : !Number.isNaN(x) ? -1 : 0;
    }
    return stringCompare(left, right, !!(option & 1));
  };
  quicksort(index, sortedCount, compare);
  if (option & 4) {
    for (let i = 0; i < length - 1; i++) if (compare(i, i + 1) === 0) return 0;
  }
  if (option & 8) return index;
  for (let i = 0; i < presentCount; i++) values5[i] = entries2[index[i]];
  for (let i = presentCount; i < length; i++) delete values5[i];
  return values5;
}

// ../engine/src/layaAir/flash/utils/AS3Vector.ts
var validSpecs = /* @__PURE__ */ new WeakSet();
var specsByInstance = /* @__PURE__ */ new WeakMap();
var elementIdentities = /* @__PURE__ */ new WeakMap();
function typeError2(_id) {
  return createAS3VectorCoercionError();
}
function requireSpec(spec) {
  if (spec === null || typeof spec !== "object" || !validSpecs.has(spec)) {
    throw new TypeError("Unregistered AS3 Vector specialization");
  }
}
function as3VectorTypeName(spec) {
  requireSpec(spec);
  return "__AS3__.vec::Vector.<" + spec.id + ">";
}
function getAS3VectorInstanceTypeName(value2) {
  if (value2 === null || typeof value2 !== "object") return null;
  const spec = specsByInstance.get(value2);
  return spec ? as3VectorTypeName(spec) : null;
}
function as3VectorIs(value2, spec) {
  requireSpec(spec);
  if (value2 == null) return false;
  const source = specsByInstance.get(value2);
  if (!source) return false;
  if (source === spec) return true;
  const from = elementIdentities.get(source), to = elementIdentities.get(spec);
  const numeric2 = from.kind === "primitive" && ["int", "uint", "Number"].includes(from.name);
  if (to.kind === "primitive" && to.name === "*") return !numeric2;
  if (to.kind === "primitive" && to.name === "Object")
    return !numeric2 && from.kind !== "interface" && !(from.kind === "primitive" && from.name === "*");
  if ((to.kind === "class" || to.kind === "interface") && (from.kind === "class" || from.kind === "interface"))
    return as3ReferenceTypeExtends(from.type, to.type);
  return false;
}
function as3CoerceVector(value2, spec) {
  requireSpec(spec);
  if (value2 == null) return null;
  if (as3VectorIs(value2, spec)) return value2;
  throw typeError2(spec.id);
}

// ../engine/src/layaAir/flash/utils/QName.ts
var values3 = /* @__PURE__ */ new WeakMap();
var declaredMethods = /* @__PURE__ */ new Set(["toString", "valueOf", "hasOwnProperty", "isPrototypeOf", "propertyIsEnumerable"]);
var readableProperties = /* @__PURE__ */ new Set([
  "uri",
  "localName",
  ...declaredMethods,
  "constructor",
  "toLocaleString",
  "setPropertyIsEnumerable"
]);
function error2(value2, errorID) {
  Object.defineProperty(value2, "errorID", { value: errorID, enumerable: false });
  return value2;
}
function checkArity(count, minimum, maximum) {
  if (count >= minimum && count <= maximum) return;
  const failure3 = error2(new Error("Error #1063"), 1063);
  failure3.name = "ArgumentError";
  throw failure3;
}
function read2(value2) {
  const record5 = value2 !== null && (typeof value2 === "object" || typeof value2 === "function") ? values3.get(value2) : void 0;
  if (!record5) throw error2(new TypeError("Incompatible QName receiver"), 1034);
  return record5;
}
function create(defaultUri, args, target) {
  const namespace3 = args.length < 2 ? void 0 : args[0];
  const name2 = args.length < 2 ? args[0] : args[1];
  if (args.length < 2 && name2 instanceof QName) return name2;
  let uri;
  if (namespace3 === null) uri = null;
  else if (namespace3 !== void 0) {
    const original = namespace3 instanceof QName ? read2(namespace3).uri : void 0;
    uri = original !== void 0 && original !== null ? original : as3String(namespace3);
  }
  const localName = name2 instanceof QName ? read2(name2).localName : name2 === void 0 ? "" : as3String(name2);
  if (namespace3 === void 0) uri = name2 instanceof QName ? read2(name2).uri : localName === "*" ? null : defaultUri;
  const instance = new globalThis.Proxy(target, {
    get: (object2, property2, receiver3) => {
      if (typeof property2 === "symbol" || readableProperties.has(property2))
        return Reflect.get(object2, property2, receiver3);
      throw error2(new ReferenceError("Error #1069"), 1069);
    },
    has: (object2, property2) => typeof property2 === "symbol" ? Reflect.has(object2, property2) : readableProperties.has(property2),
    deleteProperty: (object2, property2) => typeof property2 === "symbol" ? Reflect.deleteProperty(object2, property2) : false,
    set: (_target, property2) => {
      const code = property2 === "uri" || property2 === "localName" ? 1074 : typeof property2 === "string" && declaredMethods.has(property2) ? 1037 : 1056;
      throw error2(new ReferenceError(`Error #${code}`), code);
    }
  });
  const record5 = {
    uri,
    localName,
    text: () => uri === null ? "*::" + localName : uri === "" ? localName : uri + "::" + localName,
    value: () => instance,
    own: (...args2) => {
      checkArity(args2.length, 0, 1);
      const name3 = as3String(args2[0]);
      return name3 === "uri" || name3 === "localName";
    },
    enumerable: (...args2) => {
      checkArity(args2.length, 0, 1);
      as3String(args2[0]);
      return false;
    },
    prototype: (...args2) => {
      checkArity(args2.length, 0, 1);
      return Reflect.apply(Object.prototype.isPrototypeOf, instance, [args2[0]]);
    }
  };
  values3.set(instance, record5);
  values3.set(target, record5);
  for (const field of ["uri", "localName"]) Object.defineProperty(target, field, {
    get: () => record5[field],
    enumerable: true,
    configurable: false
  });
  Object.preventExtensions(target);
  return instance;
}
var QName = class _QName {
  constructor(first, second, ..._ignored) {
    if (new.target !== _QName) throw new TypeError("QName is final");
    return create("", Array.prototype.slice.call(arguments), this);
  }
  static [Symbol.hasInstance](value2) {
    return value2 !== null && (typeof value2 === "object" || typeof value2 === "function") && values3.has(value2);
  }
  static toString() {
    return "[class QName]";
  }
  get toString() {
    return this === _QName.prototype ? emptyText : read2(this).text;
  }
  get valueOf() {
    return this === _QName.prototype ? prototypeValue : read2(this).value;
  }
  get hasOwnProperty() {
    return read2(this).own;
  }
  get propertyIsEnumerable() {
    return read2(this).enumerable;
  }
  get isPrototypeOf() {
    return read2(this).prototype;
  }
  toLocaleString(..._args) {
    if (this === void 0 || this === null || this === globalThis) return "[object global]";
    if (this instanceof _QName) return "[object QName]";
    if (typeof this === "string") return "[object String]";
    if (typeof this === "number") return "[object Number]";
    if (typeof this === "boolean") return "[object Boolean]";
    if (Array.isArray(this)) return "[object Array]";
    const prototype = Object.getPrototypeOf(this);
    if (this === _QName.prototype || prototype === Object.prototype || prototype === null) return "[object Object]";
    throw new Error("AS3_QNAME_UNSUPPORTED: borrowed Object conversion requires source type metadata");
  }
  setPropertyIsEnumerable(name2, _enumerable) {
    checkArity(arguments.length, 2, 2);
    if (!(this instanceof _QName))
      throw new Error("AS3_QNAME_UNSUPPORTED: borrowed Object property enumeration requires its own provider");
    read2(this);
    as3String(name2);
    throw error2(new ReferenceError("Error #1056"), 1056);
  }
};
var emptyText = () => "";
var prototypeValue = () => QName.prototype;

// ../engine/src/layaAir/flash/utils/Dictionary.ts
var dictionaryDeclaration = declareAS3ReferenceType("flash.utils::Dictionary");
var dictionaryValues = /* @__PURE__ */ new WeakSet();
var sealedObjectMethods = /* @__PURE__ */ new Set(["hasOwnProperty", "propertyIsEnumerable", "isPrototypeOf"]);
function isFlashDictionary(value2) {
  return value2 !== null && typeof value2 === "object" && dictionaryValues.has(value2);
}
function namespace(mode) {
  if (mode !== "public" && mode !== "public-and-AS3") throw new TypeError("Unsupported Dictionary namespace context");
}
function canonicalKey(value2) {
  if (value2 instanceof QName) throw new TypeError("Dictionary namespaced keys are unsupported");
  if (isObjectKey(value2)) return value2;
  const text2 = as3String(value2);
  if (/^(0|[1-9][0-9]{0,8})$/.test(text2)) {
    const integer = Number(text2);
    if (integer <= 268435455) return integer;
  }
  return text2;
}
var dictionaryToJSON = function(_key) {
  as3CheckArgumentCount(arguments.length, 1, 1);
  as3CoerceString(_key);
  return "Dictionary";
};
var sourcePrototype;
function getDictionarySourcePrototype() {
  if (sourcePrototype) return sourcePrototype;
  const prototype = registerAS3ClassPrototype(Dictionary, null);
  registerAS3PropertyTraits(Dictionary, []);
  registerAS3Function(dictionaryToJSON, getAS3BuiltinScriptGlobal(), 1);
  Object.defineProperty(prototype, "toJSON", { value: dictionaryToJSON, writable: true, configurable: true, enumerable: false });
  sourcePrototype = prototype;
  return prototype;
}
var deletedIntegerSlot = Symbol("deleted integer Dictionary slot");
function releaseEntry(entry) {
  entry.active = false;
  entry.value = void 0;
  if (entry.kind === "strong") entry.key = void 0;
}
function isObjectKey(value2) {
  return typeof value2 === "object" && value2 !== null || typeof value2 === "function";
}
var Dictionary = class {
  constructor(weakKeys = false) {
    this._strong = /* @__PURE__ */ new Map();
    this._weak = /* @__PURE__ */ new WeakMap();
    this._entries = [];
    // See tests/nativeDictionaryIntegerOrder/README.md for upstream algorithm
    // provenance and original Flash captures.
    // Adobe InlineHashtable starts with two key slots, probes quadratically,
    // and rehashes old buckets in traversal order. String/object atom buckets
    // depend on VM addresses; adding those retains the mixed-key contract.
    this._integerSlots = new Array(2);
    this._integerSize = 0;
    this._integerDeleted = false;
    as3CheckArgumentCount(arguments.length, 0, 1);
    this.weakKeys = weakKeys = !!weakKeys;
    const weakReference = globalThis.WeakRef ?? null;
    if (weakKeys && !weakReference)
      throw new Error("Weak-key Dictionary requires native WeakRef support");
    this._weakReference = weakReference;
    dictionaryGeneration.enterInstance(this);
    dictionaryValues.add(this);
    this._intrinsics = {
      hasOwnProperty: (key3) => this.entryFor(canonicalKey(as3CoerceString(key3))) !== void 0,
      propertyIsEnumerable: (key3) => this.entryFor(canonicalKey(as3CoerceString(key3))) !== void 0,
      isPrototypeOf: (value2) => value2 !== null && (typeof value2 === "object" || typeof value2 === "function") && Object.prototype.isPrototypeOf.call(this, value2),
      // Dictionary's HeapHashtable does not track ScriptObject's enumerability flag.
      setPropertyIsEnumerable: (key3, _enumerable) => {
        as3CoerceString(key3);
      },
      toString: () => "[object Dictionary]"
    };
    getAS3ObjectIntrinsic(this, "valueOf", "public", this._intrinsics);
    getDictionarySourcePrototype();
  }
  get size() {
    let count = 0;
    for (const _entry of this.liveEntries()) count++;
    return count;
  }
  has(key3, namespaces = "public-and-AS3") {
    namespace(namespaces);
    const canonical = canonicalKey(key3);
    if (this.entryFor(canonical) !== void 0) return true;
    if (typeof key3 === "number" && Number.isInteger(key3) && key3 >= 0 && key3 <= 2147483647 && !Object.is(key3, -0)) return false;
    return !isObjectKey(canonical) && this.hasPrototypeProperty(as3String(canonical));
  }
  /** QName membership bypasses identity storage and consults only public delegates. */
  hasPrototypeProperty(name2) {
    return !!getAS3ObjectDelegateProperty(this, name2, "public", this._intrinsics);
  }
  get(key3, namespaces = "public-and-AS3") {
    namespace(namespaces);
    const canonical = canonicalKey(key3);
    if (namespaces === "public-and-AS3" && typeof canonical === "string" && sealedObjectMethods.has(canonical))
      return getAS3ObjectIntrinsic(this, canonical, namespaces, this._intrinsics);
    const entry = this.entryFor(canonical);
    if (entry) return entry.value;
    if (isObjectKey(canonical)) return void 0;
    return getAS3ObjectDelegateProperty(this, as3String(canonical), namespaces, this._intrinsics)?.value;
  }
  set(key3, value2, namespaces = "public-and-AS3") {
    namespace(namespaces);
    key3 = canonicalKey(key3);
    if (namespaces === "public-and-AS3" && typeof key3 === "string" && sealedObjectMethods.has(key3)) {
      const error4 = new ReferenceError("Error #1037");
      Object.defineProperty(error4, "errorID", { value: 1037 });
      throw error4;
    }
    const existing = this.entryFor(key3);
    if (existing) {
      existing.value = value2;
      return this;
    }
    if (this.weakKeys && isObjectKey(key3)) {
      this._integerSlots = null;
      const entry = {
        kind: "weak",
        key: new this._weakReference(key3),
        value: value2,
        active: true
      };
      this._weak.set(key3, entry);
      this._entries.push(entry);
    } else {
      const entry = { kind: "strong", key: key3, value: value2, active: true };
      this._strong.set(key3, entry);
      this._entries.push(entry);
      this.trackIntegerEntry(key3, entry);
    }
    return this;
  }
  delete(key3, namespaces = "public-and-AS3") {
    namespace(namespaces);
    key3 = canonicalKey(key3);
    if (namespaces === "public-and-AS3" && typeof key3 === "string" && sealedObjectMethods.has(key3)) return false;
    const entry = this.entryFor(key3);
    if (!entry) return true;
    if (this._integerSlots && typeof key3 === "number") {
      this._integerSlots[this.findIntegerSlot(key3, this._integerSlots)] = deletedIntegerSlot;
      this._integerDeleted = true;
    }
    releaseEntry(entry);
    if (entry.kind === "weak") this._weak.delete(key3);
    else this._strong.delete(key3);
    return true;
  }
  clear() {
    for (const entry of this._entries) releaseEntry(entry);
    this._entries = [];
    this._strong.clear();
    this._weak = /* @__PURE__ */ new WeakMap();
    this._integerSlots = new Array(2);
    this._integerSize = 0;
    this._integerDeleted = false;
  }
  *keys() {
    for (const entry of this.liveEntries()) yield entry[0];
  }
  *values() {
    for (const entry of this.liveEntries()) yield entry[1];
  }
  *entries() {
    yield* this.liveEntries();
  }
  entryFor(key3) {
    if (this.weakKeys && isObjectKey(key3)) return this._weak.get(key3);
    return this._strong.get(key3);
  }
  *liveEntries() {
    if (this._integerSlots) {
      const visited = /* @__PURE__ */ new Set();
      for (let index = 0; this._integerSlots && index < this._integerSlots.length; index++) {
        const slot = this._integerSlots[index];
        if (slot && slot !== deletedIntegerSlot && slot.entry.active) {
          visited.add(slot.entry);
          yield [slot.key, slot.entry.value];
        }
      }
      if (this._integerSlots) return;
      for (const entry of this._entries) {
        if (!entry.active || visited.has(entry)) continue;
        if (entry.kind === "strong") yield [entry.key, entry.value];
        else {
          const key3 = entry.key.deref();
          if (key3 !== void 0) yield [key3, entry.value];
        }
      }
      return;
    }
    let stale = 0;
    for (const entry of this._entries) {
      if (!entry.active) {
        stale++;
        continue;
      }
      if (entry.kind === "strong") {
        yield [entry.key, entry.value];
        continue;
      }
      const key3 = entry.key.deref();
      if (key3 !== void 0) yield [key3, entry.value];
      else {
        releaseEntry(entry);
        stale++;
      }
    }
    if (stale > 32 && stale * 2 >= this._entries.length)
      this._entries = this._entries.filter((entry) => entry.active);
  }
  findIntegerSlot(key3, slots) {
    const mask = slots.length - 1;
    let index = key3 & mask, step = 7;
    while (slots[index] !== void 0 && (slots[index] === deletedIntegerSlot || slots[index].key !== key3))
      index = index + ++step & mask;
    return index;
  }
  trackIntegerEntry(key3, entry) {
    if (!this._integerSlots) return;
    if (typeof key3 !== "number") {
      this._integerSlots = null;
      return;
    }
    const slots = this._integerSlots;
    slots[this.findIntegerSlot(key3, slots)] = { key: key3, entry };
    this._integerSize++;
    if (5 * (this._integerSize + 1) < 4 * slots.length) return;
    const grown = new Array(this._integerDeleted ? slots.length : slots.length * 2);
    this._integerSize = 0;
    for (const slot of slots) if (slot && slot !== deletedIntegerSlot) {
      grown[this.findIntegerSlot(slot.key, grown)] = slot;
      this._integerSize++;
    }
    this._integerDeleted = false;
    this._integerSlots = grown;
  }
};
registerFlashTypeMetadata(Dictionary, {
  name: "flash.utils::Dictionary",
  base: "Object",
  isDynamic: true,
  isFinal: false,
  instance: { variables: [], accessors: [], methods: [] },
  statics: { variables: [], accessors: [{ name: "prototype", declaredBy: "Class", access: "readonly" }], methods: [] }
});
var dictionaryGeneration = dictionaryDeclaration.publishGeneration(Dictionary);
registerAS3Constructor(Dictionary, {
  minimum: 0,
  maximum: 1,
  // The actual constructor owns the single optional Boolean coercion. Keep
  // omitted arguments omitted and preserve count for its authored signature.
  coerceArguments: (arguments_) => arguments_
});

// ../engine/src/layaAir/flash/utils/AS3PatternProgram.ts
function compilePatternProgram(branches, captures) {
  const code = [{ op: "match" }];
  const emit = (instruction) => {
    code.push(instruction);
    return code.length - 1;
  };
  function alternatives(branches2, next) {
    const starts = branches2.map((branch) => {
      let start2 = branch.endAnchored ? emit({ op: "end", next }) : next;
      for (let index = branch.terms.length - 1; index >= 0; index--) start2 = term(branch.terms[index], start2);
      return branch.anchored ? emit({ op: "start", next: start2 }) : start2;
    });
    let start = starts[starts.length - 1];
    for (let index = starts.length - 2; index >= 0; index--) start = emit({ op: "split", first: starts[index], second: start });
    return start;
  }
  function term(value2, next) {
    const body = (next2) => {
      if (!value2.group) return emit({ op: "atom", atom: value2, next: next2 });
      const end = value2.capture === void 0 ? next2 : emit({ op: "save", slot: value2.capture * 2 + 1, next: next2 });
      const start = alternatives(value2.group, end);
      return value2.capture === void 0 ? start : emit({ op: "save", slot: value2.capture * 2, next: start });
    };
    if (value2.min === 1 && value2.max === 1) return body(next);
    const repeat = emit({ op: "match" }), again = emit({ op: "again", repeat });
    code[repeat] = { op: "repeat", min: value2.min, max: value2.max, body: body(again), next };
    return repeat;
  }
  return { instructions: code, start: alternatives(branches, 0), captures };
}
function matchPatternProgram(program, codes, from) {
  const stack = [{ pc: program.start, position: from, captures: Array(program.captures * 2).fill(-1), repetitions: {} }];
  const visited = /* @__PURE__ */ new Set();
  const terminal = (position) => position === codes.length || position === codes.length - 1 && [10, 11, 12, 13, 133, 8232, 8233].includes(codes[position]) || position === codes.length - 2 && codes[position] === 13 && codes[position + 1] === 10;
  while (stack.length) {
    let { pc, position, captures, repetitions } = stack.pop();
    while (true) {
      const key3 = pc + ":" + position + ":" + Object.keys(repetitions).map((id) => {
        const repeat = program.instructions[+id], state3 = repetitions[+id];
        const count = repeat.max === Infinity ? Math.min(state3.count, repeat.min) : state3.count;
        return id + "," + count + "," + state3.from;
      }).join(";");
      if (visited.has(key3)) break;
      visited.add(key3);
      const instruction = program.instructions[pc];
      if (instruction.op === "match") return { end: position, captures: Array.from({ length: program.captures }, (_, i) => [captures[i * 2], captures[i * 2 + 1]]) };
      if (instruction.op === "atom") {
        if (position >= codes.length || instruction.atom.ranges.some(([low, high]) => low <= codes[position] && codes[position] <= high) === instruction.atom.exclude) break;
        position++;
        pc = instruction.next;
      } else if (instruction.op === "start") {
        if (position !== 0) break;
        pc = instruction.next;
      } else if (instruction.op === "end") {
        if (!terminal(position)) break;
        pc = instruction.next;
      } else if (instruction.op === "save") {
        captures = captures.slice();
        captures[instruction.slot] = position;
        pc = instruction.next;
      } else if (instruction.op === "split") {
        stack.push({ pc: instruction.second, position, captures, repetitions });
        pc = instruction.first;
      } else if (instruction.op === "repeat") {
        const previous = repetitions[pc] || { count: 0, from: position };
        const exit = { ...repetitions };
        delete exit[pc];
        if (previous.count >= instruction.max) {
          repetitions = exit;
          pc = instruction.next;
          continue;
        }
        if (previous.count >= instruction.min) stack.push({ pc: instruction.next, position, captures, repetitions: exit });
        repetitions = { ...repetitions, [pc]: { count: previous.count, from: position } };
        pc = instruction.body;
      } else {
        const previous = repetitions[instruction.repeat], repeat = program.instructions[instruction.repeat];
        if (position === previous.from) {
          repetitions = { ...repetitions };
          delete repetitions[instruction.repeat];
          pc = repeat.next;
        } else {
          repetitions = { ...repetitions, [instruction.repeat]: { count: previous.count + 1, from: position } };
          pc = instruction.repeat;
        }
      }
    }
  }
  return void 0;
}

// ../engine/src/layaAir/flash/utils/AS3StringIntrinsics.ts
function unsupported9(message) {
  throw new TypeError("AS3_STRING_INTRINSIC_UNSUPPORTED: " + message);
}
function receiver(value2, member) {
  if (value2 == null) as3GetProperty(value2, member);
  if (typeof value2 !== "string") return unsupported9("primitive String receiver required");
  return value2;
}
var patterns = /* @__PURE__ */ new WeakMap();
var vertical = [[10, 13], [133, 133], [8232, 8233]];
var whitespace = [
  [9, 13],
  [32, 32],
  [133, 133],
  [160, 160],
  [5760, 5760],
  [6158, 6158],
  [8192, 8202],
  [8232, 8233],
  [8239, 8239],
  [8287, 8287],
  [12288, 12288]
];
function utf8View(input) {
  let text2 = "", bytes = 0;
  const scalars = [];
  for (let index = 0; index < input.length; ) {
    let code = input.charCodeAt(index++);
    if (code >= 55296 && code <= 56319) {
      const low = input.charCodeAt(index);
      if (low >= 56320 && low <= 57343) {
        code = 65536 + (code - 55296 << 10) + low - 56320;
        index++;
      } else code = 65533;
    } else if (code >= 56320 && code <= 57343) code = 65533;
    const start = text2.length;
    text2 += String.fromCodePoint(code);
    scalars.push({ code, start, end: text2.length, byte: bytes });
    bytes += code < 128 ? 1 : code < 2048 ? 2 : code < 65536 ? 3 : 4;
  }
  return { text: text2, scalars, bytes };
}
function compileSourceStringPattern(source, flags2 = "") {
  if (typeof source !== "string" || typeof flags2 !== "string") return unsupported9("pattern inputs require source String coercion");
  if (flags2 !== "" && flags2 !== "g") return unsupported9("unqualified pattern flags");
  const text2 = utf8View(source).text;
  if (!text2.length || text2.includes("\0")) return unsupported9("empty or NUL pattern");
  let at = 0, invalidRange = false;
  function codePoint() {
    const point = text2.codePointAt(at);
    if (point === void 0) return unsupported9("incomplete pattern atom");
    at += point > 65535 ? 2 : 1;
    return point;
  }
  function escaped() {
    if (at >= text2.length) return unsupported9("trailing escape");
    const letter = text2[at++];
    if (letter === "v") return vertical;
    if (letter === "d") return [[48, 57]];
    if (letter === "D") return [[0, 47], [58, 1114111]];
    const spaces = { n: 10, r: 13, t: 9, f: 12 };
    if (Object.prototype.hasOwnProperty.call(spaces, letter)) return spaces[letter];
    if (letter === "x" || letter === "u") {
      const count = letter === "x" ? 2 : 4, digits = text2.slice(at, at + count);
      if (digits.length !== count || !/^[0-9a-fA-F]+$/.test(digits)) return unsupported9("unqualified numeric escape");
      at += count;
      const code = Number.parseInt(digits, 16);
      if (code >= 55296 && code <= 57343) return unsupported9("escaped surrogate pattern");
      return code;
    }
    if ("\\/.^$|?*+()[]{}-".includes(letter)) return letter.charCodeAt(0);
    return unsupported9("unqualified escape");
  }
  function literal() {
    return text2[at] === "\\" ? (at++, escaped()) : codePoint();
  }
  let captures = 0, hasGroups = false;
  function parseBranches(nested) {
    const branches2 = [];
    do {
      const anchored = text2[at] === "^";
      if (anchored) at++;
      const terms = [];
      let endAnchored = false;
      while (at < text2.length && text2[at] !== "|" && (!nested || text2[at] !== ")")) {
        if (text2[at] === "$") {
          at++;
          endAnchored = true;
          if (at !== text2.length && text2[at] !== "|" && (!nested || text2[at] !== ")")) return unsupported9("end anchor requires branch end");
          break;
        }
        let atom, group, capture;
        if (text2[at] === "(") {
          at++;
          hasGroups = true;
          if (text2.slice(at, at + 2) === "?:") at += 2;
          else {
            if (text2[at] === "?") return unsupported9("unqualified group assertion");
            capture = captures++;
          }
          group = parseBranches(true);
          if (text2[at] !== ")") return unsupported9("unterminated group");
          at++;
          atom = { ranges: [], exclude: false };
        } else if (text2[at] === "[") {
          at++;
          const exclude = text2[at] === "^";
          if (exclude) at++;
          const ranges = [];
          while (at < text2.length && text2[at] !== "]") {
            if (text2[at] === "[") return unsupported9("nested or POSIX class");
            const low = literal();
            if (typeof low !== "number") {
              ranges.push(...low);
              continue;
            }
            if (text2[at] === "-" && text2[at + 1] !== "]" && at + 1 < text2.length) {
              at++;
              const high = literal();
              if (typeof high !== "number") {
                invalidRange = true;
                continue;
              }
              if (high < low) return unsupported9("descending class range");
              ranges.push([low, high]);
            } else ranges.push([low, low]);
          }
          if (text2[at] !== "]" || !ranges.length && !invalidRange) return unsupported9("unterminated or empty class");
          at++;
          atom = { ranges, exclude };
        } else if (text2[at] === ".") {
          at++;
          atom = { ranges: vertical, exclude: true };
        } else if (text2[at] === "\\" && (text2[at + 1] === "s" || text2[at + 1] === "S")) {
          atom = { ranges: whitespace, exclude: text2[at + 1] === "S" };
          at += 2;
        } else {
          if (".^$|?*+(){}]".includes(text2[at])) return unsupported9("unqualified pattern construct");
          const code = literal();
          atom = { ranges: typeof code === "number" ? [[code, code]] : code, exclude: false };
        }
        const quantifier = text2[at];
        let min = quantifier === "?" || quantifier === "*" ? 0 : 1;
        let max = quantifier === "+" || quantifier === "*" ? Infinity : 1;
        if (quantifier === "{") {
          const bounds = /^\{(\d+)(?:,(\d*))?\}/.exec(text2.slice(at));
          if (!bounds) return unsupported9("invalid bounded repetition");
          min = Number(bounds[1]);
          max = bounds[2] === void 0 ? min : bounds[2] === "" ? Infinity : Number(bounds[2]);
          if (!Number.isSafeInteger(min) || max !== Infinity && !Number.isSafeInteger(max) || max < min) return unsupported9("invalid repetition bounds");
          at += bounds[0].length;
        }
        if (quantifier === "?" || quantifier === "*" || quantifier === "+") at++;
        terms.push({ ...atom, min, max, group, capture });
      }
      branches2.push({ terms, anchored, endAnchored });
      if (at === text2.length || nested && text2[at] === ")") break;
      at++;
    } while (true);
    return branches2;
  }
  const branches = parseBranches(false);
  const consumes = (branch) => branch.terms.some((term) => term.min > 0 && (!term.group || term.group.every(consumes)));
  if (!branches.every(consumes)) return unsupported9("empty or nullable pattern alternative");
  return createPattern(source, { branches, invalidRange, program: hasGroups ? compilePatternProgram(branches, captures) : void 0, global: flags2 === "g", lastIndex: 0 });
}
function createPattern(source, state3) {
  const handle = /* @__PURE__ */ Object.create(null);
  Object.defineProperties(handle, {
    source: { value: source, enumerable: true },
    global: { value: state3.global, enumerable: true },
    lastIndex: { get: () => state3.lastIndex, set: (value2) => {
      state3.lastIndex = as3CoerceNumber(value2) | 0;
    }, enumerable: true }
  });
  patterns.set(handle, state3);
  return Object.preventExtensions(handle);
}
function patternState(pattern) {
  const state3 = pattern !== null && typeof pattern === "object" ? patterns.get(pattern) : void 0;
  return state3 ?? unsupported9("authenticated compiled source pattern required");
}
function find(view2, state3, from) {
  if (state3.invalidRange) return void 0;
  const scalars = view2.scalars;
  if (state3.program) {
    const codes = scalars.map((s) => s.code), offset = (index) => index === scalars.length ? view2.text.length : scalars[index].start;
    for (let start = from; start < scalars.length; start++) {
      const result = matchPatternProgram(state3.program, codes, start);
      if (result) return {
        start: scalars[start].start,
        end: offset(result.end),
        byte: scalars[start].byte,
        index: start,
        next: result.end,
        captures: result.captures.map(([low, high]) => low < 0 || high < 0 ? void 0 : view2.text.slice(offset(low), offset(high)))
      };
    }
    return void 0;
  }
  if (!state3.branches.length) {
    const scalar3 = scalars[from];
    return scalar3 && { start: scalar3.start, end: scalar3.start, byte: scalar3.byte, index: from, next: from + 1 };
  }
  const failed = state3.branches.map(() => /* @__PURE__ */ new Set());
  function suffix(branch, rejected, position) {
    function frame(index, start) {
      const term = branch.terms[index];
      let end = start;
      while (end < scalars.length && end - start < term.max) {
        const code = scalars[end].code;
        if (term.ranges.some(([low, high]) => low <= code && code <= high) === term.exclude) break;
        end++;
      }
      return { index, end, minimum: start + term.min, key: index + ":" + start };
    }
    const stack = [frame(0, position)];
    while (stack.length) {
      const current = stack[stack.length - 1];
      if (rejected.has(current.key) || current.end < current.minimum) {
        rejected.add(current.key);
        stack.pop();
        continue;
      }
      const next = current.end--, index = current.index + 1;
      if (index === branch.terms.length) {
        const terminal = next === scalars.length || next === scalars.length - 1 && vertical.some(([low, high]) => low <= scalars[next].code && scalars[next].code <= high) || next === scalars.length - 2 && scalars[next].code === 13 && scalars[next + 1].code === 10;
        if (!branch.endAnchored || terminal) return next;
        continue;
      }
      if (!rejected.has(index + ":" + next)) stack.push(frame(index, next));
    }
    return void 0;
  }
  for (let start = from; start < scalars.length; start++) {
    for (let b = 0; b < state3.branches.length; b++) {
      const branch = state3.branches[b];
      if (branch.anchored && start !== 0) continue;
      const next = suffix(branch, failed[b], start);
      if (next !== void 0) {
        return { start: scalars[start].start, end: scalars[next - 1].end, byte: scalars[start].byte, index: start, next };
      }
    }
  }
  return void 0;
}
function sourceStringSplit(value2, pattern) {
  if (arguments.length !== 2) return unsupported9("split requires exactly a receiver and compiled pattern");
  value2 = receiver(value2, "split");
  const state3 = patternState(pattern), view2 = utf8View(value2), result = [];
  if (!state3.branches.length) return unsupported9("empty split pattern requires separate qualification");
  let cursor = 0, from = 0;
  for (let match = find(view2, state3, from); match; match = find(view2, state3, from)) {
    result.push(view2.text.slice(cursor, match.start));
    if (match.captures) result.push(...match.captures);
    cursor = match.end;
    from = match.next;
  }
  result.push(view2.text.slice(cursor));
  return result;
}
function sourcePatternTest(pattern, ...args) {
  if (args.length > 1) return unsupported9("pattern test accepts zero or one source argument");
  const state3 = patternState(pattern);
  if (!state3.branches.length) return unsupported9("empty test pattern requires separate qualification");
  const value2 = args.length ? as3String(as3CoerceString(args[0])) : "";
  const view2 = utf8View(value2), from = state3.global ? state3.lastIndex : 0;
  const match = from < 0 ? void 0 : find(view2, state3, from);
  if (state3.global) state3.lastIndex = match ? match.end : 0;
  return !!match;
}
function sourcePatternExec(pattern, ...args) {
  if (args.length > 1) return unsupported9("pattern exec accepts zero or one source argument");
  const state3 = patternState(pattern);
  if (!state3.branches.length) return unsupported9("empty exec pattern requires separate qualification");
  const value2 = args.length ? as3String(as3CoerceString(args[0])) : "";
  const view2 = utf8View(value2), from = state3.global ? state3.lastIndex : 0;
  const match = from < 0 ? void 0 : find(view2, state3, from);
  if (state3.global) state3.lastIndex = match ? match.end : 0;
  return match ? Object.assign([view2.text.slice(match.start, match.end), ...match.captures || []], { index: match.start, input: value2 }) : null;
}
function sourceStringMatch(value2, pattern) {
  value2 = receiver(value2, "match");
  const state3 = patternState(pattern), view2 = utf8View(value2);
  if (!state3.branches.length) return unsupported9("empty match pattern requires separate qualification");
  if (!state3.global) {
    const match = find(view2, state3, 0);
    return match ? Object.assign([view2.text.slice(match.start, match.end), ...match.captures || []], { index: match.index, input: value2 }) : null;
  }
  const previous = state3.lastIndex, result = [];
  let from = 0;
  for (let match = find(view2, state3, from); match; match = find(view2, state3, from)) {
    result.push(view2.text.slice(match.start, match.end));
    from = match.next;
  }
  state3.lastIndex = previous === 0 ? 1 : 0;
  return result;
}
function replacementTokens(replacement, subject, match) {
  let result = "";
  const text2 = utf8View(replacement).text.split("\0", 1)[0];
  for (let i = 0; i < text2.length; i++) {
    if (text2[i] !== "$" || i + 1 >= text2.length) {
      result += text2[i];
      continue;
    }
    const next = text2[i + 1];
    if (next === "$") {
      result += "$";
      i++;
    } else if (next === "&") {
      result += subject.slice(match.start, match.end);
      i++;
    } else if (next === "`") {
      result += subject.slice(0, match.start);
      i++;
    } else if (next === "'") {
      result += subject.slice(match.end).split("\0", 1)[0];
      i++;
    } else if (next >= "0" && next <= "9" && match.captures?.length) {
      const second = text2[i + 2], first = +next;
      let capture = second >= "0" && second <= "9" ? first * 10 + +second : first;
      if (capture > match.captures.length) capture = first;
      if (capture > 0 && capture <= match.captures.length) {
        result += match.captures[capture - 1] ?? "";
        i += capture >= 10 ? 2 : 1;
      } else result += "$";
    } else result += "$";
  }
  return result;
}
function callbackString(value2) {
  const text2 = as3String(value2);
  if (text2.includes("\0")) return unsupported9("NUL callback output requires source String identity");
  return text2;
}
function sourceStringReplace(value2, pattern, replacement) {
  value2 = receiver(value2, "replace");
  const callback = as3Is(replacement, Function) ? replacement : null;
  const text2 = callback ? null : as3String(replacement);
  const state3 = patternState(pattern), view2 = utf8View(value2);
  let cursor = 0, from = 0, result = "";
  for (let match = find(view2, state3, from); match; match = find(view2, state3, from)) {
    result += view2.text.slice(cursor, match.start);
    result += callback ? callbackString(getAS3FunctionIntrinsic(callback, "apply")(
      void 0,
      [view2.text.slice(match.start, match.end), ...(match.captures || []).map((value3) => value3 ?? ""), match.byte, value2]
    )) : replacementTokens(text2, view2.text, match);
    cursor = match.end;
    from = match.next;
    if (!state3.global) break;
  }
  if (!state3.branches.length && !callback && (state3.global || !view2.scalars.length)) {
    const end = view2.text.length;
    result += view2.text.slice(cursor) + replacementTokens(
      text2,
      view2.text,
      { start: end, end, byte: view2.bytes, index: view2.scalars.length, next: view2.scalars.length + 1 }
    );
    cursor = end;
  }
  return result + view2.text.slice(cursor);
}

// ../engine/src/layaAir/flash/utils/RegExp.ts
var states = /* @__PURE__ */ new WeakMap();
var methods = /* @__PURE__ */ new WeakMap();
function unsupported10(reason) {
  throw new TypeError("AS3_REGEXP_UNSUPPORTED: " + reason);
}
function state2(value2) {
  const found = value2 !== null && typeof value2 === "object" ? states.get(value2) : void 0;
  return found ?? unsupported10("genuine source RegExp required");
}
function isFlashRegExp(value2) {
  return value2 !== null && typeof value2 === "object" && states.has(value2);
}
var RegExp2 = class _RegExp {
  constructor(pattern = void 0, flags2 = void 0) {
    if (new.target !== _RegExp) unsupported10("subclass construction is not qualified");
    let source, options;
    if (isFlashRegExp(pattern)) {
      if (flags2 !== void 0) throw createAS3RegExpCopyFlagsError();
      const original = state2(pattern);
      source = original.source;
      options = original.flags;
    } else {
      source = pattern === void 0 ? "" : as3String(pattern);
      const text2 = flags2 == null ? "" : as3String(flags2);
      options = Array.from("gimsx").filter((flag) => text2.includes(flag)).join("");
    }
    states.set(this, { source, flags: options, lastIndex: 0 });
  }
  get source() {
    return state2(this).source;
  }
  get global() {
    return state2(this).flags.includes("g");
  }
  get ignoreCase() {
    return state2(this).flags.includes("i");
  }
  get multiline() {
    return state2(this).flags.includes("m");
  }
  get dotall() {
    return state2(this).flags.includes("s");
  }
  get extended() {
    return state2(this).flags.includes("x");
  }
  get lastIndex() {
    const value2 = state2(this);
    return value2.pattern ? value2.pattern.lastIndex : value2.lastIndex;
  }
  set lastIndex(value2) {
    const current = state2(this), index = as3CoerceInt(value2);
    current.lastIndex = index;
    if (current.pattern) current.pattern.lastIndex = index;
  }
  test(...args) {
    as3CheckArgumentCount(args.length, 0, 1);
    return operate(this, (pattern) => sourcePatternTest(pattern, ...args));
  }
  exec(...args) {
    as3CheckArgumentCount(args.length, 0, 1);
    return operate(this, (pattern) => sourcePatternExec(pattern, ...args));
  }
  toString() {
    const value2 = state2(this);
    return "/" + value2.source + "/" + value2.flags;
  }
};
function operate(receiver3, body) {
  const value2 = state2(receiver3);
  if (!value2.pattern) {
    value2.pattern = compileSourceStringPattern(value2.source, value2.flags);
    value2.pattern.lastIndex = value2.lastIndex;
  }
  return body(value2.pattern);
}
function sourceRegExpStringMatch(value2, pattern) {
  return operate(pattern, (handle) => sourceStringMatch(value2, handle));
}
function sourceRegExpStringSplit(value2, pattern) {
  return operate(pattern, (handle) => sourceStringSplit(value2, handle));
}
function sourceRegExpStringReplace(value2, pattern, replacement) {
  return operate(pattern, (handle) => sourceStringReplace(value2, handle, replacement));
}
function getFlashRegExpMethod(receiver3, name2) {
  if (name2 !== "test" && name2 !== "exec") return void 0;
  state2(receiver3);
  let cache = methods.get(receiver3);
  if (!cache) methods.set(receiver3, cache = /* @__PURE__ */ new Map());
  let fn = cache.get(name2);
  if (!fn) {
    const method2 = name2 === "test" ? RegExp2.prototype.test : RegExp2.prototype.exec;
    fn = (...args) => Reflect.apply(method2, receiver3, args);
    registerAS3BoundMethodClosure(fn, 1);
    cache.set(name2, fn);
  }
  return fn;
}

// ../engine/src/layaAir/flash/utils/AS3NumberMethods.ts
function sourceNumberToString(value2, ...args) {
  if (typeof value2 !== "number") throw createAS3NumberMethodError(1004);
  as3CheckArgumentCount(args.length, 0, 1);
  const radix = args.length ? as3CoerceInt(args[0]) : 10;
  if (radix < 2 || radix > 36) throw createAS3NumberMethodError(1003);
  if (radix !== 10) throw new TypeError("AS3_NUMBER_METHOD_UNSUPPORTED: nondecimal toString radix");
  return as3NumberToString(value2);
}
var WeakReference = globalThis.WeakRef;
var methods2 = /* @__PURE__ */ new Map();
var Finalizer = globalThis.FinalizationRegistry;
var cleanup = WeakReference && Finalizer ? new Finalizer((entry) => {
  if (methods2.get(entry.value) === entry.reference) methods2.delete(entry.value);
}) : null;
function getAS3NumberToString(value2) {
  const immediate = Number.isInteger(value2) && !Object.is(value2, -0) && value2 >= -268435456 && value2 <= 268435455;
  let fn = immediate ? methods2.get(value2)?.deref() : void 0;
  if (!fn) {
    fn = (...args) => sourceNumberToString(value2, ...args);
    Object.defineProperty(fn, "length", { value: 1 });
    registerAS3BoundMethodClosure(fn, 1);
    if (immediate) {
      const reference = WeakReference ? new WeakReference(fn) : { deref: () => fn };
      methods2.set(value2, reference);
      cleanup?.register(fn, { value: value2, reference });
    }
  }
  return fn;
}

// ../engine/src/layaAir/flash/utils/AS3BooleanMethods.ts
function sourceBooleanToString(value2, ...args) {
  if (typeof value2 !== "boolean") throw createAS3BooleanMethodReceiverError();
  as3CheckArgumentCount(args.length, 0, 0);
  return value2 ? "true" : "false";
}
var methods3 = /* @__PURE__ */ new Map();
function getAS3BooleanToString(value2) {
  let fn = methods3.get(value2);
  if (!fn) {
    fn = (...args) => sourceBooleanToString(value2, ...args);
    registerAS3BoundMethodClosure(fn, 0);
    methods3.set(value2, fn);
  }
  return fn;
}

// ../engine/src/layaAir/flash/utils/AS3StringLowercaseData.ts
var sourceLowercaseMapping = /* @__PURE__ */ new Map([
  [65, 97],
  [66, 98],
  [67, 99],
  [68, 100],
  [69, 101],
  [70, 102],
  [71, 103],
  [72, 104],
  [73, 105],
  [74, 106],
  [75, 107],
  [76, 108],
  [77, 109],
  [78, 110],
  [79, 111],
  [80, 112],
  [81, 113],
  [82, 114],
  [83, 115],
  [84, 116],
  [85, 117],
  [86, 118],
  [87, 119],
  [88, 120],
  [89, 121],
  [90, 122],
  [192, 224],
  [193, 225],
  [194, 226],
  [195, 227],
  [196, 228],
  [197, 229],
  [198, 230],
  [199, 231],
  [200, 232],
  [201, 233],
  [202, 234],
  [203, 235],
  [204, 236],
  [205, 237],
  [206, 238],
  [207, 239],
  [208, 240],
  [209, 241],
  [210, 242],
  [211, 243],
  [212, 244],
  [213, 245],
  [214, 246],
  [216, 248],
  [217, 249],
  [218, 250],
  [219, 251],
  [220, 252],
  [221, 253],
  [222, 254],
  [256, 257],
  [258, 259],
  [260, 261],
  [262, 263],
  [264, 265],
  [266, 267],
  [268, 269],
  [270, 271],
  [272, 273],
  [274, 275],
  [276, 277],
  [278, 279],
  [280, 281],
  [282, 283],
  [284, 285],
  [286, 287],
  [288, 289],
  [290, 291],
  [292, 293],
  [294, 295],
  [296, 297],
  [298, 299],
  [300, 301],
  [302, 303],
  [304, 105],
  [306, 307],
  [308, 309],
  [310, 311],
  [313, 314],
  [315, 316],
  [317, 318],
  [319, 320],
  [321, 322],
  [323, 324],
  [325, 326],
  [327, 328],
  [330, 331],
  [332, 333],
  [334, 335],
  [336, 337],
  [338, 339],
  [340, 341],
  [342, 343],
  [344, 345],
  [346, 347],
  [348, 349],
  [350, 351],
  [352, 353],
  [354, 355],
  [356, 357],
  [358, 359],
  [360, 361],
  [362, 363],
  [364, 365],
  [366, 367],
  [368, 369],
  [370, 371],
  [372, 373],
  [374, 375],
  [376, 255],
  [377, 378],
  [379, 380],
  [381, 382],
  [385, 595],
  [386, 387],
  [388, 389],
  [390, 596],
  [391, 392],
  [393, 598],
  [394, 599],
  [395, 396],
  [398, 477],
  [399, 601],
  [400, 603],
  [401, 402],
  [403, 608],
  [404, 611],
  [406, 617],
  [407, 616],
  [408, 409],
  [412, 623],
  [413, 626],
  [415, 629],
  [416, 417],
  [418, 419],
  [420, 421],
  [422, 640],
  [423, 424],
  [425, 643],
  [428, 429],
  [430, 648],
  [431, 432],
  [433, 650],
  [434, 651],
  [435, 436],
  [437, 438],
  [439, 658],
  [440, 441],
  [444, 445],
  [452, 454],
  [453, 454],
  [455, 457],
  [456, 457],
  [458, 460],
  [459, 460],
  [461, 462],
  [463, 464],
  [465, 466],
  [467, 468],
  [469, 470],
  [471, 472],
  [473, 474],
  [475, 476],
  [478, 479],
  [480, 481],
  [482, 483],
  [484, 485],
  [486, 487],
  [488, 489],
  [490, 491],
  [492, 493],
  [494, 495],
  [497, 499],
  [498, 499],
  [500, 501],
  [502, 405],
  [503, 447],
  [504, 505],
  [506, 507],
  [508, 509],
  [510, 511],
  [512, 513],
  [514, 515],
  [516, 517],
  [518, 519],
  [520, 521],
  [522, 523],
  [524, 525],
  [526, 527],
  [528, 529],
  [530, 531],
  [532, 533],
  [534, 535],
  [536, 537],
  [538, 539],
  [540, 541],
  [542, 543],
  [546, 547],
  [548, 549],
  [550, 551],
  [552, 553],
  [554, 555],
  [556, 557],
  [558, 559],
  [560, 561],
  [562, 563],
  [902, 940],
  [904, 941],
  [905, 942],
  [906, 943],
  [908, 972],
  [910, 973],
  [911, 974],
  [913, 945],
  [914, 946],
  [915, 947],
  [916, 948],
  [917, 949],
  [918, 950],
  [919, 951],
  [920, 952],
  [921, 953],
  [922, 954],
  [923, 955],
  [924, 956],
  [925, 957],
  [926, 958],
  [927, 959],
  [928, 960],
  [929, 961],
  [930, 962],
  [931, 963],
  [932, 964],
  [933, 965],
  [934, 966],
  [935, 967],
  [936, 968],
  [937, 969],
  [938, 970],
  [939, 971],
  [984, 985],
  [986, 987],
  [988, 989],
  [990, 991],
  [992, 993],
  [994, 995],
  [996, 997],
  [998, 999],
  [1e3, 1001],
  [1002, 1003],
  [1004, 1005],
  [1006, 1007],
  [1012, 952],
  [1024, 1104],
  [1025, 1105],
  [1026, 1106],
  [1027, 1107],
  [1028, 1108],
  [1029, 1109],
  [1030, 1110],
  [1031, 1111],
  [1032, 1112],
  [1033, 1113],
  [1034, 1114],
  [1035, 1115],
  [1036, 1116],
  [1037, 1117],
  [1038, 1118],
  [1039, 1119],
  [1040, 1072],
  [1041, 1073],
  [1042, 1074],
  [1043, 1075],
  [1044, 1076],
  [1045, 1077],
  [1046, 1078],
  [1047, 1079],
  [1048, 1080],
  [1049, 1081],
  [1050, 1082],
  [1051, 1083],
  [1052, 1084],
  [1053, 1085],
  [1054, 1086],
  [1055, 1087],
  [1056, 1088],
  [1057, 1089],
  [1058, 1090],
  [1059, 1091],
  [1060, 1092],
  [1061, 1093],
  [1062, 1094],
  [1063, 1095],
  [1064, 1096],
  [1065, 1097],
  [1066, 1098],
  [1067, 1099],
  [1068, 1100],
  [1069, 1101],
  [1070, 1102],
  [1071, 1103],
  [1120, 1121],
  [1122, 1123],
  [1124, 1125],
  [1126, 1127],
  [1128, 1129],
  [1130, 1131],
  [1132, 1133],
  [1134, 1135],
  [1136, 1137],
  [1138, 1139],
  [1140, 1141],
  [1142, 1143],
  [1144, 1145],
  [1146, 1147],
  [1148, 1149],
  [1150, 1151],
  [1152, 1153],
  [1162, 1163],
  [1164, 1165],
  [1166, 1167],
  [1168, 1169],
  [1170, 1171],
  [1172, 1173],
  [1174, 1175],
  [1176, 1177],
  [1178, 1179],
  [1180, 1181],
  [1182, 1183],
  [1184, 1185],
  [1186, 1187],
  [1188, 1189],
  [1190, 1191],
  [1192, 1193],
  [1194, 1195],
  [1196, 1197],
  [1198, 1199],
  [1200, 1201],
  [1202, 1203],
  [1204, 1205],
  [1206, 1207],
  [1208, 1209],
  [1210, 1211],
  [1212, 1213],
  [1214, 1215],
  [1217, 1218],
  [1219, 1220],
  [1223, 1224],
  [1227, 1228],
  [1232, 1233],
  [1234, 1235],
  [1236, 1237],
  [1238, 1239],
  [1240, 1241],
  [1242, 1243],
  [1244, 1245],
  [1246, 1247],
  [1248, 1249],
  [1250, 1251],
  [1252, 1253],
  [1254, 1255],
  [1256, 1257],
  [1258, 1259],
  [1260, 1261],
  [1262, 1263],
  [1264, 1265],
  [1266, 1267],
  [1268, 1269],
  [1270, 1271],
  [1272, 1273],
  [1329, 1377],
  [1330, 1378],
  [1331, 1379],
  [1332, 1380],
  [1333, 1381],
  [1334, 1382],
  [1335, 1383],
  [1336, 1384],
  [1337, 1385],
  [1338, 1386],
  [1339, 1387],
  [1340, 1388],
  [1341, 1389],
  [1342, 1390],
  [1343, 1391],
  [1344, 1392],
  [1345, 1393],
  [1346, 1394],
  [1347, 1395],
  [1348, 1396],
  [1349, 1397],
  [1350, 1398],
  [1351, 1399],
  [1352, 1400],
  [1353, 1401],
  [1354, 1402],
  [1355, 1403],
  [1356, 1404],
  [1357, 1405],
  [1358, 1406],
  [1359, 1407],
  [1360, 1408],
  [1361, 1409],
  [1362, 1410],
  [1363, 1411],
  [1364, 1412],
  [1365, 1413],
  [1366, 1414],
  [4256, 4304],
  [4257, 4305],
  [4258, 4306],
  [4259, 4307],
  [4260, 4308],
  [4261, 4309],
  [4262, 4310],
  [4263, 4311],
  [4264, 4312],
  [4265, 4313],
  [4266, 4314],
  [4267, 4315],
  [4268, 4316],
  [4269, 4317],
  [4270, 4318],
  [4271, 4319],
  [4272, 4320],
  [4273, 4321],
  [4274, 4322],
  [4275, 4323],
  [4276, 4324],
  [4277, 4325],
  [4278, 4326],
  [4279, 4327],
  [4280, 4328],
  [4281, 4329],
  [4282, 4330],
  [4283, 4331],
  [4284, 4332],
  [4285, 4333],
  [4286, 4334],
  [4287, 4335],
  [4288, 4336],
  [4289, 4337],
  [4290, 4338],
  [4291, 4339],
  [4292, 4340],
  [4293, 4341],
  [7680, 7681],
  [7682, 7683],
  [7684, 7685],
  [7686, 7687],
  [7688, 7689],
  [7690, 7691],
  [7692, 7693],
  [7694, 7695],
  [7696, 7697],
  [7698, 7699],
  [7700, 7701],
  [7702, 7703],
  [7704, 7705],
  [7706, 7707],
  [7708, 7709],
  [7710, 7711],
  [7712, 7713],
  [7714, 7715],
  [7716, 7717],
  [7718, 7719],
  [7720, 7721],
  [7722, 7723],
  [7724, 7725],
  [7726, 7727],
  [7728, 7729],
  [7730, 7731],
  [7732, 7733],
  [7734, 7735],
  [7736, 7737],
  [7738, 7739],
  [7740, 7741],
  [7742, 7743],
  [7744, 7745],
  [7746, 7747],
  [7748, 7749],
  [7750, 7751],
  [7752, 7753],
  [7754, 7755],
  [7756, 7757],
  [7758, 7759],
  [7760, 7761],
  [7762, 7763],
  [7764, 7765],
  [7766, 7767],
  [7768, 7769],
  [7770, 7771],
  [7772, 7773],
  [7774, 7775],
  [7776, 7777],
  [7778, 7779],
  [7780, 7781],
  [7782, 7783],
  [7784, 7785],
  [7786, 7787],
  [7788, 7789],
  [7790, 7791],
  [7792, 7793],
  [7794, 7795],
  [7796, 7797],
  [7798, 7799],
  [7800, 7801],
  [7802, 7803],
  [7804, 7805],
  [7806, 7807],
  [7808, 7809],
  [7810, 7811],
  [7812, 7813],
  [7814, 7815],
  [7816, 7817],
  [7818, 7819],
  [7820, 7821],
  [7822, 7823],
  [7824, 7825],
  [7826, 7827],
  [7828, 7829],
  [7840, 7841],
  [7842, 7843],
  [7844, 7845],
  [7846, 7847],
  [7848, 7849],
  [7850, 7851],
  [7852, 7853],
  [7854, 7855],
  [7856, 7857],
  [7858, 7859],
  [7860, 7861],
  [7862, 7863],
  [7864, 7865],
  [7866, 7867],
  [7868, 7869],
  [7870, 7871],
  [7872, 7873],
  [7874, 7875],
  [7876, 7877],
  [7878, 7879],
  [7880, 7881],
  [7882, 7883],
  [7884, 7885],
  [7886, 7887],
  [7888, 7889],
  [7890, 7891],
  [7892, 7893],
  [7894, 7895],
  [7896, 7897],
  [7898, 7899],
  [7900, 7901],
  [7902, 7903],
  [7904, 7905],
  [7906, 7907],
  [7908, 7909],
  [7910, 7911],
  [7912, 7913],
  [7914, 7915],
  [7916, 7917],
  [7918, 7919],
  [7920, 7921],
  [7922, 7923],
  [7924, 7925],
  [7926, 7927],
  [7928, 7929],
  [7944, 7936],
  [7945, 7937],
  [7946, 7938],
  [7947, 7939],
  [7948, 7940],
  [7949, 7941],
  [7950, 7942],
  [7951, 7943],
  [7960, 7952],
  [7961, 7953],
  [7962, 7954],
  [7963, 7955],
  [7964, 7956],
  [7965, 7957],
  [7976, 7968],
  [7977, 7969],
  [7978, 7970],
  [7979, 7971],
  [7980, 7972],
  [7981, 7973],
  [7982, 7974],
  [7983, 7975],
  [7992, 7984],
  [7993, 7985],
  [7994, 7986],
  [7995, 7987],
  [7996, 7988],
  [7997, 7989],
  [7998, 7990],
  [7999, 7991],
  [8008, 8e3],
  [8009, 8001],
  [8010, 8002],
  [8011, 8003],
  [8012, 8004],
  [8013, 8005],
  [8025, 8017],
  [8027, 8019],
  [8029, 8021],
  [8031, 8023],
  [8040, 8032],
  [8041, 8033],
  [8042, 8034],
  [8043, 8035],
  [8044, 8036],
  [8045, 8037],
  [8046, 8038],
  [8047, 8039],
  [8072, 8064],
  [8073, 8065],
  [8074, 8066],
  [8075, 8067],
  [8076, 8068],
  [8077, 8069],
  [8078, 8070],
  [8079, 8071],
  [8088, 8080],
  [8089, 8081],
  [8090, 8082],
  [8091, 8083],
  [8092, 8084],
  [8093, 8085],
  [8094, 8086],
  [8095, 8087],
  [8104, 8096],
  [8105, 8097],
  [8106, 8098],
  [8107, 8099],
  [8108, 8100],
  [8109, 8101],
  [8110, 8102],
  [8111, 8103],
  [8120, 8112],
  [8121, 8113],
  [8122, 8048],
  [8123, 8049],
  [8124, 8115],
  [8136, 8050],
  [8137, 8051],
  [8138, 8052],
  [8139, 8053],
  [8140, 8131],
  [8152, 8144],
  [8153, 8145],
  [8154, 8054],
  [8155, 8055],
  [8168, 8160],
  [8169, 8161],
  [8170, 8058],
  [8171, 8059],
  [8172, 8165],
  [8184, 8056],
  [8185, 8057],
  [8186, 8060],
  [8187, 8061],
  [8188, 8179],
  [8486, 969],
  [8490, 107],
  [8491, 229],
  [8544, 8560],
  [8545, 8561],
  [8546, 8562],
  [8547, 8563],
  [8548, 8564],
  [8549, 8565],
  [8550, 8566],
  [8551, 8567],
  [8552, 8568],
  [8553, 8569],
  [8554, 8570],
  [8555, 8571],
  [8556, 8572],
  [8557, 8573],
  [8558, 8574],
  [8559, 8575],
  [9398, 9424],
  [9399, 9425],
  [9400, 9426],
  [9401, 9427],
  [9402, 9428],
  [9403, 9429],
  [9404, 9430],
  [9405, 9431],
  [9406, 9432],
  [9407, 9433],
  [9408, 9434],
  [9409, 9435],
  [9410, 9436],
  [9411, 9437],
  [9412, 9438],
  [9413, 9439],
  [9414, 9440],
  [9415, 9441],
  [9416, 9442],
  [9417, 9443],
  [9418, 9444],
  [9419, 9445],
  [9420, 9446],
  [9421, 9447],
  [9422, 9448],
  [9423, 9449],
  [65313, 65345],
  [65314, 65346],
  [65315, 65347],
  [65316, 65348],
  [65317, 65349],
  [65318, 65350],
  [65319, 65351],
  [65320, 65352],
  [65321, 65353],
  [65322, 65354],
  [65323, 65355],
  [65324, 65356],
  [65325, 65357],
  [65326, 65358],
  [65327, 65359],
  [65328, 65360],
  [65329, 65361],
  [65330, 65362],
  [65331, 65363],
  [65332, 65364],
  [65333, 65365],
  [65334, 65366],
  [65335, 65367],
  [65336, 65368],
  [65337, 65369],
  [65338, 65370]
]);

// ../engine/src/layaAir/flash/utils/AS3StringMethods.ts
function sourceStringSlice(value2, ...args) {
  if (typeof value2 !== "string") throw new TypeError("Primitive String receiver required");
  as3CheckArgumentCount(args.length, 0, 2);
  const start = args.length ? as3CoerceNumber(args[0]) : 0;
  const end = args.length > 1 ? as3CoerceNumber(args[1]) : 2147483647;
  return value2.slice(start, end);
}
function sourceStringToLowerCase(value2, ...args) {
  if (typeof value2 !== "string") throw new TypeError("Primitive String receiver required");
  as3CheckArgumentCount(args.length, 0, 0);
  let result = "";
  for (let i = 0; i < value2.length; i++) {
    const code = value2.charCodeAt(i);
    result += String.fromCharCode(sourceLowercaseMapping.get(code) ?? code);
  }
  return result;
}
function sourceStringToString(value2, ...args) {
  if (typeof value2 !== "string") throw createAS3StringMethodReceiverError();
  as3CheckArgumentCount(args.length, 0, 0);
  return value2;
}
var WeakReference2 = globalThis.WeakRef;
var methods4 = /* @__PURE__ */ new Map();
var Finalizer2 = globalThis.FinalizationRegistry;
var cleanup2 = WeakReference2 && Finalizer2 ? new Finalizer2((entry) => {
  const cache = methods4.get(entry.value);
  if (cache?.get(entry.name) !== entry.reference) return;
  cache.delete(entry.name);
  if (!cache.size) methods4.delete(entry.value);
}) : null;
function getAS3StringMethod(value2, name2) {
  if (name2 !== "slice" && name2 !== "toLowerCase" && name2 !== "toString") return void 0;
  let cache = methods4.get(value2);
  if (!cache) methods4.set(value2, cache = /* @__PURE__ */ new Map());
  let fn = cache.get(name2)?.deref();
  if (!fn) {
    fn = name2 === "slice" ? (...args) => sourceStringSlice(value2, ...args) : name2 === "toLowerCase" ? (...args) => sourceStringToLowerCase(value2, ...args) : (...args) => sourceStringToString(value2, ...args);
    Object.defineProperty(fn, "length", { value: name2 === "slice" ? 2 : 0 });
    registerAS3BoundMethodClosure(fn, name2 === "slice" ? 2 : 0);
    const reference = WeakReference2 ? new WeakReference2(fn) : { deref: () => fn };
    cache.set(name2, reference);
    cleanup2?.register(fn, { value: value2, name: name2, reference });
  }
  return fn;
}

// ../engine/src/layaAir/flash/utils/AS3AuthoredDynamicSlots.ts
var as3DynamicSlots = /* @__PURE__ */ new WeakMap();

// ../engine/src/layaAir/flash/utils/AS3Property.ts
var instances2 = /* @__PURE__ */ new WeakMap();
var constructors5 = /* @__PURE__ */ new WeakMap();
var generatedVariables = /* @__PURE__ */ new WeakMap();
var classOnlyConstructors = /* @__PURE__ */ new WeakSet();
var functionRecord = { constructor: Function, dynamic: true, static: false, function: true, traits: /* @__PURE__ */ new Map() };
var methodClosureRecord = { ...functionRecord, dynamic: false };
var builtinClassRecords = new Map([Object, Function, AS3ClassType].map((constructor) => [constructor, { constructor, dynamic: true, static: true, traits: /* @__PURE__ */ new Map() }]));
var nonEnumerableSlots = /* @__PURE__ */ new WeakMap();
var functionPrototypeInitialized = false;
function initializeFunctionPrototype() {
  if (functionPrototypeInitialized) return;
  as3DynamicSlots.set(Function.prototype, /* @__PURE__ */ new Map([
    ["constructor", Function],
    ["call", getAS3FunctionPrototypeIntrinsic("call")],
    ["apply", getAS3FunctionPrototypeIntrinsic("apply")]
  ]));
  nonEnumerableSlots.set(Function.prototype, /* @__PURE__ */ new Set(["constructor", "call", "apply"]));
  functionPrototypeInitialized = true;
}
var as3Methods = /* @__PURE__ */ new Set(["hasOwnProperty", "propertyIsEnumerable", "isPrototypeOf"]);
function dictionaryAS3Method(key3) {
  return key3.uri === "http://adobe.com/AS3/2006/builtin" && as3Methods.has(key3.localName);
}
var intrinsicNames = /* @__PURE__ */ new Set(["constructor", ...as3Methods, "toString", "toLocaleString", "valueOf", "setPropertyIsEnumerable"]);
function failure2(name2, errorID) {
  throw createAS3PropertyError(name2, errorID);
}
function unsupported11(reason) {
  throw new TypeError("Unsupported source property representation: " + reason);
}
function receiver2(value2) {
  if (value2 === null) return failure2("TypeError", 1009);
  if (value2 === void 0) return failure2("TypeError", 1010);
  if (typeof value2 !== "object" && typeof value2 !== "function") return unsupported11("primitive receiver");
  return value2;
}
function propertyName(value2) {
  if (value2 instanceof QName) unsupported11("namespaced property keys are unsupported");
  return as3String(value2);
}
function namespace2(value2) {
  if (value2 !== "public" && value2 !== "public-and-AS3") unsupported11("namespace set");
}
function validateAS3PropertyType(type) {
  if (type && typeof type === "object" && type.vector !== void 0)
    return type.reference === void 0 && type.name === as3VectorTypeName(type.vector) ? type.name : unsupported11("vector type name differs from specialization");
  if (typeof type === "string" && ["*", "int", "uint", "Number", "Boolean", "String", "Object", "Function", "Class"].includes(type)) return type;
  if (type && typeof type === "object" && typeof type.name === "string" && type.name.length && (isAS3DeclarationType(type.reference) && type.reference.name === type.name || isAS3Interface(type.reference) || typeof type.reference === "function" && typeof Object.getOwnPropertyDescriptor(type.reference, "prototype")?.value === "object"))
    return type.name;
  return unsupported11("missing or invalid declared type");
}
function coerceAS3PropertyValue(value2, type) {
  switch (type) {
    case "*":
      return value2;
    case "int":
      return as3CoerceInt(value2);
    case "uint":
      return as3CoerceUint(value2);
    case "Number":
      return as3CoerceNumber(value2);
    case "Boolean":
      return Boolean(value2);
    case "String":
      return as3CoerceString(value2);
    case "Object":
      return as3CoerceObject(value2);
    case "Function":
      return as3CoerceReference(value2, Function);
    case "Class":
      return as3CoerceClass(value2);
    default:
      return type.vector !== void 0 ? as3CoerceVector(value2, type.vector) : as3CoerceReference(value2, type.reference);
  }
}
function descriptor(prototype, key3) {
  for (let current = prototype; current && current !== Object.prototype; current = Object.getPrototypeOf(current)) {
    const found = Object.getOwnPropertyDescriptor(current, key3);
    if (found) return found;
  }
  return void 0;
}
function registerAS3PropertyTraits(constructor, input, statics = []) {
  const reflection2 = describeRegisteredFlashType(constructor);
  if (!reflection2?.isStatic || !reflection2.factory) unsupported11("class needs exact reflection metadata");
  if (constructors5.has(constructor) && !classOnlyConstructors.has(constructor)) unsupported11("dispatch metadata already registered");
  const prototype = Object.getOwnPropertyDescriptor(constructor, "prototype")?.value;
  const instance = describeRegisteredFlashInstanceType(constructor);
  if (!instance) unsupported11("instance metadata");
  if ([...input, ...statics].some((item) => item?.nativeStorage !== void 0) && !isCanonicalAS3DeclarationConstructor(constructor)) {
    const type = getAS3DeclarationType(constructor), parent = instances2.get(Object.getPrototypeOf(prototype));
    const parentType = parent && typeof parent.constructor === "function" && getAS3DeclarationType(parent.constructor);
    if (!type || !parentType || !getAS3DeclarationTypeChain(type).includes(parentType) || statics.some((t) => t.nativeStorage !== void 0))
      unsupported11("native variable projection requires canonical declaration proof");
    for (const item of input.filter((t) => t.nativeStorage !== void 0)) {
      const inherited = parent.traits.get(traitIdentity(item.name, item.uri));
      const actual = descriptor(prototype, item.key ?? item.name);
      if (!inherited || inherited.nativeStorage !== "accessor" || item.nativeStorage !== inherited.nativeStorage || item.kind !== inherited.kind || item.type !== inherited.type || (item.key ?? item.name) !== inherited.key || actual?.get !== inherited.descriptor?.get || actual?.set !== inherited.descriptor?.set)
        unsupported11("native variable projection requires unchanged inherited storage");
    }
  }
  const traits2 = buildTraits(input, instance, prototype, false);
  const staticTraits = buildTraits(statics, reflection2, constructor, true);
  const existingClass = constructors5.get(constructor);
  if (existingClass && !sameTraits(existingClass.traits, staticTraits)) unsupported11("conflicting Class dispatch metadata");
  registerAS3ClassValueParent(constructor);
  sourceClassPrototype(constructor, false);
  registerAS3FunctionParameterCounts([...traits2.values(), ...staticTraits.values()].filter((trait) => trait.kind === "method").map((trait) => [trait.descriptor.value, trait.parameterCount]));
  instances2.set(prototype, Object.freeze({ constructor, dynamic: instance.isDynamic, static: false, traits: traits2 }));
  constructors5.set(constructor, Object.freeze({ constructor, dynamic: true, static: true, traits: staticTraits }));
  classOnlyConstructors.delete(constructor);
}
function registerAS3ClassProperties(constructor, statics = []) {
  const exact = getAS3ExactSourceClass(constructor);
  if (!exact || exact.constructor !== constructor) unsupported11("Class dispatch requires exact source generation");
  const reflection2 = describeRegisteredFlashType(constructor);
  if (!reflection2?.isStatic || !reflection2.factory) unsupported11("class needs exact reflection metadata");
  if (constructors5.has(constructor)) unsupported11("dispatch metadata already registered");
  const traits2 = buildTraits(statics, reflection2, constructor, true);
  const parameterCounts2 = /* @__PURE__ */ new Map();
  for (const trait of traits2.values()) if (trait.kind === "method") {
    const fn = trait.descriptor.value, previous = parameterCounts2.get(fn) ?? getAS3FunctionParameterCount(fn);
    if (previous !== void 0 && previous !== trait.parameterCount) unsupported11("conflicting source function parameter count");
    parameterCounts2.set(fn, trait.parameterCount);
  }
  sourceClassPrototype(constructor);
  registerAS3ClassValueParent(constructor);
  registerAS3FunctionParameterCounts([...parameterCounts2]);
  constructors5.set(constructor, Object.freeze({ constructor, dynamic: true, static: true, traits: traits2 }));
  classOnlyConstructors.add(constructor);
}
function traitIdentity(name2, uri = "") {
  return JSON.stringify([uri, name2]);
}
function proxyHook(target, record5, name2, args) {
  if (!isCanonicalFlashProxy(target) || !record5 || record5.static)
    return unsupported11("Proxy hook requires genuine registered instance");
  const trait = record5.traits.get(traitIdentity(name2, flash_proxy));
  if (!trait || trait.kind !== "method") return unsupported11("Proxy hook requires namespace method authority");
  return as3CallValue(getBoundAS3Method(target, trait.key, trait.descriptor.value), () => args);
}
function proxyMissing(target, record5, key3, namespaces) {
  if (!isCanonicalFlashProxy(target) || !record5 || record5.static) return false;
  if (key3 instanceof QName && key3.uri)
    return !record5.traits.has(traitIdentity(key3.localName, key3.uri));
  const name2 = key3 instanceof QName ? key3.localName : propertyName(key3);
  return !record5.traits.has(traitIdentity(name2)) && name2 !== "constructor" && !(namespaces === "public-and-AS3" && as3Methods.has(name2)) && !delegateValue(target, name2);
}
function proxyName(key3, numericString = true) {
  if (key3 instanceof QName) return key3;
  const name2 = propertyName(key3);
  return numericString && typeof key3 === "number" ? name2 : new QName("", name2);
}
function sameTraits(left, right) {
  if (left.size !== right.size) return false;
  for (const [name2, a] of left) {
    const b = right.get(name2);
    if (!b || a.kind !== b.kind || a.key !== b.key || a.nativeStorage !== b.nativeStorage || a.parameterCount !== b.parameterCount || (typeof a.type === "object" && typeof b.type === "object" ? a.type.name !== b.type.name || a.type.reference !== b.type.reference || a.type.vector !== b.type.vector : a.type !== b.type) || (typeof a.setterType === "object" && typeof b.setterType === "object" ? a.setterType.name !== b.setterType.name || a.setterType.reference !== b.setterType.reference || a.setterType.vector !== b.setterType.vector : a.setterType !== b.setterType) || a.descriptor?.value !== b.descriptor?.value || a.descriptor?.get !== b.descriptor?.get || a.descriptor?.set !== b.descriptor?.set) return false;
  }
  return true;
}
function buildTraits(input, surface, prototype, statics) {
  if (!Array.isArray(input)) unsupported11("dense trait list required");
  const projectedNamespaces = /* @__PURE__ */ new Set();
  for (const item of input) {
    if (!item || item.uri !== void 0 && typeof item.uri !== "string") unsupported11("invalid trait namespace");
    if (item.uri) {
      projectedNamespaces.add(item.uri);
    }
  }
  const expected = /* @__PURE__ */ new Map();
  for (const [kind, list] of [
    ["variable", surface.variables],
    ["accessor", surface.accessors],
    ["method", surface.methods],
    ["constant", surface.constants ?? []]
  ])
    for (const item of list) if ((!item.uri || projectedNamespaces.has(item.uri)) && (!statics || item.declaredBy === surface.name || (kind === "variable" || kind === "constant") && item.declaredBy === void 0)) expected.set(traitIdentity(item.name, item.uri), { kind, ...item });
  const traits2 = /* @__PURE__ */ new Map();
  const storage3 = /* @__PURE__ */ new Set();
  for (const item of input) {
    if (!item || typeof item.name !== "string" || !item.name || traits2.has(traitIdentity(item.name, item.uri))) unsupported11("duplicate/invalid trait");
    const match = expected.get(traitIdentity(item.name, item.uri));
    if (match ? match.kind !== item.kind : item.kind !== "constant" || surface.constants !== void 0)
      unsupported11("trait does not match reflected public authority");
    if (item.access !== void 0 && (item.kind !== "accessor" || !["readonly", "writeonly", "readwrite"].includes(item.access) || item.access !== match?.access))
      unsupported11("accessor projection differs from reflection");
    if (item.nativeStorage !== void 0 && (item.nativeStorage !== "accessor" || item.kind !== "variable" || statics))
      unsupported11("native accessor storage requires an instance variable");
    const key3 = item.key ?? item.name;
    if (typeof key3 !== "string" && typeof key3 !== "symbol") unsupported11("native storage key");
    if (storage3.has(key3)) unsupported11("distinct source traits share native storage");
    storage3.add(key3);
    let captured;
    let type = item.type;
    let setterType = item.setterType;
    if (setterType !== void 0) {
      if (item.kind !== "accessor" || match?.access !== "readwrite") unsupported11("separate setter type requires paired accessor");
      validateAS3PropertyType(setterType);
      if (type !== "*" && setterType !== "*") unsupported11("distinct accessor types require a wildcard half");
      if (setterType && typeof setterType === "object") setterType = setterType.vector !== void 0 ? Object.freeze({ name: setterType.name, vector: setterType.vector }) : Object.freeze({ name: setterType.name, reference: setterType.reference });
    }
    if (item.kind !== "method") {
      const name2 = validateAS3PropertyType(type);
      if (match?.type && name2 !== match.type) unsupported11("variable type differs from reflection");
      if (type && typeof type === "object") type = type.vector !== void 0 ? Object.freeze({ name: type.name, vector: type.vector }) : Object.freeze({ name: type.name, reference: type.reference });
    }
    if (item.kind === "accessor" || item.kind === "method" || item.nativeStorage === "accessor") {
      captured = statics ? Object.getOwnPropertyDescriptor(prototype, key3) : descriptor(prototype, key3);
      if (!captured) unsupported11("declared prototype trait missing");
      if (item.nativeStorage === "accessor" && (typeof captured.get !== "function" || typeof captured.set !== "function"))
        unsupported11("native variable requires getter and setter storage");
      if (item.kind === "method" && typeof captured.value !== "function") unsupported11("method descriptor");
      if (item.kind === "accessor" && item.access !== void 0) {
        captured = {
          ...captured,
          get: item.access === "writeonly" ? void 0 : captured.get,
          set: item.access === "readonly" ? void 0 : captured.set
        };
      }
      if (item.kind === "accessor" && (Boolean(captured.get) !== (match.access !== "writeonly") || Boolean(captured.set) !== (match.access !== "readonly"))) unsupported11("accessor descriptor differs from reflection");
      if (item.kind === "method" && statics) captured = { ...captured, value: getAS3MethodSource(prototype, key3, captured.value) };
      captured = Object.freeze({ ...captured });
    }
    traits2.set(traitIdentity(item.name, item.uri), Object.freeze({ name: item.name, ...item.uri ? { uri: item.uri } : {}, kind: item.kind, key: key3, type, setterType, nativeStorage: item.nativeStorage, descriptor: captured, parameterCount: match?.parameterCount, diagnosticName: item.kind === "method" && !item.uri && match?.declaredBy ? match.declaredBy + (statics ? "$" : "") + "/" + item.name : void 0 }));
    expected.delete(traitIdentity(item.name, item.uri));
  }
  if (expected.size) unsupported11("incomplete public trait surface");
  return traits2;
}
function namespaceTrait(record5, key3, missingError = 1069) {
  const trait = record5?.traits.get(traitIdentity(key3.localName, key3.uri));
  if (trait) return trait;
  if (!record5 || typeof record5.constructor !== "function" || record5.function || record5.conversionOnly || record5.dynamic && !record5.static)
    return unsupported11("namespaced property requires exact source metadata");
  const surface = record5.static ? describeRegisteredFlashType(record5.constructor) : describeRegisteredFlashInstanceType(record5.constructor);
  if (!surface) return unsupported11("namespaced property requires reflected source authority");
  for (const list of [surface.variables, surface.constants, surface.methods, surface.accessors])
    if (list?.some((item) => item.uri === key3.uri && item.name === key3.localName && (!record5.static || item.declaredBy === surface.name || item.declaredBy === void 0)))
      return unsupported11("namespaced property is absent from its trait projection");
  return failure2("ReferenceError", missingError);
}
function readTrait(target, trait) {
  if (trait.kind === "method") return getBoundAS3Method(target, trait.key, trait.descriptor.value, trait.diagnosticName);
  if (trait.kind === "accessor") {
    if (!trait.descriptor.get) return failure2("ReferenceError", 1077);
    return trait.descriptor.get.call(target);
  }
  if (trait.nativeStorage === "accessor") return trait.descriptor.get.call(target);
  const generated = generatedVariables.get(target)?.get(trait.key);
  if (generated) return generated.read();
  const stored = ownData(target, trait.key);
  if (!stored) unsupported11("declared slot has not been initialized");
  return stored.value;
}
function writeTrait(object2, trait, value2) {
  if (trait.kind === "method") return failure2("ReferenceError", 1037);
  if (trait.kind === "constant" || trait.kind === "accessor" && !trait.descriptor.set) return failure2("ReferenceError", 1074);
  const generated = generatedVariables.get(object2)?.get(trait.key);
  if (generated) {
    generated.write(value2);
    return value2;
  }
  const converted = coerceAS3PropertyValue(value2, trait.setterType ?? trait.type);
  if (trait.kind === "accessor" || trait.nativeStorage === "accessor") trait.descriptor.set.call(object2, converted);
  else {
    const stored = ownData(object2, trait.key);
    if (!stored || !stored.writable) unsupported11("declared writable native slot");
    Object.defineProperty(object2, trait.key, { ...stored, value: converted });
  }
  return value2;
}
function context(target) {
  initializeObjectPrototype();
  if (target === Dictionary) getDictionarySourcePrototype();
  if (target === Boolean || target === getRegisteredAS3ClassPrototype(Boolean)) initializeBooleanPrototype();
  if (target === String || target === getRegisteredAS3ClassPrototype(String)) initializeStringPrototype();
  if (target === Number || target === getRegisteredAS3ClassPrototype(Number)) initializeNumberPrototype();
  if (isAS3ScriptGlobal(target)) return null;
  if (Array.isArray(target)) {
    initializeArrayPrototype(target);
    return null;
  }
  const builtin = sourceBuiltinClassFor(target);
  const record5 = typeof target === "function" ? constructors5.get(target) : instances2.get(builtin ? builtin.prototype : Object.getPrototypeOf(target));
  if (record5) {
    if (!record5.static && typeof record5.constructor === "function" && isCanonicalAS3DeclarationConstructor(record5.constructor) && getAS3ExactSourceClass(target)?.constructor !== record5.constructor)
      return unsupported11("canonical property dispatch requires genuine exact instance identity");
    if (!record5.static && record5.constructor === Dictionary)
      return unsupported11("Dictionary instances require private storage identity");
    sourceClassPrototype(record5.constructor, false);
    return record5;
  }
  if (builtinClassRecords.has(target)) return builtinClassRecords.get(target);
  if (getAS3BuiltinClassName(target) !== void 0) {
    registerAS3ClassValueParent(target);
    const builtin2 = {
      constructor: target,
      dynamic: true,
      static: true,
      conversionOnly: true,
      traits: /* @__PURE__ */ new Map()
    };
    builtinClassRecords.set(target, builtin2);
    return builtin2;
  }
  if (typeof target === "function" && as3Is(target, Function)) {
    initializeFunctionPrototype();
    return isAS3MethodClosure(target) ? methodClosureRecord : functionRecord;
  }
  if (typeof target === "function") return unsupported11("Class property dispatch requires registered source properties");
  if (Object.getPrototypeOf(target) === Object.prototype || isAS3Prototype(Object.getPrototypeOf(target))) return null;
  return unsupported11("unregistered class, Class, Array, Dictionary, Proxy, or custom prototype");
}
var arrayClosures = /* @__PURE__ */ new WeakMap();
var arraySortClosures = /* @__PURE__ */ new WeakMap();
function arraySortMethod(target, name2) {
  let methods5 = arraySortClosures.get(target);
  if (!methods5) arraySortClosures.set(target, methods5 = /* @__PURE__ */ new Map());
  let closure = methods5.get(name2);
  if (!closure) {
    closure = (...args) => name2 === "sort" ? as3ArraySort(target, ...args) : as3ArraySortOn(target, ...args);
    registerAS3BoundMethodClosure(closure, name2 === "sort" ? 0 : 2);
    methods5.set(name2, closure);
  }
  return closure;
}
var remainingArrayMethods = /* @__PURE__ */ new Set(["concat", "every", "filter", "forEach", "indexOf", "lastIndexOf", "join", "map", "pop", "reverse", "shift", "slice", "some", "sort", "sortOn", "splice", "unshift", "toLocaleString"]);
var arrayPrototypeInitialized = false;
function initializeArrayPrototype(target) {
  if (Object.getPrototypeOf(target) !== Array.prototype) unsupported11("Array subclass or host prototype mutation");
  const length = Object.getOwnPropertyDescriptor(target, "length");
  if (!length || !("value" in length) || !length.writable || length.configurable || length.enumerable)
    unsupported11("host Array length descriptor");
  if (arrayPrototypeInitialized) return;
  const prototype = registerAS3BuiltinObjectDelegate(Array);
  const push = function(...values5) {
    return pushArrayValues(receiver2(this), values5);
  };
  registerAS3Function(push, getAS3BuiltinScriptGlobal(), 0);
  Object.defineProperty(prototype, "push", { value: push, writable: true, configurable: true, enumerable: false });
  const toString = function() {
    if (!Array.isArray(this)) throw createAS3ArrayCoercionError();
    initializeArrayPrototype(this);
    return as3ArrayToString(this);
  };
  registerAS3Function(toString, getAS3BuiltinScriptGlobal(), 0);
  registerAS3ArrayReceiverFunction(toString);
  Object.defineProperty(prototype, "toString", { value: toString, writable: true, configurable: true, enumerable: false });
  arrayPrototypeInitialized = true;
}
function arrayIndex(name2) {
  const value2 = Number(name2);
  return Number.isInteger(value2) && value2 >= 0 && value2 < 4294967295 && String(value2) === name2;
}
function pushArrayValues(target, values5) {
  if (Array.isArray(target)) {
    initializeArrayPrototype(target);
    for (const value2 of values5) as3DefineDynamicProperty(target, String(target.length), value2);
    return target.length;
  }
  let length = as3CoerceUint(as3GetProperty(target, "length"));
  for (const value2 of values5) {
    as3SetProperty(target, String(length), value2);
    length = length + 1 >>> 0;
  }
  as3SetProperty(target, "length", length);
  return length;
}
function arrayPush(target) {
  let closure = arrayClosures.get(target);
  if (!closure) {
    closure = (...values5) => pushArrayValues(target, values5);
    registerAS3BoundMethodClosure(closure, 0);
    arrayClosures.set(target, closure);
  }
  return closure;
}
function setArrayLength(target, value2) {
  const length = as3CoerceUint(value2);
  if (length < target.length) for (const key3 of Object.getOwnPropertyNames(target)) {
    if (arrayIndex(key3) && Number(key3) >= length && !Object.getOwnPropertyDescriptor(target, key3).configurable)
      unsupported11("host restricted Array element");
  }
  Object.defineProperty(target, "length", { value: length });
}
function arrayPublicName(key3) {
  if (key3.uri !== "") return unsupported11("non-public Array key namespace");
  return key3.localName;
}
function ownData(target, key3) {
  const found = Object.getOwnPropertyDescriptor(target, key3);
  if (found && !("value" in found)) unsupported11("dynamic/native slot is an accessor");
  return found;
}
function defineAS3GeneratedVariable(target, key3, initial) {
  const record5 = context(target), exact = getAS3ExactSourceClass(target);
  if (!record5 || !exact || exact.constructor !== record5.constructor) unsupported11("generated storage requires exact source generation");
  const trait = [...record5.traits.values()].find((value3) => value3.key === key3);
  if (!trait || trait.kind !== "variable") unsupported11("generated storage requires a declared variable");
  const prior = Object.getOwnPropertyDescriptor(target, key3);
  if (generatedVariables.get(target)?.has(key3) || prior && (!("value" in prior) || !prior.configurable))
    unsupported11("fresh generated variable storage required");
  let value2 = coerceAS3PropertyValue(initial, trait.type);
  const slot = Object.freeze({ read: () => value2, write: (incoming) => {
    value2 = coerceAS3PropertyValue(incoming, trait.type);
  } });
  Object.defineProperty(target, key3, { get: slot.read, set: slot.write, enumerable: false, configurable: false });
  let slots = generatedVariables.get(target);
  if (!slots) generatedVariables.set(target, slots = /* @__PURE__ */ new Map());
  slots.set(key3, slot);
  if (!record5.static && !trait.uri && typeof key3 === "string" && key3 === trait.name)
    registerAS3AuthoredVariable(target, key3, slot.read, slot.write);
}
var classConversionProperties = /* @__PURE__ */ new Set([
  "toString",
  "toLocaleString",
  "valueOf",
  "constructor",
  "hasOwnProperty",
  "propertyIsEnumerable",
  "isPrototypeOf",
  "setPropertyIsEnumerable"
]);
function validateClassProperty(record5, name2) {
  if (record5?.conversionOnly && !classConversionProperties.has(name2))
    unsupported11("builtin Class property requires its own source metadata");
}
function own(target, name2, record5) {
  validateClassProperty(record5, name2);
  if (isAS3ScriptGlobal(target) && hasAS3ScriptGlobalDeclaration(target, name2)) return true;
  return record5 ? (record5.static || record5.function) && name2 === "prototype" || record5.function && name2 === "length" || record5.traits.has(traitIdentity(name2)) || !!as3DynamicSlots.get(target)?.has(name2) : !!ownData(target, name2);
}
var intrinsicClosures = /* @__PURE__ */ new WeakMap();
var intrinsicOperations = /* @__PURE__ */ new WeakMap();
var publicWrappers = /* @__PURE__ */ new Map();
function invokeIntrinsic(target, name2, args) {
  const object2 = receiver2(target);
  const ops = intrinsicOperations.get(object2) ?? operations(object2, context(object2));
  if (name2 === "setPropertyIsEnumerable") as3CheckArgumentCount(args.length, 2, 2);
  else if (as3Methods.has(name2)) as3CheckArgumentCount(args.length, 0, 1);
  switch (name2) {
    case "hasOwnProperty":
      return ops.hasOwnProperty(args[0]);
    case "propertyIsEnumerable":
      return ops.propertyIsEnumerable(args[0]);
    case "isPrototypeOf":
      return ops.isPrototypeOf(args[0]);
    case "setPropertyIsEnumerable":
      return ops.setPropertyIsEnumerable(args[0], args[1]);
    case "valueOf":
      return object2;
    case "toString":
      return Object.prototype.hasOwnProperty.call(ops, "toString") ? ops.toString() : as3InvokeToStringMethod(object2, Object.prototype.toString);
    case "toLocaleString":
      return Object.prototype.hasOwnProperty.call(ops, "toString") ? ops.toString() : as3InvokeToStringMethod(object2, Object.prototype.toString);
  }
  return void 0;
}
function getAS3ObjectIntrinsic(target, name2, namespaces, provider) {
  namespace2(namespaces);
  if (!intrinsicNames.has(name2) || name2 === "constructor") return void 0;
  for (const name3 of ["hasOwnProperty", "propertyIsEnumerable", "isPrototypeOf", "setPropertyIsEnumerable"])
    if (typeof provider[name3] !== "function") unsupported11("Object intrinsic provider operations");
  intrinsicOperations.set(target, Object.freeze({
    hasOwnProperty: provider.hasOwnProperty,
    propertyIsEnumerable: provider.propertyIsEnumerable,
    isPrototypeOf: provider.isPrototypeOf,
    setPropertyIsEnumerable: provider.setPropertyIsEnumerable,
    ...Object.prototype.hasOwnProperty.call(provider, "toString") ? { toString: provider.toString } : {}
  }));
  if (namespaces === "public-and-AS3" && as3Methods.has(name2)) {
    let cache = intrinsicClosures.get(target);
    if (!cache) intrinsicClosures.set(target, cache = /* @__PURE__ */ new Map());
    let fn = cache.get(name2);
    if (!fn) {
      fn = (...args) => invokeIntrinsic(target, name2, args);
      registerAS3BoundMethodClosure(fn, 1);
      cache.set(name2, fn);
    }
    return fn;
  }
  return publicWrapper(name2);
}
function publicWrapper(name2) {
  if (name2 === "toLocaleString") name2 = "toString";
  let fn = publicWrappers.get(name2);
  if (!fn) {
    fn = function(...args) {
      return invokeIntrinsic(this, name2, args);
    };
    registerAS3Function(fn, getAS3BuiltinScriptGlobal(), name2 === "setPropertyIsEnumerable" ? 2 : as3Methods.has(name2) ? 1 : 0);
    publicWrappers.set(name2, fn);
  }
  return fn;
}
var objectPrototypeInitialized = false;
function initializeObjectPrototype() {
  if (objectPrototypeInitialized) return;
  for (const name2 of intrinsicNames) if (name2 !== "constructor")
    Object.defineProperty(as3ObjectPrototype, name2, { value: publicWrapper(name2), writable: true, configurable: true, enumerable: false });
  objectPrototypeInitialized = true;
}
function getAS3ObjectDelegateProperty(target, name2, namespaces, provider) {
  namespace2(namespaces);
  initializeObjectPrototype();
  getAS3ObjectIntrinsic(target, "valueOf", "public", provider);
  if (namespaces === "public-and-AS3" && as3Methods.has(name2))
    return { value: getAS3ObjectIntrinsic(target, name2, namespaces, provider) };
  return delegateValue(target, name2);
}
function sourceClassPrototype(constructor, required2 = true) {
  const exact = typeof constructor === "function" ? getAS3ExactSourceClass(constructor) : void 0;
  const known = getRegisteredAS3ClassPrototype(constructor);
  if (known) return known;
  if (typeof constructor !== "function") unsupported11("source Class prototype identity");
  if (exact) {
    if (exact.baseConstructor && !sourceClassPrototype(exact.baseConstructor, required2)) return void 0;
    return registerAS3ClassPrototype(constructor, exact.baseConstructor);
  }
  const native = Object.getOwnPropertyDescriptor(constructor, "prototype")?.value;
  const parent = Object.getPrototypeOf(native);
  let base = null;
  if (parent !== Object.prototype) {
    const record5 = instances2.get(parent);
    const authority = getAS3RegisteredPrototypeConstructor(parent) ?? record5?.constructor;
    if (typeof authority !== "function") {
      if (required2) unsupported11("source base delegate requires its own registered class or builtin delegate authority");
      return void 0;
    }
    base = authority;
    if (!sourceClassPrototype(base, required2)) return void 0;
  }
  return registerAS3ClassPrototype(constructor, base);
}
function delegateValue(target, name2) {
  for (let parent = as3PrototypeOf(target); parent; parent = as3PrototypeOf(parent)) {
    if (isAS3SourceError(parent)) {
      const dynamic = sourceErrorDynamic(parent, name2);
      if (dynamic) return dynamic;
      if (name2 === "toString") return { value: getSourceErrorToString() };
      continue;
    }
    const record5 = typeof parent === "function" ? context(parent) : null;
    if (record5) {
      if (as3DynamicSlots.get(parent)?.has(name2)) return { value: as3DynamicSlots.get(parent).get(name2) };
    } else {
      const data4 = ownData(parent, name2);
      if (data4) return { value: data4.value };
    }
  }
  return void 0;
}
function operations(target, record5) {
  return {
    hasOwnProperty: (key3) => own(target, as3String(as3CoerceString(key3)), record5),
    propertyIsEnumerable: (key3) => {
      const name2 = as3String(as3CoerceString(key3));
      return record5 ? !!as3DynamicSlots.get(target)?.has(name2) && !nonEnumerableSlots.get(target)?.has(name2) : !!ownData(target, name2)?.enumerable;
    },
    isPrototypeOf: (value2) => {
      if (record5?.static) sourceClassPrototype(record5.constructor);
      return as3PrototypeContains(target, value2);
    },
    ...!record5 && isAS3Prototype(Object.getPrototypeOf(target)) ? { toString: () => "[object Object]" } : {},
    ...record5?.static || record5?.function ? { toString: () => as3InvokeToStringMethod(target, Function.prototype.toString) } : {},
    setPropertyIsEnumerable: (key3, flag) => {
      const name2 = as3String(as3CoerceString(key3));
      if (record5?.static && !record5.conversionOnly) {
        if (!as3DynamicSlots.get(target)?.has(name2)) return;
        let hidden = nonEnumerableSlots.get(target);
        if (!hidden) nonEnumerableSlots.set(target, hidden = /* @__PURE__ */ new Set());
        if (Boolean(flag)) hidden.delete(name2);
        else hidden.add(name2);
        return;
      }
      if (record5) unsupported11("dynamic class enumerable flags");
      if (Array.isArray(target) && (name2 === "length" || arrayIndex(name2))) return;
      const found = ownData(target, name2);
      if (found) Object.defineProperty(target, name2, { ...found, enumerable: Boolean(flag) });
    }
  };
}
function read3(target, name2, record5, namespaces, scope2) {
  validateClassProperty(record5, name2);
  if (namespaces === "public-and-AS3" && isFlashRegExp(target)) {
    const method2 = getFlashRegExpMethod(target, name2);
    if (method2) return method2;
  }
  if (isAS3ScriptGlobal(target)) {
    const binding = readAS3ScriptGlobalDeclaration(target, name2, "", scope2);
    if (binding) return binding.value;
  }
  if (Array.isArray(target)) {
    if (namespaces === "public-and-AS3" && name2 === "push") return arrayPush(target);
    if (namespaces === "public-and-AS3" && (name2 === "sort" || name2 === "sortOn")) return arraySortMethod(target, name2);
    if (remainingArrayMethods.has(name2) && (namespaces === "public-and-AS3" || !ownData(target, name2))) unsupported11("Array method " + name2);
  }
  if (record5?.function) {
    if (name2 === "prototype") return getAS3FunctionPrototype(target);
    if (name2 === "length") return getAS3FunctionLength(target);
    const method2 = namespaces === "public-and-AS3" ? getAS3FunctionIntrinsic(target, name2) : void 0;
    if (method2) return method2;
  }
  const trait = record5?.traits.get(traitIdentity(name2));
  if (trait) return readTrait(target, trait);
  if (namespaces === "public-and-AS3" && as3Methods.has(name2))
    return getAS3ObjectIntrinsic(target, name2, namespaces, operations(target, record5));
  if (record5 ? as3DynamicSlots.get(target)?.has(name2) : ownData(target, name2))
    return record5 ? as3DynamicSlots.get(target).get(name2) : ownData(target, name2).value;
  if (record5?.static && name2 === "prototype") return sourceClassPrototype(record5.constructor);
  const delegated = delegateValue(target, name2);
  if (delegated) return delegated.value;
  if (name2 === "constructor" && record5 && !record5.static && !record5.function && !getRegisteredAS3ClassPrototype(record5.constructor)) return record5.constructor;
  if (record5 && !record5.dynamic) return failure2("ReferenceError", 1069);
  return void 0;
}
function as3GetClassNamespaceProperty(target, uri, name2) {
  if (typeof uri !== "string" || !uri || typeof name2 !== "string" || !name2)
    return unsupported11("Class namespace read requires a literal namespace and member");
  if (target !== null && target !== void 0 && !as3AsClass(target))
    return unsupported11("namespace receiver is not a source Class value");
  return as3GetProperty(target, new QName(uri, name2));
}
function as3GetNamespaceProperty(target, uri, name2) {
  if (typeof uri !== "string" || !uri || typeof name2 !== "string" || !name2)
    return unsupported11("namespace read requires a literal namespace and member");
  return as3GetProperty(target, new QName(uri, name2));
}
function as3CallNamespaceProperty(target, uri, name2, arguments_) {
  if (typeof uri !== "string" || !uri || typeof name2 !== "string" || !name2)
    return unsupported11("namespace call requires a literal namespace and member");
  return as3CallNamedProperty(target, new QName(uri, name2), arguments_);
}
function as3GetProperty(target, key3, namespaces = "public-and-AS3", scope2) {
  if (typeof target === "string" || typeof target === "number" || typeof target === "boolean") {
    namespace2(namespaces);
    validateAS3ScriptPrivateScope(scope2);
    if (key3 instanceof QName) {
      if (key3.uri !== "") return unsupported11("Primitive property requires a public QName");
      key3 = key3.localName;
      namespaces = "public";
    }
    const name3 = propertyName(key3);
    return readPrimitiveProperty(target, name3, namespaces);
  }
  const object2 = receiver2(target);
  namespace2(namespaces);
  validateAS3ScriptPrivateScope(scope2);
  if (isSourceStageView(object2)) {
    if (key3 instanceof QName) {
      if (key3.uri !== "") return unsupported11("Stage event methods require a public name");
      key3 = key3.localName;
    }
    const method2 = sourceStageEventMethod(object2, propertyName(key3));
    if (method2) return method2;
    return unsupported11("Stage property requires a qualified source operation");
  }
  if (object2 instanceof QName) {
    if (key3 instanceof QName) {
      if (key3.uri !== "") return unsupported11("QName field requires a public name");
      key3 = key3.localName;
    }
    const name3 = propertyName(key3);
    if (name3 === "uri" || name3 === "localName") return object2[name3];
    return unsupported11("QName property requires a qualified source operation");
  }
  if (isAS3SourceError(object2)) return readSourceError(object2, propertyName(key3), namespaces);
  if (isFlashDictionary(object2)) {
    if (key3 instanceof QName) {
      if (key3.uri !== "" && !dictionaryAS3Method(key3)) return failure2("ReferenceError", 1069);
      namespaces = dictionaryAS3Method(key3) ? "public-and-AS3" : "public";
      key3 = key3.localName;
    }
    return object2.get(key3, namespaces);
  }
  if (Array.isArray(object2) && key3 instanceof QName) {
    key3 = arrayPublicName(key3);
    namespaces = "public";
  }
  if (isAS3ScriptGlobal(object2) && key3 instanceof QName) {
    if (key3.uri === null) return unsupported11("wildcard global namespace");
    if (key3.uri) return readAS3ScriptGlobalDeclaration(object2, key3.localName, key3.uri)?.value;
    key3 = key3.localName;
    namespaces = "public";
    scope2 = void 0;
  }
  const record5 = context(object2);
  if (isCanonicalFlashProxy(object2)) {
    const hookName = proxyName(key3);
    if (proxyMissing(object2, record5, hookName, namespaces)) return proxyHook(object2, record5, "getProperty", [hookName]);
    key3 = key3 instanceof QName || typeof hookName === "string" ? hookName : hookName.localName;
  }
  if (key3 instanceof QName) {
    if (key3.uri) return readTrait(object2, namespaceTrait(record5, key3));
    if (key3.uri === null) return unsupported11("wildcard property namespace");
    key3 = key3.localName;
    namespaces = "public";
    scope2 = void 0;
  }
  const name2 = propertyName(key3);
  return read3(object2, name2, record5, namespaces, scope2);
}
var primitiveStringMethods = /* @__PURE__ */ new Set([
  "charAt",
  "charCodeAt",
  "concat",
  "indexOf",
  "lastIndexOf",
  "localeCompare",
  "match",
  "replace",
  "search",
  "slice",
  "split",
  "substr",
  "substring",
  "toLowerCase",
  "toLocaleLowerCase",
  "toUpperCase",
  "toLocaleUpperCase"
]);
var booleanPrototypeInitialized = false;
function initializeBooleanPrototype() {
  const prototype = registerAS3BuiltinObjectDelegate(Boolean);
  if (!booleanPrototypeInitialized) {
    const toString = function() {
      "use strict";
      return sourceBooleanToString(this === prototype ? false : this, ...Array.from(arguments));
    };
    registerAS3Function(toString, getAS3BuiltinScriptGlobal(), 0, "String");
    registerAS3BooleanReceiverFunction(toString);
    Object.defineProperty(prototype, "toString", { value: toString, writable: true, configurable: true, enumerable: false });
    booleanPrototypeInitialized = true;
  }
  return prototype;
}
var stringPrototypeInitialized = false;
function initializeStringPrototype() {
  const prototype = registerAS3BuiltinObjectDelegate(String);
  if (!stringPrototypeInitialized) {
    const toString = function() {
      "use strict";
      return sourceStringToString(this === prototype ? "" : this, ...Array.from(arguments));
    };
    registerAS3Function(toString, getAS3BuiltinScriptGlobal(), 0, "String");
    registerAS3StringReceiverFunction(toString);
    Object.defineProperty(prototype, "toString", { value: toString, writable: true, configurable: true, enumerable: false });
    stringPrototypeInitialized = true;
  }
  return prototype;
}
var numberPrototypeInitialized = false;
function initializeNumberPrototype() {
  const prototype = registerAS3BuiltinObjectDelegate(Number);
  if (!numberPrototypeInitialized) {
    const toString = function(radix) {
      "use strict";
      return sourceNumberToString(this === prototype ? 0 : this, ...Array.from(arguments));
    };
    Object.defineProperty(toString, "length", { value: 1 });
    registerAS3Function(toString, getAS3BuiltinScriptGlobal(), 1, "String");
    registerAS3NumberReceiverFunction(toString);
    Object.defineProperty(prototype, "toString", { value: toString, writable: true, configurable: true, enumerable: false });
    numberPrototypeInitialized = true;
  }
  return prototype;
}
var primitiveNumberMethods = /* @__PURE__ */ new Set(["toFixed", "toPrecision", "toExponential"]);
function readPrimitiveProperty(target, name2, namespaces) {
  const type = typeof target === "string" ? "String" : typeof target === "number" ? "Number" : "Boolean";
  if (type === "Number" && name2 === "toString") {
    const prototype2 = initializeNumberPrototype();
    return namespaces === "public-and-AS3" ? getAS3NumberToString(target) : as3GetProperty(prototype2, name2, "public");
  }
  if (type === "String" && name2 === "toString") {
    const prototype2 = initializeStringPrototype();
    return namespaces === "public-and-AS3" ? getAS3StringMethod(target, name2) : as3GetProperty(prototype2, name2, "public");
  }
  if (type === "Boolean" && name2 === "toString") {
    const prototype2 = initializeBooleanPrototype();
    return namespaces === "public-and-AS3" ? getAS3BooleanToString(target) : as3GetProperty(prototype2, name2, "public");
  }
  if (type === "String" && name2 === "length") return target.length;
  if (type === "String" && namespaces === "public-and-AS3") {
    const method2 = getAS3StringMethod(target, name2);
    if (method2) return method2;
  }
  if (intrinsicNames.has(name2) && name2 !== "constructor" || type === "String" && primitiveStringMethods.has(name2) || type === "Number" && primitiveNumberMethods.has(name2))
    return unsupported11(type + " property requires qualified intrinsic/delegate: " + name2);
  initializeObjectPrototype();
  const prototype = registerAS3BuiltinObjectDelegate(type === "String" ? String : type === "Number" ? Number : Boolean);
  if (as3HasProperty(name2, prototype)) return as3GetProperty(prototype, name2, namespaces);
  throw createAS3PrimitivePropertyError(name2, type);
}
function* as3EnumerableKeys(target) {
  if (typeof target === "object" && target !== null && isCanonicalFlashProxy(target)) {
    const record5 = context(target);
    let index = 0;
    while ((index = as3CoerceInt(proxyHook(target, record5, "nextNameIndex", [index]))) !== 0)
      yield proxyHook(target, record5, "nextName", [index]);
    return;
  }
  if (target == null || typeof target === "string" || typeof target === "number" || typeof target === "boolean") return;
  let current = receiver2(target);
  const visited = /* @__PURE__ */ new Set();
  while (current) {
    if (visited.has(current)) unsupported11("cyclic source enumeration delegate");
    visited.add(current);
    if (isFlashDictionary(current)) {
      yield* current.keys();
      current = getDictionarySourcePrototype();
      continue;
    }
    if (isAS3SourceError(current)) {
      for (const key3 of as3SourceErrorEnumerableKeys(current))
        if (sourceErrorEnumerable(current, key3)) yield enumerationKey(key3, false);
      current = sourceErrorParent(current) ?? as3ObjectPrototype;
      continue;
    }
    if (isAS3ScriptGlobal(current)) unsupported11("script-global enumeration requires declaration visibility");
    const record5 = context(current);
    if (record5?.conversionOnly) unsupported11("builtin Class enumeration requires its source metadata");
    const keys = record5 ? [...as3DynamicSlots.get(current)?.keys() ?? []] : Object.getOwnPropertyNames(current);
    for (const key3 of keys) {
      const enumerable = record5 ? as3DynamicSlots.get(current)?.has(key3) && !nonEnumerableSlots.get(current)?.has(key3) : ownData(current, key3)?.enumerable;
      if (enumerable) yield enumerationKey(key3, Array.isArray(current));
    }
    current = as3PrototypeOf(current);
  }
}
function* as3EnumerableValues(target) {
  if (typeof target === "object" && target !== null && isCanonicalFlashProxy(target)) {
    const record5 = context(target);
    let index = 0;
    while ((index = as3CoerceInt(proxyHook(target, record5, "nextNameIndex", [index]))) !== 0)
      yield proxyHook(target, record5, "nextValue", [index]);
    return;
  }
  if (getAS3VectorInstanceTypeName(target) !== null) {
    const vector = target;
    for (let index = 0; index < vector.length; index++) yield vector[index];
    return;
  }
  for (const key3 of as3EnumerableKeys(target)) yield as3GetProperty(target, key3);
}
function enumerationKey(name2, array) {
  if (array && arrayIndex(name2)) return Number(name2);
  if (/^(0|[1-9][0-9]{0,8})$/.test(name2) && Number(name2) <= 268435455) return Number(name2);
  return name2;
}
function as3AddAssignProperty(readTarget, key3, rhs, writeTarget) {
  const value2 = as3Add(as3GetProperty(readTarget, key3), rhs());
  return as3SetProperty(writeTarget(), key3, value2);
}
function as3SetProperty(target, key3, value2, namespaces = "public-and-AS3", scope2) {
  if (typeof target === "string" || typeof target === "number" || typeof target === "boolean") {
    namespace2(namespaces);
    validateAS3ScriptPrivateScope(scope2);
    if (namespaces !== "public-and-AS3") return unsupported11("primitive public-only writes require namespace evidence");
    const name3 = propertyName(key3), type = typeof target === "string" ? "String" : typeof target === "number" ? "Number" : "Boolean";
    const code = type === "String" && name3 === "length" ? 1074 : as3Methods.has(name3) || name3 === "toString" || name3 === "valueOf" || type === "String" && primitiveStringMethods.has(name3) || type === "Number" && primitiveNumberMethods.has(name3) ? 1037 : 1056;
    throw createAS3PrimitiveWriteError(name3, type, code);
  }
  const object2 = receiver2(target);
  namespace2(namespaces);
  validateAS3ScriptPrivateScope(scope2);
  if (isAS3SourceError(object2)) {
    const name3 = propertyName(key3);
    if (setSourceErrorField(object2, name3, value2)) return value2;
    if (name3 === "getStackTrace" || name3 === "constructor") return unsupported11("Error method/Class field");
    if (namespaces === "public-and-AS3" && as3Methods.has(name3)) return failure2("ReferenceError", 1037);
    setSourceErrorDynamic(object2, name3, value2);
    return value2;
  }
  if (isFlashDictionary(object2)) {
    if (key3 instanceof QName) {
      if (key3.uri !== "" && !dictionaryAS3Method(key3)) return failure2("ReferenceError", 1056);
      namespaces = dictionaryAS3Method(key3) ? "public-and-AS3" : "public";
      key3 = key3.localName;
    }
    object2.set(key3, value2, namespaces);
    return value2;
  }
  if (Array.isArray(object2) && key3 instanceof QName) {
    key3 = arrayPublicName(key3);
    namespaces = "public";
  }
  if (isAS3ScriptGlobal(object2) && key3 instanceof QName) {
    if (key3.uri === null) return unsupported11("wildcard global namespace");
    setAS3ScriptGlobalProperty(object2, key3.localName, value2, key3.uri);
    return value2;
  }
  const record5 = context(object2);
  if (isCanonicalFlashProxy(object2)) {
    const hookName = proxyName(key3);
    if (proxyMissing(object2, record5, hookName, namespaces)) {
      proxyHook(object2, record5, "setProperty", [hookName, value2]);
      return value2;
    }
    key3 = key3 instanceof QName || typeof hookName === "string" ? hookName : hookName.localName;
  }
  if (key3 instanceof QName) {
    if (key3.uri) return writeTrait(object2, namespaceTrait(record5, key3, 1056), value2);
    if (key3.uri === null) return unsupported11("wildcard property namespace");
    key3 = key3.localName;
    namespaces = "public";
    scope2 = void 0;
  }
  const name2 = propertyName(key3), trait = record5?.traits.get(traitIdentity(name2));
  validateClassProperty(record5, name2);
  if (Array.isArray(object2)) {
    if (name2 === "length") {
      setArrayLength(object2, value2);
      return value2;
    }
    if (namespaces === "public-and-AS3" && (name2 === "push" || name2 === "join")) return failure2("ReferenceError", 1037);
    if (namespaces === "public-and-AS3" && remainingArrayMethods.has(name2)) unsupported11("Array method " + name2);
  }
  if (record5?.function) {
    if (name2 === "prototype") {
      setAS3FunctionPrototype(object2, value2);
      return value2;
    }
    if (name2 === "length") return failure2("ReferenceError", 1074);
    if (namespaces === "public-and-AS3" && (name2 === "call" || name2 === "apply")) return failure2("ReferenceError", 1037);
  }
  if (trait) return writeTrait(object2, trait, value2);
  if (isAS3ScriptGlobal(object2) && hasAS3ScriptGlobalDeclaration(object2, name2, scope2)) {
    setAS3ScriptGlobalProperty(object2, name2, value2, "", scope2);
    return value2;
  }
  if (namespaces === "public-and-AS3" && as3Methods.has(name2)) return failure2("ReferenceError", 1037);
  if (isAS3ScriptGlobal(object2)) {
    setAS3ScriptGlobalProperty(object2, name2, value2, "", scope2);
    return value2;
  }
  if (record5) {
    if (record5.static && name2 === "prototype") return failure2("ReferenceError", 1074);
    if (!record5.dynamic) return failure2("ReferenceError", 1056);
    let slots = as3DynamicSlots.get(object2);
    if (!slots) as3DynamicSlots.set(object2, slots = /* @__PURE__ */ new Map());
    slots.set(name2, value2);
    return value2;
  }
  if (Array.isArray(object2) || isAS3Prototype(Object.getPrototypeOf(object2))) return as3DefineDynamicProperty(object2, name2, value2, namespaces);
  return as3SetDynamicProperty(object2, name2, value2, namespaces);
}
function hasAS3PublicPropertyTrait(target, name2) {
  return !!context(receiver2(target))?.traits.has(traitIdentity(name2));
}
function as3HasProperty(key3, target) {
  const object2 = receiver2(target);
  if (isAS3SourceError(object2)) {
    const name3 = propertyName(key3);
    if (name3 === "constructor" || name3 === "getStackTrace") return unsupported11("Error method/Class identity");
    if (sourceErrorOwn(object2, name3) || ["toString", "toLocaleString"].includes(name3)) return true;
    for (let parent = sourceErrorParent(object2); parent; parent = sourceErrorParent(parent))
      if (sourceErrorDynamic(parent, name3)) return true;
    return as3HasProperty(name3, as3ObjectPrototype);
  }
  if (isFlashDictionary(object2)) return key3 instanceof QName ? key3.uri === "" && object2.hasPrototypeProperty(key3.localName) : object2.has(key3);
  const record5 = context(object2);
  if (key3 instanceof QName && record5 && !record5.dynamic && !record5.function && !record5.conversionOnly && !isCanonicalFlashProxy(object2) && !isAS3ScriptGlobal(object2)) key3 = as3String(key3);
  const name2 = Array.isArray(object2) && key3 instanceof QName ? arrayPublicName(key3) : (isAS3ScriptGlobal(object2) || isCanonicalFlashProxy(object2)) && key3 instanceof QName ? as3String(key3) : propertyName(key3);
  if (proxyMissing(object2, record5, name2, "public")) return Boolean(proxyHook(object2, record5, "hasProperty", [name2]));
  if (Array.isArray(object2) && typeof key3 === "number" && Number.isInteger(key3) && key3 >= 0 && key3 <= 2147483647)
    return own(object2, name2, record5);
  if (Array.isArray(object2) && remainingArrayMethods.has(name2) && !ownData(object2, name2)) unsupported11("Array method " + name2);
  return own(object2, name2, record5) || !!delegateValue(object2, name2) || !!record5 && !record5.static && !record5.function && name2 === "constructor" && !getRegisteredAS3ClassPrototype(record5.constructor) || !!record5?.function && name2 === "length";
}
function as3HasOwnProperty(target, key3) {
  if (isFlashDictionary(target)) return as3CallProperty(target, "hasOwnProperty", () => [key3]);
  if (isAS3SourceError(target)) return sourceErrorOwn(target, as3String(as3CoerceString(key3)));
  const object2 = receiver2(target), record5 = context(object2);
  return own(object2, as3String(as3CoerceString(key3)), record5);
}
function as3CallProperty(target, key3, arguments_, namespaces = "public-and-AS3", scope2) {
  const method2 = as3GetProperty(target, key3, namespaces, scope2);
  return as3CallValue(method2, arguments_, target);
}
function as3CallNamedProperty(target, name2, arguments_, namespaces = "public-and-AS3", scope2) {
  if (typeof name2 !== "string" && !(name2 instanceof QName)) return unsupported11("named call requires a source property name");
  const args = arguments_();
  if (typeof target === "object" && target !== null && isCanonicalFlashProxy(target)) {
    namespace2(namespaces);
    validateAS3ScriptPrivateScope(scope2);
    const record5 = context(target);
    if (proxyMissing(target, record5, name2, namespaces)) return proxyHook(target, record5, "callProperty", [proxyName(name2), ...args]);
  }
  const method2 = as3GetProperty(target, name2, namespaces, scope2);
  if (as3AsClass(method2) === null && !as3Is(method2, Function)) throw createAS3NamedCallError(name2 instanceof QName ? name2.localName : name2);
  return as3CallValue(method2, () => args, target);
}
function as3CallRegExpStringProperty(target, name2, arguments_) {
  if (name2 !== "replace" && name2 !== "match" && name2 !== "split") return unsupported11("RegExp String method");
  if (typeof target !== "string") {
    const args2 = arguments_();
    if (typeof target === "number" || typeof target === "boolean") {
      initializeObjectPrototype();
      const prototype = registerAS3BuiltinObjectDelegate(typeof target === "number" ? Number : Boolean);
      if (!as3HasProperty(name2, prototype)) throw createAS3NamedCallError(name2);
    }
    return as3CallNamedProperty(target, name2, () => args2);
  }
  const args = arguments_();
  if (args.length !== (name2 === "replace" ? 2 : 1)) return unsupported11("RegExp String argument count");
  if (!isFlashRegExp(args[0])) return unsupported11("RegExp String call requires a genuine source RegExp");
  return name2 === "replace" ? sourceRegExpStringReplace(target, args[0], args[1]) : name2 === "match" ? sourceRegExpStringMatch(target, args[0]) : sourceRegExpStringSplit(target, args[0]);
}
function as3DeleteProperty(target, key3, namespaces = "public-and-AS3", scope2) {
  const object2 = receiver2(target);
  namespace2(namespaces);
  validateAS3ScriptPrivateScope(scope2);
  if (isAS3SourceError(object2)) {
    const name3 = propertyName(key3);
    if (name3 === "constructor" || name3 === "getStackTrace") return unsupported11("Error method/Class identity");
    if (namespaces === "public-and-AS3" && as3Methods.has(name3)) return false;
    return deleteSourceErrorDynamic(object2, name3);
  }
  if (isFlashDictionary(object2)) {
    if (key3 instanceof QName) {
      if (key3.uri !== "") return false;
      key3 = key3.localName;
      namespaces = "public";
    }
    return object2.delete(key3, namespaces);
  }
  if (Array.isArray(object2) && key3 instanceof QName) {
    key3 = arrayPublicName(key3);
    namespaces = "public";
  }
  if (isAS3ScriptGlobal(object2) && key3 instanceof QName) {
    if (key3.uri !== "") return unsupported11("non-public global delete namespace");
    key3 = key3.localName;
    scope2 = void 0;
    namespaces = "public";
  }
  const record5 = context(object2);
  if (isCanonicalFlashProxy(object2)) {
    const hookName = proxyName(key3, false);
    if (proxyMissing(object2, record5, hookName, namespaces)) return Boolean(proxyHook(object2, record5, "deleteProperty", [hookName]));
    key3 = key3 instanceof QName || typeof hookName === "string" ? hookName : hookName.localName;
  }
  if (key3 instanceof QName) {
    if (key3.uri) {
      if (record5?.traits.has(traitIdentity(key3.localName, key3.uri))) return false;
      if (!record5 || record5.dynamic || record5.function || record5.conversionOnly)
        return unsupported11("namespaced delete requires a sealed source Class");
      return false;
    }
    if (key3.uri === null) return unsupported11("wildcard property namespace");
    key3 = key3.localName;
    namespaces = "public";
    scope2 = void 0;
  }
  const name2 = propertyName(key3);
  validateClassProperty(record5, name2);
  if (Array.isArray(object2) && namespaces === "public-and-AS3") {
    if (name2 === "push") return false;
    if (remainingArrayMethods.has(name2)) unsupported11("Array method " + name2);
  }
  if (record5 && !record5.dynamic) return false;
  if (record5?.traits.has(traitIdentity(name2)) || (record5?.static || record5?.function) && name2 === "prototype" || record5?.function && (name2 === "length" || namespaces === "public-and-AS3" && (name2 === "call" || name2 === "apply")) || namespaces === "public-and-AS3" && as3Methods.has(name2)) return false;
  if (isAS3ScriptGlobal(object2)) return deleteAS3ScriptGlobalProperty(object2, name2, scope2);
  if (record5) {
    as3DynamicSlots.get(object2)?.delete(name2);
    nonEnumerableSlots.get(object2)?.delete(name2);
    return true;
  }
  return Reflect.deleteProperty(object2, name2);
}
function resolveAS3SourcePublicConversionMethod2(value2, name2) {
  if (value2 === null || typeof value2 !== "object" && typeof value2 !== "function") return void 0;
  if (name2 !== "toString" && name2 !== "valueOf") unsupported11("conversion property name");
  if (isAS3SourceError(value2)) return { method: as3GetProperty(value2, name2, "public") };
  if (getAS3BuiltinClassName(value2) !== void 0) return { method: as3GetProperty(value2, name2, "public") };
  if (isFlashDictionary(value2)) return { method: as3GetProperty(value2, name2, "public") };
  const prototype = Object.getPrototypeOf(value2);
  const record5 = typeof value2 === "function" ? constructors5.get(value2) : instances2.get(prototype);
  const sourceOwn = record5?.traits.has(traitIdentity(name2)) || as3DynamicSlots.get(value2)?.has(name2);
  if (!sourceOwn && Object.getOwnPropertyDescriptor(value2, name2)) return void 0;
  if (!record5) {
    if (typeof value2 === "function") {
      if (!as3Is(value2, Function)) return void 0;
    } else if (prototype !== Object.prototype && !isAS3Prototype(prototype) && !isAS3ScriptGlobal(value2)) return void 0;
  }
  return { method: as3GetProperty(value2, name2, "public") };
}
installAS3SourcePublicConversionResolver(resolveAS3SourcePublicConversionMethod2);
initializeArrayPrototype([]);
function sourceErrorOwn(target, name2) {
  if (name2 === "constructor" || name2 === "getStackTrace") return unsupported11("Error method/Class identity");
  return !!sourceErrorField(target, name2) || !!sourceErrorDynamic(target, name2);
}
function sourceErrorOperations(target) {
  const key3 = (value2) => as3String(as3CoerceString(value2));
  return {
    hasOwnProperty: (value2) => sourceErrorOwn(target, key3(value2)),
    propertyIsEnumerable: (value2) => sourceErrorEnumerable(target, key3(value2)),
    setPropertyIsEnumerable: (value2, flag) => setSourceErrorEnumerable(target, key3(value2), Boolean(flag)),
    isPrototypeOf: (value2) => {
      if (!isAS3SourceError(value2)) return false;
      for (let parent = sourceErrorParent(value2); parent; parent = sourceErrorParent(parent)) if (parent === target) return true;
      return false;
    },
    toString: () => sourceErrorObjectTag(target)
  };
}
function readSourceError(target, name2, namespaces) {
  const field = sourceErrorField(target, name2);
  if (field) return field.value;
  if (name2 === "constructor" || name2 === "getStackTrace") return unsupported11("Error method/Class field");
  const ops = sourceErrorOperations(target);
  getAS3ObjectIntrinsic(target, "valueOf", "public", ops);
  if (namespaces === "public-and-AS3" && as3Methods.has(name2)) return getAS3ObjectIntrinsic(target, name2, namespaces, ops);
  for (let current = target; current; current = sourceErrorParent(current)) {
    const dynamic = sourceErrorDynamic(current, name2);
    if (dynamic) return dynamic.value;
  }
  if (name2 === "toString") return getSourceErrorToString();
  if (name2 === "toLocaleString") return getAS3ObjectIntrinsic(target, name2, "public", ops);
  return as3GetProperty(as3ObjectPrototype, name2, "public");
}
var sourceErrorToString;
function getSourceErrorToString() {
  if (!sourceErrorToString) {
    sourceErrorToString = function() {
      if (as3GetProperty(this, "message") === "")
        return as3CoerceString(as3GetProperty(this, "name"));
      const prefix = as3Add(as3GetProperty(this, "name"), ": ");
      return as3CoerceString(as3Add(prefix, as3GetProperty(this, "message")));
    };
    registerAS3Function(sourceErrorToString, getAS3BuiltinScriptGlobal(), 0, "String");
  }
  return sourceErrorToString;
}
function getAS3SerializableProperties(target) {
  const exact = getAS3ExactSourceClass(target);
  if (!exact) return void 0;
  const record5 = instances2.get(Object.getPrototypeOf(target));
  if (!record5 || record5.constructor !== exact.constructor) return unsupported11("serialization requires exact source property registration");
  const names = [...record5.traits.values()].filter((trait) => !trait.uri && (trait.kind === "variable" || trait.kind === "accessor" && trait.descriptor?.get && trait.descriptor?.set)).map((trait) => trait.name);
  const dynamic = record5.dynamic ? [...as3DynamicSlots.get(target)?.keys() ?? []].filter((name2) => !nonEnumerableSlots.get(target)?.has(name2)) : [];
  return (function* () {
    for (const name2 of names) yield [name2, read3(target, name2, record5, "public")];
    for (const name2 of dynamic) yield [name2, as3DynamicSlots.get(target)?.get(name2)];
  })();
}

// ../engine/src/layaAir/flash/events/UnsupportedFlashFeatureError.ts
var UnsupportedFlashFeatureError = class extends Error {
  constructor(feature, detail) {
    super(detail ? `${feature}: ${detail}` : feature);
    this.name = "UnsupportedFlashFeatureError";
    this.feature = feature;
  }
};

// ../engine/src/layaAir/flash/utils/AS3Date.ts
var HostDate = Date;
var values4 = /* @__PURE__ */ new WeakMap();
var identities = /* @__PURE__ */ new WeakSet();
function unsupported12(detail) {
  throw new UnsupportedFlashFeatureError("Date", detail);
}
function value(receiver3) {
  const date = values4.get(receiver3);
  if (!date) return unsupported12("unqualified receiver or prototype time read");
  return date;
}
function setMilliseconds(receiver3, milliseconds) {
  if (typeof milliseconds !== "number") unsupported12("time mutation requires a source-coerced Number");
  return value(receiver3).setTime(milliseconds);
}
var AS3Date = class _AS3Date {
  constructor(...components) {
    if (new.target !== _AS3Date) unsupported12("subclass construction requires source Class authority");
    const count = components.length;
    if (![0, 1, 6, 7].includes(count) || components.some((part) => typeof part !== "number"))
      unsupported12("requires zero, one, six or seven numeric constructor arguments");
    const date = count === 0 ? new HostDate() : count === 1 ? new HostDate(components[0]) : new HostDate(
      components[0],
      components[1],
      components[2],
      components[3],
      components[4],
      components[5],
      count === 7 ? components[6] : 0
    );
    values4.set(this, date);
    identities.add(this);
  }
  get time() {
    return value(this).getTime();
  }
  set time(milliseconds) {
    setMilliseconds(this, milliseconds);
  }
  setTime(milliseconds) {
    return setMilliseconds(this, milliseconds);
  }
  valueOf() {
    return value(this).valueOf();
  }
  getTime() {
    return this === _AS3Date.prototype ? NaN : value(this).getTime();
  }
  getFullYear() {
    return value(this).getFullYear();
  }
  getMonth() {
    return value(this).getMonth();
  }
  getDate() {
    return value(this).getDate();
  }
  getDay() {
    return value(this).getDay();
  }
  getHours() {
    return value(this).getHours();
  }
  getMinutes() {
    return value(this).getMinutes();
  }
  getSeconds() {
    return value(this).getSeconds();
  }
  getMilliseconds() {
    return value(this).getMilliseconds();
  }
  get fullYearUTC() {
    return value(this).getUTCFullYear();
  }
  get monthUTC() {
    return value(this).getUTCMonth();
  }
  get dateUTC() {
    return value(this).getUTCDate();
  }
  get dayUTC() {
    return value(this).getUTCDay();
  }
  get hoursUTC() {
    return value(this).getUTCHours();
  }
  get minutesUTC() {
    return value(this).getUTCMinutes();
  }
  get secondsUTC() {
    return value(this).getUTCSeconds();
  }
  get millisecondsUTC() {
    return value(this).getUTCMilliseconds();
  }
  getUTCFullYear() {
    return value(this).getUTCFullYear();
  }
  getUTCMonth() {
    return value(this).getUTCMonth();
  }
  getUTCDate() {
    return value(this).getUTCDate();
  }
  getUTCDay() {
    return value(this).getUTCDay();
  }
  getUTCHours() {
    return value(this).getUTCHours();
  }
  getUTCMinutes() {
    return value(this).getUTCMinutes();
  }
  getUTCSeconds() {
    return value(this).getUTCSeconds();
  }
  getUTCMilliseconds() {
    return value(this).getUTCMilliseconds();
  }
  toString() {
    return unsupported12("source date string formatting is not qualified");
  }
  [Symbol.toPrimitive](hint) {
    if (hint !== "number") return unsupported12("source date string/default conversion is not qualified");
    return value(this).valueOf();
  }
};
identities.add(AS3Date.prototype);
function isFlashDate(candidate) {
  return candidate !== null && typeof candidate === "object" && identities.has(candidate);
}
registerCanonicalAS3ReferenceImplementation(AS3Date, isFlashDate);

// ../engine/src/layaAir/flash/utils/AS3GeneratedClass.ts
function applyAS3GeneratedSuperMethod(method2, receiver3, args) {
  return as3CallValue(getAS3FunctionIntrinsic(method2, "apply"), () => [receiver3, args]);
}
var records = /* @__PURE__ */ new WeakMap();
function registerAS3GeneratedAccessibilityBase(base) {
  if (base !== AccessibilityImplementation || !isCanonicalAS3DeclarationConstructor(base))
    return unsupported13("canonical accessibility base required");
  if (records.has(base)) return;
  const metadata = describeRegisteredFlashType(base);
  if (metadata?.reflectionAuthority?.kind !== "source-complete" || !metadata.factory)
    return unsupported13("complete accessibility reflection required");
  const factory = metadata.reflectionAuthority.document.children.find((n) => n.tag === "factory");
  const methods5 = /* @__PURE__ */ new Map();
  const primitives = ["*", "Object", "int", "uint", "Number", "Boolean", "String", "Function", "void"];
  for (const node of factory.children.filter((n) => n.tag === "method")) {
    const parameters = node.children.filter((n) => n.tag === "parameter").map((n) => n.attributes.type);
    if (!parameters.every((t) => primitives.includes(t)) || !primitives.includes(node.attributes.returnType)) continue;
    methods5.set(memberIdentity({ name: node.attributes.name }), Object.freeze({
      name: node.attributes.name,
      parameters: Object.freeze(parameters),
      returns: node.attributes.returnType,
      requiredCount: parameters.length,
      override: false,
      final: false
    }));
  }
  const nativeTraits = [
    { name: "stub", key: "stub", kind: "variable", type: "Boolean", nativeStorage: "accessor" },
    { name: "errno", key: "errno", kind: "variable", type: "uint", nativeStorage: "accessor" },
    ...metadata.factory.methods.map((m) => ({ name: m.name, key: m.name, kind: "method" }))
  ];
  records.set(base, { fields: [], constants: [], traits: Object.freeze(nativeTraits), members: metadata.factory, final: false, methods: methods5, accessors: /* @__PURE__ */ new Map() });
}
var nativePositionBases = /* @__PURE__ */ new WeakMap();
var nativeMouseTargetBases = /* @__PURE__ */ new WeakMap();
function registerAS3GeneratedMouseEventTargetBase(base) {
  if (!isCanonicalAS3DeclarationConstructor(base) || getAS3DeclarationType(base)?.name !== "flash.events::MouseEvent")
    return unsupported13("canonical MouseEvent target base required");
  if (nativeMouseTargetBases.has(base)) return;
  const metadata = describeRegisteredFlashType(base);
  if (metadata?.reflectionAuthority?.kind !== "source-complete")
    return unsupported13("complete MouseEvent reflection required");
  const result = /* @__PURE__ */ new Map();
  for (const name2 of ["target", "currentTarget"]) {
    const member = metadata.factory?.accessors.find((a) => a.name === name2);
    const source = metadata.reflectionAuthority.document.children.find((n) => n.tag === "factory")?.children.find((n) => n.tag === "accessor" && n.attributes.name === name2);
    if (member?.declaredBy !== "flash.events::Event" || member.access !== "readonly" || source?.attributes.type !== "Object")
      return unsupported13("native target metadata mismatch");
    let prototype = base.prototype, descriptor2;
    while (prototype && !descriptor2) {
      descriptor2 = Object.getOwnPropertyDescriptor(prototype, name2);
      prototype = Object.getPrototypeOf(prototype);
    }
    if (!descriptor2?.get || descriptor2.set) return unsupported13("native target getter required");
    result.set(name2, Object.freeze({ get: Object.freeze({ owner: member.declaredBy, override: false, final: false, type: "Object", implementation: descriptor2.get }) }));
  }
  nativeMouseTargetBases.set(base, result);
}
function registerAS3GeneratedSpritePositionBase(base) {
  if (!isCanonicalAS3DeclarationConstructor(base) || getAS3DeclarationType(base)?.name !== "flash.display::Sprite")
    return unsupported13("canonical Sprite position base required");
  if (nativePositionBases.has(base)) return;
  const metadata = describeRegisteredFlashType(base);
  if (!metadata || metadata.reflectionAuthority.kind !== "source-complete")
    return unsupported13("complete Sprite position reflection required");
  const result = /* @__PURE__ */ new Map();
  for (const name2 of ["x", "y"]) {
    const member = metadata.factory?.accessors?.find((a) => a.name === name2);
    const source = metadata.reflectionAuthority.document.children.find((node) => node.tag === "factory")?.children.find((node) => node.tag === "accessor" && node.attributes.name === name2);
    if (!member || member.access !== "readwrite" || source?.attributes.type !== "Number" || member.declaredBy !== "flash.display::DisplayObject")
      return unsupported13("native position metadata mismatch");
    let prototype = base.prototype, descriptor2;
    while (prototype && !descriptor2) {
      descriptor2 = Object.getOwnPropertyDescriptor(prototype, name2);
      prototype = Object.getPrototypeOf(prototype);
    }
    if (!descriptor2?.get || !descriptor2.set) return unsupported13("native position descriptor required");
    result.set(name2, Object.freeze({
      get: Object.freeze({ owner: member.declaredBy, override: false, final: false, type: "Number", implementation: descriptor2.get }),
      set: Object.freeze({ owner: member.declaredBy, override: false, final: false, type: "Number", implementation: descriptor2.set })
    }));
  }
  nativePositionBases.set(base, result);
}
function getAS3GeneratedNativePositionAccessor(base, name2, side) {
  if (side !== "get" && side !== "set") return unsupported13("native position accessor half required");
  const half = nativePositionBases.get(base)?.get(name2)?.[side];
  if (!half) return unsupported13("authenticated native position accessor required");
  return half.implementation;
}
var prototypeRecords = /* @__PURE__ */ new WeakMap();
var entered = /* @__PURE__ */ new WeakSet();
var deferredConstants = /* @__PURE__ */ new WeakMap();
function unsupported13(reason) {
  throw new TypeError("AS3_GENERATED_CLASS_UNSUPPORTED: " + reason);
}
function memberIdentity(member) {
  if (typeof member.name !== "string" || !member.name) return unsupported13("nonempty member name required");
  if (member.uri !== void 0 && typeof member.uri !== "string") return unsupported13("string namespace URI required");
  return JSON.stringify([member.uri || "", member.name]);
}
function namespaceKey(uri, name2) {
  return Symbol.for("as3.namespace.member@1:" + JSON.stringify([uri, name2]));
}
function staticStorageKey(key3) {
  if (typeof key3 === "string") return !!key3 && !["prototype", "name", "length"].includes(key3);
  if (typeof key3 !== "symbol") return false;
  const value2 = Symbol.keyFor(key3), prefix = "as3.namespace.member@1:";
  if (!value2?.startsWith(prefix)) return false;
  try {
    const parts = JSON.parse(value2.slice(prefix.length));
    return Array.isArray(parts) && parts.length === 2 && parts.every((part) => typeof part === "string" && !!part) && key3 === namespaceKey(parts[0], parts[1]);
  } catch {
    return false;
  }
}
function sameStorageType(a, b) {
  return typeof a === "string" || typeof b === "string" ? a === b : a.name === b.name && a.reference === b.reference && a.vector === b.vector;
}
function methodSignatures(definition, instance, prototype, owner) {
  const result = /* @__PURE__ */ new Map();
  const property2 = Object.getOwnPropertyDescriptor(definition, "instanceMethods");
  if (!property2) return result;
  if (!("value" in property2) || !Array.isArray(property2.value)) return unsupported13("data method signature list required");
  const instanceMetadata = Object.getOwnPropertyDescriptor(definition.metadata, "instance");
  const metadata = instanceMetadata && "value" in instanceMetadata && instanceMetadata.value && Object.getOwnPropertyDescriptor(instanceMetadata.value, "methods");
  if (!metadata || !("value" in metadata) || !Array.isArray(metadata.value)) return unsupported13("method metadata required");
  const types = ["*", "Object", "int", "uint", "Number", "Boolean", "String", "Function"];
  const methodType = (value2, returns = false) => {
    if (typeof value2 === "string" && (types.includes(value2) || returns && value2 === "void")) return value2;
    if (!value2 || typeof value2 !== "object") return unsupported13("qualified fixed method type required");
    const checked = declaredType(value2);
    if (typeof checked === "string" || checked.vector !== void 0 || !isAS3DeclarationType(checked.reference) && !isAS3Interface(checked.reference) && !(typeof checked.reference === "function" && isCanonicalAS3DeclarationConstructor(checked.reference)) && !isCanonicalAS3ReferenceImplementation(checked.reference, checked.name))
      return unsupported13("method reference requires authenticated declaration, interface or canonical native identity");
    return Object.freeze({ name: checked.name, reference: checked.reference });
  };
  for (let index = 0; index < property2.value.length; index++) {
    const slot = Object.getOwnPropertyDescriptor(property2.value, String(index));
    if (!slot || !("value" in slot) || !slot.value || typeof slot.value !== "object")
      return unsupported13("dense data method signatures required");
    const input = slot.value, data4 = {};
    const fields2 = ["name", "parameters", "returns", "override", "final"];
    if (Object.getOwnPropertyDescriptor(input, "uri")) fields2.push("uri");
    if (Object.getOwnPropertyDescriptor(input, "requiredCount")) fields2.push("requiredCount");
    if (Object.getOwnPropertyDescriptor(input, "rest")) fields2.push("rest");
    if (Reflect.ownKeys(input).length !== fields2.length) return unsupported13("exact method signature fields required");
    for (const key3 of fields2) {
      const field = Object.getOwnPropertyDescriptor(input, key3);
      if (!field || !("value" in field)) return unsupported13("data method signature fields required");
      data4[key3] = field.value;
    }
    const identity = memberIdentity(data4);
    if (typeof data4.name !== "string" || result.has(identity) || typeof data4.override !== "boolean" || typeof data4.final !== "boolean" || !Array.isArray(data4.parameters)) return unsupported13("invalid fixed method signature");
    const returns = methodType(data4.returns, true);
    const rest = fields2.includes("rest") ? data4.rest : false;
    if (typeof rest !== "boolean") return unsupported13("invalid method rest flag");
    const requiredCount = fields2.includes("requiredCount") ? data4.requiredCount : data4.parameters.length;
    if (!Number.isInteger(requiredCount) || requiredCount < 0 || requiredCount > data4.parameters.length)
      return unsupported13("invalid method required count");
    const parameters = [];
    for (let i = 0; i < data4.parameters.length; i++) {
      const parameter = Object.getOwnPropertyDescriptor(data4.parameters, String(i));
      if (!parameter || !("value" in parameter))
        return unsupported13("qualified fixed method parameter required");
      parameters.push(methodType(parameter.value));
    }
    const trait = instance.find((value2) => memberIdentity(value2) === identity && value2.kind === "method");
    const method2 = trait && Object.getOwnPropertyDescriptor(prototype, trait.key);
    if (!method2 || !("value" in method2) || typeof method2.value !== "function")
      return unsupported13("signature requires own public method");
    let reflected = false;
    for (let i = 0; i < metadata.value.length; i++) {
      const entry = Object.getOwnPropertyDescriptor(metadata.value, String(i));
      if (!entry || !("value" in entry) || !entry.value || typeof entry.value !== "object")
        return unsupported13("dense method metadata required");
      const name2 = Object.getOwnPropertyDescriptor(entry.value, "name");
      if (!name2 || !("value" in name2)) return unsupported13("data method metadata required");
      if (name2.value !== data4.name) continue;
      const uri = Object.getOwnPropertyDescriptor(entry.value, "uri");
      if (uri && !("value" in uri)) return unsupported13("data method namespace required");
      if (memberIdentity({ name: name2.value, uri: uri?.value }) !== identity) continue;
      const declaredBy = Object.getOwnPropertyDescriptor(entry.value, "declaredBy");
      const count = Object.getOwnPropertyDescriptor(entry.value, "parameterCount");
      if (reflected || !declaredBy || !("value" in declaredBy) || declaredBy.value !== owner || !count || !("value" in count) || count.value !== parameters.length)
        return unsupported13("signature differs from own method metadata");
      reflected = true;
    }
    if (!reflected) return unsupported13("signature requires matching method metadata");
    result.set(identity, Object.freeze({ ...data4, returns, requiredCount, rest, parameters: Object.freeze(parameters) }));
  }
  return result;
}
function displayAccessorType(type) {
  return !!type && typeof type === "object" && type.vector === void 0 && (type.name === "flash.display::Sprite" || type.name === "flash.display::DisplayObject") && typeof type.reference === "function" && isCanonicalAS3DeclarationConstructor(type.reference) && getAS3DeclarationType(type.reference)?.name === type.name;
}
function accessorSignatures(definition, instance, prototype, owner) {
  const result = /* @__PURE__ */ new Map();
  const property2 = Object.getOwnPropertyDescriptor(definition, "instanceAccessors");
  if (!property2) return result;
  if (!("value" in property2) || !Array.isArray(property2.value)) return unsupported13("data accessor signature list required");
  const data4 = (input, allowed) => {
    if (!input || typeof input !== "object") return unsupported13("accessor signature record required");
    const copy = {};
    for (const key3 of Reflect.ownKeys(input)) {
      const field = Object.getOwnPropertyDescriptor(input, key3);
      if (typeof key3 !== "string" || !allowed.includes(key3) || !("value" in field))
        return unsupported13("exact data accessor signature fields required");
      copy[key3] = field.value;
    }
    return copy;
  };
  for (let index = 0; index < property2.value.length; index++) {
    const slot = Object.getOwnPropertyDescriptor(property2.value, String(index));
    if (!slot || !("value" in slot)) return unsupported13("dense data accessor signatures required");
    const item = data4(slot.value, ["name", "uri", "type", "setterType", "get", "set"]);
    const identity = memberIdentity(item);
    const checkedType = declaredType(item.type, true);
    if (typeof item.name !== "string" || result.has(identity) || !(item.uri || item.type === "Boolean" || item.type === "String" || item.type === "*" || item.type === "Number" || typeof checkedType === "object" && checkedType.vector === void 0 && (displayAccessorType(checkedType) || isAS3DeclarationType(checkedType.reference) || isAS3Interface(checkedType.reference) || checkedType.name === "Array" && checkedType.reference === Array) || item.type === "Object") || !item.get && !item.set)
      return unsupported13("qualified accessor signature required");
    const checkedSetterType = item.setterType === void 0 ? checkedType : declaredType(item.setterType, true);
    const trait = instance.find((value2) => memberIdentity(value2) === identity && value2.kind === "accessor" && sameStorageType(value2.type, checkedType) && sameStorageType(value2.setterType ?? value2.type, checkedSetterType));
    const descriptor2 = trait && Object.getOwnPropertyDescriptor(prototype, trait.key);
    if (!descriptor2 || "value" in descriptor2 || !descriptor2.configurable)
      return unsupported13("signature requires own configurable public accessor");
    const record5 = {};
    for (const side of ["get", "set"]) {
      if (!!item[side] !== !!descriptor2[side]) return unsupported13("signature requires exact own accessor halves");
      if (!item[side]) continue;
      const half = data4(item[side], ["override", "final"]);
      if (typeof half.override !== "boolean" || typeof half.final !== "boolean")
        return unsupported13("accessor half flags required");
      record5[side] = Object.freeze({ ...half, owner, type: side === "get" ? checkedType : checkedSetterType, implementation: descriptor2[side] });
    }
    const reflected = Object.getOwnPropertyDescriptor(definition.metadata, "instance");
    const list = reflected && "value" in reflected && Object.getOwnPropertyDescriptor(reflected.value, "accessors");
    if (!list || !("value" in list) || !Array.isArray(list.value)) return unsupported13("accessor metadata required");
    let matches = 0;
    for (let i = 0; i < list.value.length; i++) {
      const entry = Object.getOwnPropertyDescriptor(list.value, String(i));
      if (!entry || !("value" in entry)) return unsupported13("dense accessor metadata required");
      const member = data4(entry.value, ["name", "uri", "declaredBy", "access", "type"]);
      if (memberIdentity(member) === identity) {
        if (member.declaredBy !== owner || member.access !== trait.access || member.type !== (typeof checkedType === "string" ? checkedType : checkedType.name))
          return unsupported13("accessor signature differs from own metadata");
        matches++;
      }
    }
    if (matches !== 1) return unsupported13("signature requires matching accessor metadata");
    result.set(identity, Object.freeze(record5));
  }
  return result;
}
function accessorAccess(record5) {
  return record5.get && record5.set ? "readwrite" : record5.get ? "readonly" : "writeonly";
}
function sameMethodSignature(a, b) {
  const same = (left, right) => typeof left === "string" || typeof right === "string" ? left === right : left.name === right.name && left.reference === right.reference;
  return same(a.returns, b.returns) && a.requiredCount === b.requiredCount && a.rest === b.rest && a.parameters.length === b.parameters.length && a.parameters.every((type, index) => same(type, b.parameters[index]));
}
function declaredType(type, allowVector = false) {
  if (type && typeof type === "object") {
    const data4 = {};
    for (const key3 of Reflect.ownKeys(type)) {
      if (typeof key3 !== "string" || !["name", "reference", "vector"].includes(key3)) return unsupported13("unknown declared type field");
      const descriptor2 = Object.getOwnPropertyDescriptor(type, key3);
      if (!("value" in descriptor2)) return unsupported13("type getters are not authority");
      data4[key3] = descriptor2.value;
    }
    type = data4;
  }
  validateAS3PropertyType(type);
  if (typeof type === "string") return type;
  if (!type) return unsupported13("missing declared type");
  if (type.vector !== void 0) {
    if (!allowVector) return unsupported13("vector storage requires separate initialization authority");
    return Object.freeze({ name: type.name, vector: type.vector });
  }
  const reference = type.reference;
  if (isAS3DeclarationType(reference) || isAS3Interface(reference)) {
    if (reference.name !== type.name) return unsupported13("reference declaration name mismatch");
  } else if (reference === Array && type.name === "Array") {
  } else if (reference === AS3Date && type.name === "Date") {
  } else if (isCanonicalAS3ReferenceImplementation(reference, type.name)) {
  } else {
    const token = typeof reference === "function" && getAS3DeclarationType(reference);
    if (!token || token.name !== type.name) return unsupported13("native reference needs exact registered declaration identity");
  }
  return Object.freeze({ name: type.name, reference });
}
function defaultValue(type) {
  switch (type) {
    case "*":
      return void 0;
    case "int":
    case "uint":
      return 0;
    case "Number":
      return NaN;
    case "Boolean":
      return false;
    default:
      return null;
  }
}
function traits(input, instance = false, proxy = false) {
  if (!Array.isArray(input)) return unsupported13("complete trait list required");
  const names = /* @__PURE__ */ new Set(), keys = /* @__PURE__ */ new Set();
  const result = [];
  for (let index = 0; index < input.length; index++) {
    const descriptor2 = Object.getOwnPropertyDescriptor(input, String(index));
    if (!descriptor2 || !("value" in descriptor2)) return unsupported13("dense data trait list required");
    const source = descriptor2.value, value2 = {};
    if (!source || typeof source !== "object") return unsupported13("trait record required");
    for (const key4 of Reflect.ownKeys(source)) {
      if (typeof key4 !== "string" || !["name", "key", "kind", "type", "setterType", "uri", "access"].includes(key4)) return unsupported13("unknown trait field");
      const item = Object.getOwnPropertyDescriptor(source, key4);
      if (!("value" in item)) return unsupported13("trait getters are not authority");
      value2[key4] = item.value;
    }
    const key3 = value2.key ?? value2.name;
    const identity = memberIdentity(value2);
    if (typeof value2.name !== "string" || !value2.name || names.has(identity) || keys.has(key3) || typeof key3 !== "string" && typeof key3 !== "symbol") return unsupported13("duplicate or invalid storage trait");
    if (value2.uri && key3 !== namespaceKey(value2.uri, value2.name))
      return unsupported13("custom namespace registration requires separate authority: exact URI storage key");
    if (value2.uri === flash_proxy && (!proxy || !instance || value2.kind !== "method" || !flashProxyHookNames.includes(value2.name) || key3 !== flashProxyNamespaceKey(value2.name)))
      return unsupported13("custom namespace registration requires separate authority: exact flash_proxy hook");
    if (!["variable", "constant", "accessor", "method"].includes(value2.kind)) return unsupported13("trait kind");
    if (value2.access !== void 0 && (value2.kind !== "accessor" || !["readonly", "writeonly", "readwrite"].includes(value2.access))) return unsupported13("accessor projection");
    if (value2.setterType !== void 0) {
      if (value2.kind !== "accessor" || value2.access !== "readwrite" || value2.type !== "*" && value2.setterType !== "*")
        return unsupported13("separate setter type requires paired wildcard accessor");
      value2.setterType = declaredType(value2.setterType, true);
    }
    names.add(identity);
    keys.add(key3);
    result.push(Object.freeze({ ...value2, key: key3, ...value2.kind === "method" ? {} : { type: declaredType(
      value2.type,
      value2.kind === "accessor" || instance && value2.kind === "variable"
    ) } }));
  }
  return Object.freeze(result);
}
function instanceConstants(definition, instance) {
  const property2 = Object.getOwnPropertyDescriptor(definition, "instanceConstants");
  if (property2 && !("value" in property2)) return unsupported13("constant list getters are not authority");
  const input = property2 ? property2.value : [], expected = instance.filter((trait) => trait.kind === "constant");
  if (!Array.isArray(input) || input.length !== expected.length) return unsupported13("complete literal constant list required");
  const names = /* @__PURE__ */ new Set(), result = [];
  for (let index = 0; index < input.length; index++) {
    const entry = Object.getOwnPropertyDescriptor(input, String(index));
    if (!entry || !("value" in entry) || !entry.value || typeof entry.value !== "object")
      return unsupported13("dense data constant list required");
    const item = entry.value, keys = Reflect.ownKeys(item);
    if (keys.length !== (keys.includes("uri") ? 3 : 2) || !keys.includes("name") || !keys.includes("value")) return unsupported13("literal constant record required");
    const name2 = Object.getOwnPropertyDescriptor(item, "name"), value2 = Object.getOwnPropertyDescriptor(item, "value");
    const uri = Object.getOwnPropertyDescriptor(item, "uri");
    if (!("value" in name2) || !("value" in value2)) return unsupported13("constant getters are not authority");
    if (uri && !("value" in uri)) return unsupported13("constant namespace getters are not authority");
    const identity = memberIdentity({ name: name2.value, uri: uri?.value });
    const trait = expected.find((trait2) => memberIdentity(trait2) === identity);
    if (!trait || names.has(identity) || typeof trait.type !== "string" || !["int", "uint", "Number", "Boolean", "String"].includes(trait.type)) return unsupported13("primitive constant trait required");
    if (value2.value !== null && !["number", "string", "boolean"].includes(typeof value2.value))
      return unsupported13("primitive constant value required");
    names.add(identity);
    result.push(Object.freeze({ key: trait.key, value: coerceAS3PropertyValue(value2.value, trait.type) }));
  }
  return Object.freeze(result);
}
function inheritedMetadata(input, parent, overrides, accessors) {
  const data4 = {};
  for (const key3 of ["name", "base", "isDynamic", "isFinal", "instance", "statics"]) {
    const value2 = Object.getOwnPropertyDescriptor(input, key3);
    if (!value2 || !("value" in value2)) return unsupported13("data class metadata required");
    data4[key3] = value2.value;
  }
  if (Object.getOwnPropertyDescriptor(input, "sourceReflection"))
    return unsupported13("inherited complete reflection requires separate authority");
  const merged = {};
  for (const kind of ["variables", "constants", "methods", "accessors"]) {
    const list = Object.getOwnPropertyDescriptor(data4.instance, kind);
    if (!list || !("value" in list) || !Array.isArray(list.value)) return unsupported13("own member lists required");
    const own2 = [];
    for (let index = 0; index < list.value.length; index++) {
      const slot = Object.getOwnPropertyDescriptor(list.value, String(index));
      if (!slot || !("value" in slot) || !slot.value || typeof slot.value !== "object")
        return unsupported13("dense own member records required");
      const copy = {};
      for (const key3 of Reflect.ownKeys(slot.value)) {
        const field = Object.getOwnPropertyDescriptor(slot.value, key3);
        if (typeof key3 !== "string" || !("value" in field)) return unsupported13("own member data required");
        copy[key3] = field.value;
      }
      if (copy.declaredBy !== data4.name) return unsupported13("own member declaration required");
      if (kind === "accessors" && accessors.has(memberIdentity(copy))) {
        const accessor = accessors.get(memberIdentity(copy));
        copy.declaredBy = (accessor.get || accessor.set).owner;
        copy.access = accessorAccess(accessor);
      }
      own2.push(copy);
    }
    merged[kind] = [...[...parent.members[kind] || []].filter((member) => !["methods", "accessors"].includes(kind) || !overrides.has(memberIdentity(member))), ...own2];
  }
  return { ...data4, instance: merged };
}
function storage2(target, trait, initial) {
  defineAS3GeneratedVariable(target, trait.key, initial);
}
function defineAS3GeneratedStaticConstant(constructor, key3, type, value2) {
  if (typeof constructor !== "function" || !staticStorageKey(key3) || Object.prototype.hasOwnProperty.call(constructor, key3)) return unsupported13("fresh own static constant required");
  const checked = declaredType(type), converted = coerceAS3PropertyValue(value2, checked);
  Object.defineProperty(constructor, key3, { value: converted, enumerable: false, writable: false, configurable: false });
}
function declareAS3GeneratedStaticConstant(constructor, key3, type) {
  if (typeof constructor !== "function" || records.has(constructor) || !staticStorageKey(key3) || Object.prototype.hasOwnProperty.call(constructor, key3))
    return unsupported13("fresh unregistered static constant required");
  const checked = declaredType(type);
  if (checked !== "Object" && (typeof checked === "string" || !isAS3DeclarationType(checked.reference) && checked.reference !== Array))
    return unsupported13("deferred constant requires source class, Array or Object type");
  const slot = { type: checked, registered: false, initialized: false };
  Object.defineProperty(constructor, key3, { value: null, writable: false, enumerable: false, configurable: true });
  let slots = deferredConstants.get(constructor);
  if (!slots) deferredConstants.set(constructor, slots = /* @__PURE__ */ new Map());
  slots.set(key3, slot);
  return (value2) => {
    if (!slot.registered || slot.initialized) return unsupported13("registered uninitialized constant required");
    const own2 = Object.getOwnPropertyDescriptor(constructor, key3);
    if (!own2 || !("value" in own2) || own2.value !== null || own2.writable || own2.enumerable || !own2.configurable)
      return unsupported13("compiler constant storage was replaced");
    const converted = coerceAS3PropertyValue(value2, checked);
    Object.defineProperty(constructor, key3, { value: converted, writable: false, enumerable: false, configurable: false });
    slot.initialized = true;
  };
}
function registerAS3GeneratedClass(constructor, definition) {
  if (typeof constructor !== "function" || records.has(constructor)) return unsupported13("fresh native class required");
  const prototype = Object.getOwnPropertyDescriptor(constructor, "prototype");
  if (!prototype || prototype.writable || prototype.configurable || !prototype.value) return unsupported13("locked class prototype required");
  if (!definition || typeof definition !== "object") return unsupported13("data definition required");
  for (const key3 of ["metadata", "instanceTraits", "staticTraits", "declaration"]) {
    const property2 = Object.getOwnPropertyDescriptor(definition, key3);
    if (!property2 || !("value" in property2)) return unsupported13("data definition required");
  }
  const declarationInput = definition.declaration;
  const declarationType = declarationInput && Object.getOwnPropertyDescriptor(declarationInput, "type");
  const publisher = declarationInput && Object.getOwnPropertyDescriptor(declarationInput, "publishGeneration");
  const metadataName = definition.metadata && Object.getOwnPropertyDescriptor(definition.metadata, "name");
  if (!declarationType || !("value" in declarationType) || !publisher || !("value" in publisher) || !metadataName || !("value" in metadataName) || !isAS3DeclarationType(declarationType.value) || declarationType.value.name !== metadataName.value || typeof publisher.value !== "function")
    return unsupported13("matching compiler declaration authority required");
  const declaration2 = Object.freeze({ type: declarationType.value, publishGeneration: publisher.value });
  const proxyType = getAS3DeclarationType(Proxy2);
  const proxy = !!proxyType && getAS3DeclarationTypeChain(declaration2.type).includes(proxyType);
  let instance = traits(definition.instanceTraits, true, proxy);
  let methods5 = methodSignatures(definition, instance, prototype.value, declaration2.type.name);
  let accessorRecords = accessorSignatures(definition, instance, prototype.value, declaration2.type.name);
  const ownAccessorNames = new Set(accessorRecords.keys());
  const statics = traits(definition.staticTraits);
  let constants = instanceConstants(definition, instance), metadata = definition.metadata;
  const baseInput = Object.getOwnPropertyDescriptor(definition, "instanceBase");
  const nativeBaseInput = Object.getOwnPropertyDescriptor(definition, "nativeAccessorBase");
  if (nativeBaseInput) {
    if (baseInput || !("value" in nativeBaseInput)) return unsupported13("exclusive data native accessor base required");
    const base = nativeBaseInput.value, mouse = nativeMouseTargetBases.has(base);
    const selected = mouse ? nativeMouseTargetBases.get(base) : nativePositionBases.get(base);
    const reflectedBase = Object.getOwnPropertyDescriptor(metadata, "base");
    if (!selected || Object.getPrototypeOf(prototype.value) !== base.prototype || !reflectedBase || !("value" in reflectedBase) || reflectedBase.value !== (mouse ? "flash.events::MouseEvent" : "flash.display::Sprite"))
      return unsupported13("exact native position base required");
    const positions = (mouse ? ["target", "currentTarget"] : ["x", "y"]).filter((name2) => Object.prototype.hasOwnProperty.call(prototype.value, name2));
    if (!positions.length || positions.some((name2) => !accessorRecords.has(memberIdentity({ name: name2 }))))
      return unsupported13("native position override requires own half contracts");
    for (const [identity, own2] of accessorRecords) {
      const trait = instance.find((t) => memberIdentity(t) === identity), name2 = trait.name;
      if ((trait.uri || !positions.includes(name2)) && !own2.get?.override && !own2.set?.override) continue;
      const inherited = !trait.uri && selected.get(name2);
      if (!inherited || trait?.type !== (mouse ? "Object" : "Number")) return unsupported13("native override requires qualified accessor signature");
      if (trait.setterType !== void 0) return unsupported13("native accessor half type mismatch");
      for (const side of ["get", "set"]) if (own2[side] && !own2[side].override)
        return unsupported13("native position half requires override");
      const merged = Object.freeze({ ...inherited, ...own2 });
      if (trait.access !== accessorAccess(merged)) return unsupported13("native position projection mismatch");
      accessorRecords.set(identity, merged);
    }
    metadata = { ...metadata, instance: { ...metadata.instance, accessors: metadata.instance?.accessors?.map((a) => {
      const record5 = accessorRecords.get(memberIdentity(a));
      return record5 ? { ...a, declaredBy: (record5.get || record5.set).owner } : a;
    }) } };
  }
  if (baseInput) {
    if (!("value" in baseInput) || typeof baseInput.value !== "function") return unsupported13("data instance base required");
    const base = baseInput.value, parent = records.get(base), baseType = getAS3DeclarationType(base);
    const basePrototype = Object.getOwnPropertyDescriptor(base, "prototype");
    if (!parent || !baseType || !basePrototype || Object.getPrototypeOf(prototype.value) !== basePrototype.value)
      return unsupported13("exact registered generated instance base required");
    if (parent.final) return unsupported13("source extends final Class");
    const baseName = Object.getOwnPropertyDescriptor(metadata, "base");
    if (!baseName || !("value" in baseName) || baseName.value !== baseType.name)
      return unsupported13("instance base declaration mismatch");
    const overrides = /* @__PURE__ */ new Set();
    for (const own2 of instance) {
      const identity = memberIdentity(own2);
      const collisions = parent.traits.filter((inherited2) => memberIdentity(inherited2) === identity || inherited2.key === own2.key);
      const method2 = methods5.get(identity);
      if (!collisions.length) {
        if (method2?.override) return unsupported13("override requires selected parent method");
        const accessor = accessorRecords.get(identity);
        if (accessor?.get?.override || accessor?.set?.override) return unsupported13("override requires selected parent accessor half");
        continue;
      }
      const inherited = collisions[0], selected = parent.methods.get(memberIdentity(inherited));
      if (collisions.length === 1 && own2.kind === "accessor" && inherited.kind === "accessor" && identity === memberIdentity(inherited) && own2.key === inherited.key && sameStorageType(own2.type, inherited.type) && (own2.uri || own2.type === "Boolean" || own2.type === "String" || own2.type === "*" || own2.type === "Number" || typeof own2.type === "object" && own2.type.vector === void 0 && (displayAccessorType(own2.type) || isAS3DeclarationType(own2.type.reference) || isAS3Interface(own2.type.reference) || own2.type.name === "Array" && own2.type.reference === Array) || own2.type === "Object")) {
        const accessor = accessorRecords.get(identity), selectedAccessor = parent.accessors.get(identity);
        if (!accessor || !selectedAccessor) return unsupported13("selected parent accessor requires half authority");
        for (const side of ["get", "set"]) if (accessor[side]) {
          const ownHalf = accessor[side], parentHalf = selectedAccessor[side];
          if (parentHalf ? !ownHalf.override || parentHalf.final || !sameStorageType(ownHalf.type, parentHalf.type) : ownHalf.override)
            return unsupported13("selected parent accessor requires matching nonfinal half authority");
        }
        const merged = Object.freeze({ ...selectedAccessor, ...accessor });
        if (merged.set && !sameStorageType(own2.setterType ?? own2.type, merged.set.type))
          return unsupported13("selected parent setter type differs from projection");
        if (own2.access !== accessorAccess(merged)) return unsupported13("selected parent accessor projection mismatch");
        accessorRecords.set(identity, merged);
        overrides.add(identity);
        continue;
      }
      if (collisions.length !== 1 || own2.kind !== "method" || inherited.kind !== "method" || identity !== memberIdentity(inherited) || own2.key !== inherited.key || !method2?.override || !selected || selected.final || !sameMethodSignature(method2, selected))
        return unsupported13("selected parent override requires matching nonfinal method authority");
      overrides.add(identity);
    }
    metadata = inheritedMetadata(metadata, parent, overrides, accessorRecords);
    accessorRecords = new Map([...parent.accessors, ...accessorRecords]);
    instance = Object.freeze([...parent.traits.filter((trait) => !overrides.has(memberIdentity(trait))), ...instance]);
    methods5 = new Map([...parent.methods, ...methods5]);
    constants = Object.freeze([...parent.constants, ...constants]);
  } else if ([...methods5.values()].some((method2) => method2.override) || !nativeBaseInput && [...accessorRecords.values()].some((a) => a.get?.override || a.set?.override)) return unsupported13("override requires selected instance base");
  const deferred = deferredConstants.get(constructor);
  if (deferred) for (const [key3, slot] of deferred) {
    const trait = statics.find((value2) => value2.key === key3 && value2.kind === "constant");
    const type = trait && trait.type;
    if (!type || (typeof type === "string" || typeof slot.type === "string" ? type !== slot.type : type.name !== slot.type.name || type.reference !== slot.type.reference))
      return unsupported13("deferred constant requires matching declared trait");
  }
  const fields2 = instance.filter((trait) => trait.kind === "variable" && trait.nativeStorage !== "accessor").map((trait) => Object.freeze({ key: trait.key, type: trait.type }));
  const accessors = [];
  for (const [surface, target] of [[instance, prototype.value], [statics, constructor]]) {
    for (const trait of surface) {
      let own2 = Object.getOwnPropertyDescriptor(target, trait.key);
      if (target === prototype.value && ownAccessorNames.has(memberIdentity(trait))) {
        const record5 = accessorRecords.get(memberIdentity(trait));
        if (trait.access !== accessorAccess(record5)) return unsupported13("accessor projection mismatch");
        own2 = { ...own2, get: record5.get?.implementation, set: record5.set?.implementation };
      }
      if (trait.kind === "accessor" && own2) {
        if (!own2.configurable || "value" in own2) return unsupported13("configurable declared accessor required");
        const type = trait.type;
        const check = (receiver3) => {
          if (target === constructor ? receiver3 !== constructor : !isAS3DeclaredInstance(receiver3, declaration2.type))
            unsupported13("accessor requires genuine source receiver");
        };
        accessors.push({ target, key: trait.key, descriptor: {
          ...own2,
          get: trait.access === "writeonly" ? own2.get : own2.get && function() {
            check(this);
            return coerceAS3PropertyValue(own2.get.call(this), type);
          },
          set: trait.access === "readonly" ? own2.set : own2.set && function(value2) {
            check(this);
            own2.set.call(this, coerceAS3PropertyValue(value2, trait.setterType ?? type));
          }
        } });
      }
      if (target === constructor && trait.kind === "variable" && own2 && (!("value" in own2) || !own2.configurable)) return unsupported13("static variable storage already locked");
      const pending = target === constructor && deferred?.get(trait.key);
      if (target === constructor && trait.kind === "constant" && (!own2 || !("value" in own2) || own2.writable || (pending ? !own2.configurable || own2.enumerable || own2.value !== null : own2.configurable)))
        return unsupported13("static constant must be initialized as own locked storage");
    }
  }
  registerFlashTypeMetadata(constructor, metadata);
  const reflectedMembers = describeRegisteredFlashType(constructor).factory;
  const isFinal = Object.getOwnPropertyDescriptor(metadata, "isFinal").value;
  const generation = declaration2.publishGeneration(constructor);
  if (getAS3DeclarationType(constructor) !== declaration2.type || !generation || typeof generation.enterInstance !== "function")
    return unsupported13("publisher did not establish matching source identity");
  for (const accessor of accessors) Object.defineProperty(accessor.target, accessor.key, accessor.descriptor);
  registerAS3PropertyTraits(constructor, instance, statics);
  for (const trait of statics) if (trait.kind === "variable") {
    const own2 = Object.getOwnPropertyDescriptor(constructor, trait.key);
    storage2(constructor, { key: trait.key, type: trait.type }, own2 ? own2.value : defaultValue(trait.type));
  }
  const storedRecord = { fields: Object.freeze(fields2), constants, traits: instance, members: reflectedMembers, final: isFinal, methods: methods5, accessors: accessorRecords };
  records.set(constructor, storedRecord);
  prototypeRecords.set(prototype.value, storedRecord);
  if (deferred) for (const slot of deferred.values()) slot.registered = true;
  return Object.freeze({ enterInstance(value2) {
    if (value2 === null || typeof value2 !== "object") return unsupported13("native instance required");
    const planned = prototypeRecords.get(Object.getPrototypeOf(value2));
    if (!planned) return unsupported13("most-derived generated storage must be registered");
    if (!entered.has(value2)) {
      if (!Object.isExtensible(value2)) return unsupported13("fresh extensible instance required");
      for (const field of [...planned.fields, ...planned.constants]) if (Object.prototype.hasOwnProperty.call(value2, field.key))
        return unsupported13("constructor entry must precede source field effects");
    }
    generation.enterInstance(value2);
    if (!isAS3DeclaredInstance(value2, declaration2.type)) return unsupported13("entry did not establish genuine source identity");
    if (entered.has(value2)) return;
    const exact = getAS3ExactSourceClass(value2), record5 = exact && records.get(exact.constructor);
    if (!record5) return unsupported13("most-derived generated storage must be registered");
    for (const field of record5.fields) storage2(value2, field, defaultValue(field.type));
    for (const constant of record5.constants) Object.defineProperty(
      value2,
      constant.key,
      { value: constant.value, writable: false, enumerable: false, configurable: false }
    );
    entered.add(value2);
  } });
}

// ../engine/src/layaAir/flash/utils/AS3LexicalMembers.ts
var AS3LexicalMembers_exports = {};
__export(AS3LexicalMembers_exports, {
  as3AddAssignLexicalProperty: () => as3AddAssignLexicalProperty,
  as3CallInternalMember: () => as3CallInternalMember,
  as3CallLexicalFunction: () => as3CallLexicalFunction,
  as3CallLexicalMember: () => as3CallLexicalMember,
  as3CallLexicalProperty: () => as3CallLexicalProperty,
  as3ConstructLexicalClass: () => as3ConstructLexicalClass,
  as3DeleteLexicalProperty: () => as3DeleteLexicalProperty,
  as3GetInternalMember: () => as3GetInternalMember,
  as3GetLexicalMember: () => as3GetLexicalMember,
  as3GetLexicalProperty: () => as3GetLexicalProperty,
  as3SetInternalMember: () => as3SetInternalMember,
  as3SetLexicalMember: () => as3SetLexicalMember,
  as3SetLexicalProperty: () => as3SetLexicalProperty,
  bindAS3InternalPackage: () => bindAS3InternalPackage,
  declareAS3InternalPackage: () => declareAS3InternalPackage,
  getAS3InheritedLexicalBase: () => getAS3InheritedLexicalBase,
  getAS3LexicalClassConstantInitializer: () => getAS3LexicalClassConstantInitializer,
  getAS3LexicalObjectConstantInitializer: () => getAS3LexicalObjectConstantInitializer,
  getAS3LexicalReferenceConstantInitializer: () => getAS3LexicalReferenceConstantInitializer,
  getAS3LexicalStringConstantInitializer: () => getAS3LexicalStringConstantInitializer,
  initializeAS3LexicalInstance: () => initializeAS3LexicalInstance,
  publishCanonicalAS3LexicalBoundary: () => publishCanonicalAS3LexicalBoundary,
  registerAS3LexicalMembers: () => registerAS3LexicalMembers,
  resolveAS3InternalMember: () => resolveAS3InternalMember,
  resolveAS3LexicalMember: () => resolveAS3LexicalMember
});
var internalPackages = /* @__PURE__ */ new WeakMap();
var namedInternalPackages = /* @__PURE__ */ new Map();
function declareAS3InternalPackage(types) {
  return bindInternalPackage(types, false);
}
function bindAS3InternalPackage(types) {
  return bindInternalPackage(types, true);
}
function bindInternalPackage(types, reuse) {
  if (!Array.isArray(types) || !types.length || new Set(types).size !== types.length)
    return unsupported14("nonempty unique package declarations required");
  let namespace3;
  for (const type of types) {
    if (!isAS3DeclarationType(type) || (internalPackages.has(type) ? !reuse : declarations3.has(type)))
      return unsupported14("fresh exact package declaration required");
    const split2 = type.name.lastIndexOf("::"), name2 = split2 < 0 ? "" : type.name.slice(0, split2);
    if (namespace3 !== void 0 && namespace3 !== name2) return unsupported14("package declarations have different namespaces");
    namespace3 = name2;
  }
  if (reuse && !namespace3) return unsupported14("named package required for inherited membership");
  const capability = namespace3 && namedInternalPackages.get(namespace3) || Object.freeze({});
  if (namespace3) namedInternalPackages.set(namespace3, capability);
  for (const type of types) internalPackages.set(type, capability);
  return capability;
}
function samePackage(a, b) {
  const capability = internalPackages.get(a.type);
  return !!capability && capability === internalPackages.get(b.type);
}
var scopes = /* @__PURE__ */ new WeakMap();
var declarations3 = /* @__PURE__ */ new WeakMap();
var generations = /* @__PURE__ */ new WeakMap();
var accesses = /* @__PURE__ */ new WeakMap();
var inheritedBases = /* @__PURE__ */ new WeakMap();
function getAS3InheritedLexicalBase(constructor) {
  const generation = generations.get(constructor);
  if (!generation || getAS3DeclarationType(constructor) !== generation.scope.type)
    return unsupported14("exact registered source lexical generation required");
  const value2 = Object.freeze({});
  inheritedBases.set(value2, generation.scope);
  return value2;
}
function unsupported14(reason) {
  throw new TypeError("AS3_LEXICAL_UNSUPPORTED: " + reason);
}
function error3(id) {
  const e = new ReferenceError("Error #" + id);
  Object.defineProperty(e, "errorID", { value: id });
  throw e;
}
function scope(value2) {
  return value2 && scopes.get(value2) || unsupported14("unknown lexical capability");
}
function key2(name2, visibility, isStatic) {
  return JSON.stringify([isStatic, visibility, name2]);
}
function sameType(a, b) {
  return a === b || !!a && !!b && typeof a === "object" && typeof b === "object" && a.name === b.name && a.reference === b.reference;
}
function sameTrait(a, b) {
  return a.name === b.name && a.visibility === b.visibility && a.static === b.static && a.kind === b.kind && a.parameterCount === b.parameterCount && sameType(a.type, b.type) && Object.is(a.initialValue, b.initialValue) && a.getter === b.getter && a.setter === b.setter && Object.is(a.value, b.value);
}
function publishCanonicalAS3LexicalBoundary(constructor) {
  const chain = getAS3DeclaredConstructorChain(constructor);
  if (!chain?.length || chain[0] !== constructor) return unsupported14("exact canonical boundary required");
  for (let index = 0; index < chain.length; index++) {
    const current = chain[index], parent = chain[index + 1];
    if (!isCanonicalAS3DeclarationConstructor(current) || getAS3SourceBase(current) !== (parent ? getAS3DeclarationType(parent) : null))
      return unsupported14("exact canonical source chain required");
  }
  let base = null;
  for (const current of [...chain].reverse()) {
    const previous = generations.get(current);
    if (previous) {
      if (previous.scope.base !== base) return unsupported14("canonical lexical ancestry changed");
      base = previous.scope;
    } else {
      const type = getAS3DeclarationType(current), value2 = Object.freeze({});
      const boundary = { value: value2, type, base, traits: /* @__PURE__ */ new Map() };
      scopes.set(value2, boundary);
      declarations3.set(type, boundary);
      generations.set(current, { constructor: current, scope: boundary, bindings: /* @__PURE__ */ new Map() });
      base = boundary;
    }
  }
  return base.value;
}
function registerAS3LexicalMembers(constructor, base, members2) {
  const type = getAS3DeclarationType(constructor);
  if (!type || isCanonicalAS3DeclarationConstructor(constructor)) unsupported14("entered source declaration required");
  const parent = base === null ? null : inheritedBases.get(base) ?? scope(base);
  if (getAS3SourceBase(constructor) !== (parent?.type ?? null)) unsupported14("sealed lexical source base mismatch");
  if (generations.has(constructor)) unsupported14("generation already registered");
  if (!Array.isArray(members2)) unsupported14("complete supplied lexical member list required");
  const traits2 = /* @__PURE__ */ new Map(), bindings4 = /* @__PURE__ */ new Map(), storage3 = /* @__PURE__ */ new Set();
  const counts = [];
  for (const member of members2) {
    if (!member || typeof member.name !== "string" || !member.name || !["private", "protected", "internal"].includes(member.visibility) || member.static !== void 0 && typeof member.static !== "boolean") unsupported14("lexical member identity");
    if (member.visibility === "internal" && (!internalPackages.has(type) || !(member.kind === "variable" && !member.static && member.type === "uint" || member.kind === "constant" && member.static && member.type === "uint" || member.kind === "method" && !member.static || member.kind === "accessor" && !member.static && member.type === "Boolean" && member.getter === true && member.setter === false)))
      unsupported14("internal package authority and qualified storage/getter/method required");
    const id = key2(member.name, member.visibility, !!member.static);
    if (traits2.has(id)) unsupported14("duplicate lexical declaration");
    const trait = { name: member.name, visibility: member.visibility, static: !!member.static, kind: member.kind };
    let binding;
    if (member.kind === "variable") {
      validateAS3PropertyType(member.type);
      const type2 = typeof member.type === "object" ? Object.freeze({ ...member.type }) : member.type;
      const initial = Object.getOwnPropertyDescriptor(member, "initialValue");
      if (initial) {
        if (member.visibility !== "internal" || member.static || type2 !== "uint" || !("value" in initial) || !Number.isInteger(initial.value) || initial.value < 0 || initial.value > 4294967295)
          unsupported14("internal uint literal initial value required");
        Object.assign(trait, { initialValue: initial.value });
      }
      Object.assign(trait, { type: type2 });
      binding = { trait, key: Symbol(member.name) };
    } else if (member.kind === "constant") {
      const value2 = Object.getOwnPropertyDescriptor(member, "value");
      if (member.type === "Class" || member.type === "Object" || canonicalConstantType(member.type) || member.type === "String" && !value2) {
        if (member.visibility !== "private" || !member.static || value2)
          unsupported14("private static " + member.type + " constant requires deferred initialization");
        const type2 = typeof member.type === "object" ? Object.freeze({ ...member.type }) : member.type;
        Object.assign(trait, { type: type2 });
      } else {
        if (!(member.visibility === "protected" || member.visibility === "private" && member.static && (member.type === "String" || member.type === "int" || member.type === "uint" || member.type === "Number" || member.type === "*") || member.visibility === "internal" && member.static && member.type === "uint") || !value2 || !("value" in value2) || !(member.type === "String" && typeof value2.value === "string" || member.type === "int" && Number.isInteger(value2.value) && value2.value >= -2147483648 && value2.value <= 2147483647 || member.type === "*" && member.visibility === "private" && member.static && value2.value === void 0 || member.type === "uint" && member.static && Number.isInteger(value2.value) && value2.value >= 0 && value2.value <= 4294967295 || member.type === "Number" && member.static && typeof value2.value === "number"))
          unsupported14("qualified protected/private literal or internal static uint constant required");
        Object.assign(trait, { type: member.type, value: value2.value });
      }
      binding = { trait, key: Symbol(member.name) };
    } else if (member.kind === "method") {
      if (typeof member.key !== "string" && typeof member.key !== "symbol" || !Number.isSafeInteger(member.parameterCount) || member.parameterCount < 0) unsupported14("method declaration");
      const owner = member.static ? constructor : Object.getOwnPropertyDescriptor(constructor, "prototype")?.value;
      const descriptor2 = Object.getOwnPropertyDescriptor(owner, member.key);
      if (!descriptor2 || !("value" in descriptor2) || typeof descriptor2.value !== "function") unsupported14("exact own source method required");
      Object.assign(trait, { parameterCount: member.parameterCount });
      if (storage3.has(member.key)) unsupported14("distinct lexical methods share native storage");
      storage3.add(member.key);
      binding = { trait, key: Symbol(member.name), source: descriptor2.value };
      counts.push([descriptor2.value, member.parameterCount]);
    } else if (member.kind === "accessor") {
      const readonlyReturn = member.type === "Boolean" || (member.visibility === "private" || member.visibility === "protected") && (member.type === "Number" || member.type === "Object" || typeof member.type === "object" && member.type !== null && "reference" in member.type && isAS3DeclarationType(member.type.reference));
      const readonlyGetter = !member.static && readonlyReturn && member.getter === true && member.setter === false;
      if (member.getter !== true || member.setter !== true && !readonlyGetter)
        unsupported14("accessor/signature admission pending: complete source accessor pair required");
      if (typeof member.key !== "string" && typeof member.key !== "symbol") unsupported14("accessor native key");
      validateAS3PropertyType(member.type);
      const owner = member.static ? constructor : Object.getOwnPropertyDescriptor(constructor, "prototype")?.value;
      const descriptor2 = owner && Object.getOwnPropertyDescriptor(owner, member.key);
      if (!descriptor2 || "value" in descriptor2 || typeof descriptor2.get !== "function" || (readonlyGetter ? descriptor2.set !== void 0 : typeof descriptor2.set !== "function"))
        unsupported14("exact own source accessor pair required");
      if (storage3.has(member.key)) unsupported14("distinct lexical members share native storage");
      storage3.add(member.key);
      const type2 = typeof member.type === "object" ? Object.freeze({ ...member.type }) : member.type;
      Object.assign(trait, { type: type2, getter: true, setter: member.setter });
      binding = { trait, key: Symbol(member.name), get: descriptor2.get, set: descriptor2.set };
    } else unsupported14("accessor/signature admission pending");
    Object.freeze(trait);
    Object.freeze(binding);
    traits2.set(id, trait);
    bindings4.set(id, binding);
  }
  const previous = declarations3.get(type);
  if (previous && (previous.base !== parent || previous.traits.size !== traits2.size || [...traits2].some(([id, trait]) => !previous.traits.has(id) || !sameTrait(previous.traits.get(id), trait))))
    unsupported14("source declaration changed between generations");
  for (const trait of traits2.values()) if (trait.visibility === "protected" || trait.visibility === "internal") {
    for (let current = parent; current; current = current.base) {
      if (trait.visibility === "internal" && internalPackages.get(type) !== internalPackages.get(current.type)) continue;
      const inherited = current.traits.get(key2(trait.name, trait.visibility, trait.static));
      if (inherited && !(trait.kind === "method" && inherited.kind === "method" && trait.parameterCount === inherited.parameterCount || trait.kind === "accessor" && inherited.kind === "accessor" && sameTrait(trait, inherited)))
        unsupported14(trait.visibility + " override/field conflict");
    }
  }
  const reflection2 = describeRegisteredFlashType(constructor);
  for (const [surface, isStatic] of [[reflection2.factory, false], [reflection2, true]]) {
    for (const member of [...surface.variables, ...surface.accessors, ...surface.methods, ...surface.constants ?? []]) {
      if (member.uri || member.declaredBy !== type.name) continue;
      if (traits2.has(key2(member.name, "protected", isStatic))) unsupported14("public/protected declaration conflict");
      for (let current = parent; current; current = current.base)
        if (current.traits.has(key2(member.name, "protected", isStatic))) unsupported14("public override of protected declaration");
    }
  }
  if ([...traits2.values()].some((trait) => trait.static && (trait.kind === "variable" || trait.kind === "constant")) && !Object.isExtensible(constructor))
    unsupported14("static lexical storage requires extensible native constructor");
  registerAS3FunctionParameterCounts(counts);
  const record5 = previous ?? { value: Object.freeze({}), type, base: parent, traits: traits2 };
  const generation = { constructor, scope: record5, bindings: bindings4 };
  declarations3.set(type, record5);
  scopes.set(record5.value, record5);
  generations.set(constructor, generation);
  initializeFields(generation, constructor, true);
  return record5.value;
}
function defaultValue2(type) {
  return type === "*" ? void 0 : type === "Number" ? NaN : type === "int" || type === "uint" ? 0 : type === "Boolean" ? false : null;
}
function initializeFields(generation, target, isStatic) {
  for (const binding of generation.bindings.values()) if (binding.trait.static === isStatic && (binding.trait.kind === "variable" || binding.trait.kind === "constant")) {
    const constant = binding.trait.kind === "constant";
    const deferred = constant && (binding.trait.type === "Class" || binding.trait.type === "Object" || canonicalConstantType(binding.trait.type) || binding.trait.type === "String" && !Object.prototype.hasOwnProperty.call(binding.trait, "value"));
    if (!Object.getOwnPropertyDescriptor(target, binding.key))
      Object.defineProperty(target, binding.key, {
        value: deferred ? null : constant ? binding.trait.value : binding.trait.initialValue !== void 0 ? binding.trait.initialValue : defaultValue2(binding.trait.type),
        writable: !constant,
        enumerable: false,
        configurable: deferred
      });
  }
}
function entered2(value2) {
  const constructors6 = getAS3EnteredSourceConstructors(value2);
  if (!constructors6) return void 0;
  const chain = constructors6.map((constructor) => generations.get(constructor));
  if (chain.some((generation) => !generation)) unsupported14("entered source chain has unregistered lexical generation");
  return chain;
}
function initializeAS3LexicalInstance(lexical, target) {
  const current = scope(lexical), chain = entered2(target);
  if (!chain || !chain.some((generation) => generation.scope === current)) unsupported14("lexical initialization requires genuine source entry");
  for (const generation of [...chain].reverse()) initializeFields(generation, target, false);
}
function resolveAS3LexicalMember(lexical, name2, visibility, isStatic = false, superAccess = false) {
  const current = scope(lexical);
  if (typeof name2 !== "string" || !name2 || !["private", "protected", "internal"].includes(visibility) || typeof isStatic !== "boolean" || typeof superAccess !== "boolean" || superAccess && (visibility !== "protected" || isStatic)) unsupported14("source lexical lookup");
  let owner = superAccess ? current.base : current;
  for (; owner; owner = visibility === "private" || visibility === "internal" && isStatic ? null : owner.base) {
    const trait = owner.traits.get(key2(name2, visibility, isStatic));
    if (trait && (visibility !== "internal" || samePackage(current, owner))) {
      const value2 = Object.freeze({});
      accesses.set(value2, { scope: current, owner, trait, super: superAccess });
      return value2;
    }
  }
  return unsupported14("source lexical declaration not found");
}
function resolveAS3InternalMember(lexical, receiver3, name2, isStatic = false) {
  const current = scope(lexical), start = scope(receiver3);
  if (typeof name2 !== "string" || !name2 || typeof isStatic !== "boolean") unsupported14("source internal lookup");
  for (let owner = start; owner; owner = isStatic ? null : owner.base) {
    const trait = owner.traits.get(key2(name2, "internal", isStatic));
    if (trait && samePackage(current, owner)) {
      const value2 = Object.freeze({});
      accesses.set(value2, { scope: current, owner, trait, super: false });
      return value2;
    }
  }
  return unsupported14("authorized internal declaration not found");
}
function internalDeclaration(lexical, type, name2) {
  const caller = scope(lexical), membership = internalPackages.get(caller.type);
  if (!isAS3DeclarationType(type) || !membership || membership !== internalPackages.get(type) || typeof name2 !== "string" || !name2) unsupported14("exact same-package declaration required");
  return caller;
}
function as3GetInternalMember(target, lexical, type, name2) {
  internalDeclaration(lexical, type, name2);
  if (target == null) return as3GetProperty(target, name2);
  const owner = declarations3.get(type);
  if (!owner) return unsupported14("internal receiver declaration has not entered");
  return as3GetLexicalMember(target, resolveAS3InternalMember(lexical, owner.value, name2, typeof target === "function"));
}
function as3SetInternalMember(target, lexical, type, name2, value2) {
  internalDeclaration(lexical, type, name2);
  if (target == null) {
    as3SetProperty(target, name2, value2);
    return value2;
  }
  const owner = declarations3.get(type);
  if (!owner) return unsupported14("internal receiver declaration has not entered");
  return as3SetLexicalMember(target, resolveAS3InternalMember(lexical, owner.value, name2, typeof target === "function"), value2);
}
function as3CallInternalMember(target, lexical, type, name2, argumentsThunk) {
  internalDeclaration(lexical, type, name2);
  const args = argumentsThunk();
  const fn = as3GetInternalMember(target, lexical, type, name2);
  return as3CallValue(fn, () => args, target);
}
function access(value2) {
  return value2 && accesses.get(value2) || unsupported14("unknown lexical access");
}
function getAS3LexicalClassConstantInitializer(constructor, capability) {
  return constantInitializer(constructor, capability, "Class");
}
function getAS3LexicalObjectConstantInitializer(constructor, capability) {
  return constantInitializer(constructor, capability, "Object");
}
function getAS3LexicalStringConstantInitializer(constructor, capability) {
  return constantInitializer(constructor, capability, "String");
}
function canonicalConstantType(type) {
  return !!type && typeof type === "object" && type.vector === void 0 && typeof type.reference === "function" && isCanonicalAS3DeclarationConstructor(type.reference) && getAS3DeclarationType(type.reference)?.name === type.name;
}
function getAS3LexicalReferenceConstantInitializer(constructor, capability) {
  const type = access(capability).trait.type;
  if (!canonicalConstantType(type)) return unsupported14("canonical reference constant type required");
  return constantInitializer(constructor, capability, type);
}
function constantInitializer(constructor, capability, type) {
  const request = access(capability);
  if (request.trait.kind !== "constant" || request.trait.type !== type || request.trait.visibility !== "private" || !request.trait.static)
    return unsupported14("private static " + type + " constant required");
  const found = select(request, constructor);
  if (!found) return unsupported14("exact lexical constant generation required");
  const initialize = (value2) => {
    const own2 = Object.getOwnPropertyDescriptor(constructor, found.binding.key);
    if (!own2 || !("value" in own2) || own2.value !== null || own2.writable || own2.enumerable || !own2.configurable)
      return unsupported14("uninitialized compiler " + type + " constant storage required");
    const converted = coerceAS3PropertyValue(value2, type);
    Object.defineProperty(constructor, found.binding.key, { value: converted, writable: false, enumerable: false, configurable: false });
  };
  return initialize;
}
function select(request, target) {
  let chain;
  if (request.trait.static) {
    const generation = typeof target === "function" ? generations.get(target) : void 0;
    if (!generation || generation.scope !== request.owner) return void 0;
    const binding = generation.bindings.get(key2(request.trait.name, request.trait.visibility, true));
    return binding ? { generation, binding, target } : void 0;
  } else chain = entered2(target);
  if (!chain || !chain.some((generation) => generation.scope === (request.trait.visibility === "internal" ? request.owner : request.scope))) return void 0;
  const virtual = (request.trait.kind === "method" || request.trait.kind === "accessor") && (request.trait.visibility === "protected" || request.trait.visibility === "internal") && !request.super;
  const id = key2(request.trait.name, request.trait.visibility, request.trait.static);
  for (const generation of chain) {
    if (!virtual && generation.scope !== request.owner) continue;
    if (request.trait.visibility === "internal" && !samePackage(generation.scope, request.owner)) continue;
    const binding = generation.bindings.get(id);
    if (binding) return { generation, binding, target };
  }
  return void 0;
}
function as3GetLexicalMember(target, capability) {
  const request = access(capability);
  if (target == null) return as3GetProperty(target, request.trait.name);
  const found = select(request, target);
  if (!found) return error3(1069);
  const { binding } = found;
  if (binding.trait.kind === "method") return getBoundAS3Method(found.target, binding.key, binding.source, found.generation.scope.type.name + (binding.trait.static ? "$" : "") + "/" + binding.trait.name);
  if (binding.trait.kind === "accessor") return Reflect.apply(binding.get, found.target, []);
  const stored = Object.getOwnPropertyDescriptor(found.target, binding.key);
  if (!stored || !("value" in stored)) return unsupported14("lexical fields must be initialized before source access");
  return stored.value;
}
function as3SetLexicalMember(target, capability, value2) {
  const request = access(capability);
  if (target == null) {
    as3SetProperty(target, request.trait.name, value2);
    return value2;
  }
  const found = select(request, target);
  if (!found) return error3(1056);
  if (found.binding.trait.kind === "method" && found.binding.trait.visibility === "internal")
    throw createAS3PropertyError("ReferenceError", 1037);
  if (found.binding.trait.kind === "constant") throw createAS3PropertyError("ReferenceError", 1074);
  if (found.binding.trait.kind === "accessor") {
    if (!found.binding.trait.setter) throw createAS3PropertyError("ReferenceError", 1074);
    const converted2 = coerceAS3PropertyValue(value2, found.binding.trait.type);
    Reflect.apply(found.binding.set, found.target, [converted2]);
    return value2;
  }
  if (found.binding.trait.kind !== "variable") return unsupported14("source method assignment not admitted");
  if (!Object.getOwnPropertyDescriptor(found.target, found.binding.key)) return unsupported14("lexical fields must be initialized before source access");
  const converted = coerceAS3PropertyValue(value2, found.binding.trait.type);
  Object.defineProperty(found.target, found.binding.key, { value: converted });
  return value2;
}
function as3CallLexicalMember(target, capability, argumentsThunk) {
  const request = access(capability);
  if (request.trait.visibility === "internal" && request.trait.kind === "method") {
    const args = argumentsThunk();
    const fn2 = as3GetLexicalMember(target, capability);
    return as3CallValue(fn2, () => args, target);
  }
  const fn = as3GetLexicalMember(target, capability);
  return as3CallValue(fn, argumentsThunk, target);
}
function as3ConstructLexicalClass(target, capability, argumentsThunk, callerGlobal) {
  const request = access(capability);
  if (request.trait.kind !== "variable" || request.trait.type !== "Class" || request.super)
    return unsupported14("Class variable construction required");
  if (callerGlobal !== void 0 && !isAS3ScriptGlobal(callerGlobal))
    return unsupported14("authenticated caller script global required");
  const args = argumentsThunk();
  const constructor = as3GetLexicalMember(target, capability);
  return as3ConstructClass(constructor, args, callerGlobal);
}
function as3CallLexicalFunction(target, capability, argumentsThunk, callerGlobal) {
  const request = access(capability);
  if (request.trait.kind !== "variable" || request.trait.type !== "Function" || request.trait.static || request.super)
    return unsupported14("instance Function variable call required");
  if (callerGlobal !== void 0) {
    if (!isAS3ScriptGlobal(callerGlobal)) return unsupported14("authenticated caller script global required");
    const fn2 = as3GetLexicalMember(target, capability);
    return as3CallValue(fn2, argumentsThunk, callerGlobal);
  }
  const args = argumentsThunk();
  const fn = as3GetLexicalMember(target, capability);
  return as3CallValue(fn, () => args, target);
}
function dynamicAccess(current, name2, target) {
  if (typeof target === "function" && generations.get(target)?.scope === current) {
    for (const visibility of ["private", "protected"]) {
      const trait = current.traits.get(key2(name2, visibility, true));
      if (trait?.kind === "constant" || visibility === "protected" && trait?.kind === "variable" && trait.type === "String")
        return resolveAS3LexicalMember(current.value, name2, visibility, true);
    }
  }
  if (current.traits.has(key2(name2, "private", false))) return resolveAS3LexicalMember(current.value, name2, "private");
  for (let owner = current; owner; owner = owner.base)
    if (owner.traits.has(key2(name2, "protected", false))) return resolveAS3LexicalMember(current.value, name2, "protected");
  if (!internalPackages.has(current.type)) return void 0;
  const candidates = typeof target === "function" ? [generations.get(target)].filter((value2) => !!value2) : entered2(target);
  if (candidates) for (const generation of candidates) {
    if (samePackage(current, generation.scope) && generation.scope.traits.has(key2(name2, "internal", typeof target === "function")))
      return resolveAS3InternalMember(current.value, generation.scope.value, name2, typeof target === "function");
  }
  return void 0;
}
function as3GetLexicalProperty(lexical, target, property2) {
  const current = scope(lexical);
  if (property2 instanceof QName) return property2.uri === "" ? as3GetProperty(target, property2.localName, "public") : as3GetProperty(target, property2);
  const name2 = as3String(property2);
  if (typeof target === "string" || typeof target === "number" || typeof target === "boolean")
    return as3GetProperty(target, name2);
  const capability = dynamicAccess(current, name2, target);
  if (capability && select(access(capability), target) && !hasAS3PublicPropertyTrait(target, name2)) return as3GetLexicalMember(target, capability);
  if (as3HasProperty(name2, target)) return as3GetProperty(target, name2, "public");
  if (capability && !getAS3EnteredSourceConstructors(target)) unsupported14("dynamic lexical lookup requires entered source receiver");
  return capability ? as3GetLexicalMember(target, capability) : as3GetProperty(target, name2);
}
function as3SetLexicalProperty(lexical, target, property2, value2) {
  const current = scope(lexical);
  if (property2 instanceof QName) return property2.uri === "" ? as3SetProperty(target, property2.localName, value2, "public") : as3SetProperty(target, property2, value2);
  const name2 = as3String(property2);
  const capability = dynamicAccess(current, name2, target);
  if (capability && select(access(capability), target) && !hasAS3PublicPropertyTrait(target, name2)) return as3SetLexicalMember(target, capability, value2);
  if (as3HasProperty(name2, target)) return as3SetProperty(target, name2, value2);
  if (capability && !getAS3EnteredSourceConstructors(target)) unsupported14("dynamic lexical lookup requires entered source receiver");
  return capability ? as3SetLexicalMember(target, capability, value2) : as3SetProperty(target, name2, value2);
}
function as3AddAssignLexicalProperty(lexical, readTarget, property2, rhs, writeTarget) {
  const value2 = as3Add(as3GetLexicalProperty(lexical, readTarget, property2), rhs());
  return as3SetLexicalProperty(lexical, writeTarget(), property2, value2);
}
function as3DeleteLexicalProperty(lexical, target, property2) {
  const current = scope(lexical);
  if (property2 instanceof QName) return property2.uri === "" ? as3DeleteProperty(target, property2.localName, "public") : as3DeleteProperty(target, property2);
  const name2 = as3String(property2), capability = dynamicAccess(current, name2, target);
  if (capability && select(access(capability), target)) return false;
  if (capability && !getAS3EnteredSourceConstructors(target)) unsupported14("dynamic lexical lookup requires entered source receiver");
  return as3DeleteProperty(target, name2);
}
function as3CallLexicalProperty(lexical, target, property2, argumentsThunk) {
  const fn = as3GetLexicalProperty(lexical, target, property2);
  return as3CallValue(fn, argumentsThunk, target);
}

// ../engine/src/layaAir/flash/utils/NativeSourceClassLoadingSession.ts
var NativeSourceClassLoadingSession_exports = {};
__export(NativeSourceClassLoadingSession_exports, {
  createNativeSourceClassLoadingSession: () => createNativeSourceClassLoadingSession,
  createNativeSourceClassModule: () => createNativeSourceClassModule,
  isNativeSourceClassLoadingSession: () => isNativeSourceClassLoadingSession
});
var modules = /* @__PURE__ */ new WeakMap();
var moduleMovies = /* @__PURE__ */ new WeakMap();
function createNativeSourceClassModule(prepare, movie) {
  if (typeof prepare !== "function") throw new TypeError("Native source module requires trusted code preparation");
  const authoredMovie = movie === void 0 ? void 0 : snapshotAS3ScriptMovie(movie);
  const module2 = Object.freeze({});
  modules.set(module2, prepare);
  if (authoredMovie) moduleMovies.set(module2, authoredMovie);
  return module2;
}
var sessions = /* @__PURE__ */ new WeakSet();
function isNativeSourceClassLoadingSession(value2) {
  return !!value2 && typeof value2 === "object" && sessions.has(value2);
}
function invalid3(message) {
  throw new TypeError("NATIVE_SOURCE_CLASS_SESSION: " + message);
}
function data3(value2, key3) {
  const field = Object.getOwnPropertyDescriptor(value2, key3);
  if (!field || !("value" in field)) return invalid3("own data field required: " + key3);
  return field.value;
}
function bindings3(value2) {
  if (!Array.isArray(value2) || !value2.length) return invalid3("nonempty complete binding list required");
  const names = /* @__PURE__ */ new Set(), result = [];
  for (let index = 0; index < value2.length; index++) {
    const row = data3(value2, String(index));
    if (!row || typeof row !== "object" || Reflect.ownKeys(row).length !== 3) return invalid3("source binding record required");
    const name2 = data3(row, "name"), declaration2 = data3(row, "declaration"), resolve = data3(row, "resolve");
    if (typeof name2 !== "string" || !name2 || typeof resolve !== "function" || !isNativeSourceDeclaration(declaration2))
      return invalid3("genuine source declaration and resolver required");
    const normalized = normalizeDefinitionName(name2);
    if (names.has(normalized) || normalizeDefinitionName(declaration2.name) !== normalized) return invalid3("duplicate or mismatched source declaration");
    names.add(normalized);
    result.push(Object.freeze({ name: normalized, declaration: declaration2, resolve }));
  }
  return Object.freeze(result);
}
function createNativeSourceClassLoadingSession(options) {
  const resolve = options && data3(options, "resolve"), maximum = options && data3(options, "maxModules");
  if (typeof resolve !== "function" || !Number.isSafeInteger(maximum) || maximum < 1) return invalid3("resolver and positive module bound required");
  let active = true;
  const entries2 = /* @__PURE__ */ new Set(), domains2 = /* @__PURE__ */ new WeakMap(), tasks = /* @__PURE__ */ new Set();
  const preparing = /* @__PURE__ */ new Set();
  const requireLive = (entry) => {
    if (!active || entry.phase === "retired" || entry.abort.signal.aborted) return invalid3("module lifetime ended");
    if (entry.phase === "pending" && !entry.waiters.size) return invalid3("no pending requesters");
  };
  const settle = (entry, value2, reason) => {
    for (const waiter of [...entry.waiters]) {
      entry.waiters.delete(waiter);
      waiter.detach();
      if (value2) waiter.resolve(value2);
      else waiter.reject(reason);
    }
  };
  const retire = (entry, reason) => {
    if (entry.phase === "retired") return;
    entry.phase = "retired";
    entry.publication?.cancel();
    if (entry.cohort) unloadAS3ScriptDomain(entry.cohort);
    const map = domains2.get(getNativeApplicationDomainIdentity(entry.domain));
    if (map?.get(entry.module) === entry) map.delete(entry.module);
    entries2.delete(entry);
    settle(entry, void 0, reason);
    entry.abort.abort(reason);
  };
  const start = async (entry) => {
    try {
      requireLive(entry);
      let factory;
      preparing.add(entry);
      try {
        factory = await modules.get(entry.module)(entry.abort.signal);
      } finally {
        preparing.delete(entry);
      }
      requireLive(entry);
      if (typeof factory !== "function") return invalid3("prepared synchronous cohort factory required");
      const cohort = createAS3ScriptDomain(entry.domain, moduleMovies.get(entry.module));
      entry.cohort = cohort;
      const declared = bindings3(factory(cohort));
      requireLive(entry);
      const pending = [];
      for (const binding of declared) {
        const inherited = entry.domain.selectSourceDefinition(binding.name);
        if (inherited) {
          if (inherited.declaration !== binding.declaration) return invalid3("cohort did not reuse selected declaration: " + binding.name);
        } else pending.push(binding);
      }
      requireLive(entry);
      if (pending.length) entry.publication = entry.domain.publishOwnedSourceDefinitions(pending, () => requireLive(entry));
      requireLive(entry);
      const selected = new Map(declared.map((binding) => [binding.name, entry.domain.selectSourceDefinition(binding.name)]));
      const loaded = Object.freeze({
        applicationDomain: entry.domain,
        names: Object.freeze([...selected.keys()]),
        get active() {
          if (!active || entry.phase !== "published" || entry.publication && !entry.publication.active) return false;
          try {
            return [...selected].every(([name2, header]) => entry.domain.selectSourceDefinition(name2)?.declaration === header.declaration);
          } catch {
            return false;
          }
        },
        getDefinition(name2) {
          requireLive(entry);
          if (typeof name2 !== "string") return invalid3("definition name required");
          const selection = selected.get(normalizeDefinitionName(name2));
          if (!selection) return invalid3("definition is outside this module");
          return selection.resolve();
        }
      });
      entry.loaded = loaded;
      entry.phase = "published";
      settle(entry, loaded);
    } catch (reason) {
      retire(entry, reason);
    }
  };
  const session = Object.freeze({
    get active() {
      return active;
    },
    load(logicalURL, domain, signal) {
      let entry, waiter, settled = false;
      let yes, no;
      const result = new Promise((resolve2, reject) => {
        yes = resolve2;
        no = reject;
      });
      void result.catch(() => void 0);
      const cancel = () => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener("abort", cancel);
        if (waiter) entry.waiters.delete(waiter);
        no(signal?.reason);
        if (entry?.phase === "pending" && !entry.waiters.size) retire(entry, signal?.reason);
      };
      try {
        if (signal?.aborted) {
          cancel();
          return result;
        }
        if (!active) return invalid3("session retired");
        if (!isFlashApplicationDomain(domain) || isIsolatedNativeDefinitionScope(domain)) return invalid3("ordinary ApplicationDomain required");
        if (typeof logicalURL !== "string" || !logicalURL) return invalid3("logical URL required");
        const module2 = resolve(logicalURL);
        if (!module2 || !modules.has(module2)) return invalid3("trusted native module capability required");
        if (!active) return invalid3("session retired during selection");
        const key3 = getNativeApplicationDomainIdentity(domain);
        let map = domains2.get(key3);
        if (!map) domains2.set(key3, map = /* @__PURE__ */ new Map());
        entry = map.get(module2);
        if (!entry) {
          if (entries2.size + [...preparing].filter((item) => item.phase === "retired").length >= maximum) return invalid3("module bound exceeded");
          entry = { module: module2, domain: createNativeApplicationDomainView(domain), abort: new AbortController(), waiters: /* @__PURE__ */ new Set(), phase: "pending" };
          map.set(module2, entry);
          entries2.add(entry);
        }
        if (entry.phase === "published") {
          if (!entry.loaded.active) return invalid3("publication retired");
          settled = true;
          yes(entry.loaded);
          return result;
        }
        waiter = { resolve(value2) {
          settled = true;
          yes(value2);
        }, reject(reason) {
          settled = true;
          no(reason);
        }, detach() {
          signal?.removeEventListener("abort", cancel);
        } };
        entry.waiters.add(waiter);
        signal?.addEventListener("abort", cancel, { once: true });
        if (signal?.aborted) cancel();
        if (entry.waiters.size === 1 && entry.phase === "pending") {
          const owned = entry;
          const task = Promise.resolve().then(() => start(owned));
          tasks.add(task);
          void task.finally(() => tasks.delete(task));
        }
      } catch (reason) {
        settled = true;
        signal?.removeEventListener("abort", cancel);
        no(reason);
      }
      return result;
    },
    retire() {
      if (!active) return;
      active = false;
      for (const entry of [...entries2]) retire(entry, new Error("Native source session retired"));
    },
    async whenIdle() {
      await Promise.all([...tasks]);
    }
  });
  sessions.add(session);
  return session;
}

// ../engine/src/layaAir/flash/system/Capabilities.ts
var Capabilities_exports = {};
__export(Capabilities_exports, {
  Capabilities: () => Capabilities
});
var LAYA_VERSION = "LAYA 3,4,0,0";
function browserNavigator() {
  return typeof globalThis.navigator === "undefined" ? void 0 : globalThis.navigator;
}
function platformName() {
  const navigator = browserNavigator();
  const identity = `${navigator?.platform ?? ""} ${navigator?.userAgent ?? ""}`;
  if (/android/i.test(identity)) return "Android";
  if (/iphone|ipad|ipod/i.test(identity)) return "iOS";
  if (/windows|win32|win64/i.test(identity)) return "Windows";
  if (/macintosh|mac os|macintel/i.test(identity)) return "Mac OS";
  if (/linux/i.test(identity)) return "Linux";
  return navigator?.platform || "Unknown";
}
var Capabilities = class _Capabilities {
  constructor() {
  }
  static get isDebugger() {
    return false;
  }
  static get language() {
    return browserNavigator()?.language || "en";
  }
  static get languages() {
    const values5 = browserNavigator()?.languages;
    return Object.freeze(values5 && values5.length > 0 ? [...values5] : [_Capabilities.language]);
  }
  static get manufacturer() {
    return "LayaAir Web Runtime";
  }
  static get os() {
    return platformName();
  }
  static get playerType() {
    return "Browser";
  }
  static get version() {
    return LAYA_VERSION;
  }
};

// .cache/capabilities-static-diagnostic/factory.js
var __external = /* @__PURE__ */ new Map([["../../utils/nativeClass", nativeClass_exports], ["../../utils/callableClass", callableClass_exports], ["../../../engine/src/layaAir/flash/errors/AS3SourceError", AS3SourceError_exports], ["../../../engine/src/layaAir/flash/utils/AS3GeneratedClass", AS3GeneratedClass_exports], ["../../../engine/src/layaAir/flash/utils/AS3ScriptGlobal", AS3ScriptGlobal_exports], ["../../../engine/src/layaAir/flash/utils/AS3Class", AS3Class_exports], ["../../../engine/src/layaAir/flash/utils/AS3LexicalMembers", AS3LexicalMembers_exports], ["../../../engine/src/layaAir/flash/utils/AS3Property", AS3Property_exports], ["../../../engine/src/layaAir/flash/utils/AS3MethodBinding", AS3MethodBinding_exports], ["../../../engine/src/layaAir/flash/utils/AS3ArrayCreation", AS3ArrayCreation_exports], ["../../../engine/src/layaAir/flash/utils/NativeSourceClassLoadingSession", NativeSourceClassLoadingSession_exports], ["../../../engine/src/layaAir/flash/system/Capabilities", Capabilities_exports]]);
var __bodies = /* @__PURE__ */ new Map([
  ["./__native_declarations", function(exports2, require2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    const AS3GeneratedClass_1 = require2("../../../engine/src/layaAir/flash/utils/AS3GeneratedClass");
    const AS3ScriptGlobal_1 = require2("../../../engine/src/layaAir/flash/utils/AS3ScriptGlobal");
    const cohortDomain_1 = require2("./cohortDomain");
    var Capabilities_1 = require2("../../../engine/src/layaAir/flash/system/Capabilities");
    exports2.native0 = Capabilities_1.Capabilities;
    const __inherited_type0 = AS3ScriptGlobal_1.selectAS3ScriptDomainClass(cohortDomain_1.scriptDomain, "caps::Reader");
    const __authority_type0 = __inherited_type0 ? null : AS3GeneratedClass_1.declareAS3ReferenceType("caps::Reader");
    exports2.type0 = __inherited_type0 ? __inherited_type0.declaration : __authority_type0.type;
    exports2.publish0 = (constructor) => {
      if (!__authority_type0)
        throw new TypeError("Inherited Class cannot publish a child generation");
      return __authority_type0.publishGeneration(constructor);
    };
    exports2.lexical0 = /* @__PURE__ */ new WeakMap();
    exports2.publishScript0 = (factory) => __inherited_type0 ? __inherited_type0.resolve() : AS3ScriptGlobal_1.instantiateAS3ClassScriptUnit(cohortDomain_1.scriptDomain, { "sourceId": "caps.Reader", "sourceSha256": "fe541d932067405fbf57414eac98ce71366a6d1eb3286c7a3f598abfe5c7dd82", "bindings": [{ "name": "Reader", "uri": "caps", "kind": "constant", "type": "caps::Reader" }] }, (context2) => [{ name: "Reader", uri: "caps", value: factory(context2.global) }]).export("Reader", "caps");
    const AS3LexicalMembers_1 = require2("../../../engine/src/layaAir/flash/utils/AS3LexicalMembers");
    AS3LexicalMembers_1.bindAS3InternalPackage([exports2.type0]);
  }],
  ["./__native_class_0", function(exports2, require2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    const __as3_callable_provider = require2("../../../engine/src/layaAir/flash/utils/AS3GeneratedClass");
    const __as3_generated_lexicalProvider_0 = require2("../../../engine/src/layaAir/flash/utils/AS3LexicalMembers");
    const __as3_callable_generatedProperty = require2("../../../engine/src/layaAir/flash/utils/AS3Property");
    const __as3_callable_declarationDomain = require2("./__native_declarations");
    const callableClass_1 = require2("../../utils/callableClass");
    const AS3SourceError_1 = require2("../../../engine/src/layaAir/flash/errors/AS3SourceError");
    const __as3_callable_classValue = require2("../../../engine/src/layaAir/flash/utils/AS3Class");
    const AS3MethodBinding_1 = require2("../../../engine/src/layaAir/flash/utils/AS3MethodBinding");
    const nativeClass_1 = require2("../../utils/nativeClass");
    const AS3ArrayCreation_1 = require2("../../../engine/src/layaAir/flash/utils/AS3ArrayCreation");
    const Capabilities_1 = require2("../../../engine/src/layaAir/flash/system/Capabilities");
    exports2.Reader = nativeClass_1.declareNativeClass((__as3_classValue_2_finalize) => {
      return __as3_callable_declarationDomain.publishScript0((__as3_generated_scriptGlobal_2) => {
        let __as3_classValue_2;
        const Reader = function Reader2() {
          const __as3_callable_fresh = callableClass_1.callableClassIntrinsics.enter(this, __as3_callable_identity);
          let __as3_callable_succeeded = false;
          try {
            if (arguments.length < 0 || arguments.length > 0) {
              throw AS3SourceError_1.createAS3ArgumentCountError();
            }
            if (__as3_callable_fresh) {
              __as3_callable_generation.enterInstance(this);
              __as3_generated_lexicalProvider_0.initializeAS3LexicalInstance(__as3_generated_lexicalScope_1, this);
              AS3MethodBinding_1.bindAS3Method(this, "read");
              AS3MethodBinding_1.bindAS3Method(this, "identity");
            }
            __as3_callable_succeeded = true;
          } finally {
            callableClass_1.callableClassIntrinsics.leave(this, __as3_callable_identity, __as3_callable_succeeded);
          }
        };
        const __as3_callable_identity = callableClass_1.callableClassIntrinsics.constructorIdentity(Reader);
        callableClass_1.callableClassIntrinsics.defineProperty(Reader.prototype, "constructor", { value: Reader, writable: false, configurable: true });
        callableClass_1.callableClassIntrinsics.register(__as3_callable_identity, null);
        callableClass_1.callableClassIntrinsics.defineProperty(Reader.prototype, "read", { value: function() {
          if (arguments.length < 0 || arguments.length > 0)
            throw AS3SourceError_1.createAS3ArgumentCountError();
          return __as3_callable_generatedProperty.coerceAS3PropertyValue(AS3ArrayCreation_1.as3CreateArrayLiteral([__as3_generated_lexicalProvider_0.as3GetLexicalMember(__as3_classValue_2, __as3_generated_access_4), typeof Capabilities_1.Capabilities.os, typeof Capabilities_1.Capabilities.version, Capabilities_1.Capabilities["touchScreenType"] === void 0]), { name: "Array", reference: callableClass_1.callableClassIntrinsics.array });
        }, writable: true, configurable: true, enumerable: false });
        callableClass_1.callableClassIntrinsics.defineProperty(Reader.prototype, "identity", { value: function() {
          if (arguments.length < 0 || arguments.length > 0)
            throw AS3SourceError_1.createAS3ArgumentCountError();
          var c = null;
          var c = __as3_callable_classValue.as3CoerceClass(Capabilities_1.Capabilities);
          return __as3_callable_generatedProperty.coerceAS3PropertyValue(c === Capabilities_1.Capabilities, "Boolean");
        }, writable: true, configurable: true, enumerable: false });
        callableClass_1.callableClassIntrinsics.defineProperty(Reader, "prototype", { writable: false });
        const __as3_callable_generation = __as3_callable_provider.registerAS3GeneratedClass(__as3_callable_identity, { metadata: { "name": "caps::Reader", "base": "Object", "isDynamic": false, "isFinal": false, "instance": { "variables": [], "constants": [], "methods": [{ "name": "read", "declaredBy": "caps::Reader", "parameterCount": 0 }, { "name": "identity", "declaredBy": "caps::Reader", "parameterCount": 0 }], "accessors": [] }, "statics": { "variables": [], "constants": [], "methods": [], "accessors": [] } }, instanceTraits: [{ name: "read", kind: "method" }, { name: "identity", kind: "method" }], staticTraits: [], instanceConstants: [], instanceAccessors: [], instanceMethods: [{ name: "identity", parameters: [], returns: "Boolean", requiredCount: 0, override: false, final: false }], declaration: { type: __as3_callable_declarationDomain.type0, publishGeneration: __as3_callable_declarationDomain.publish0 } });
        const __as3_generated_lexicalScope_1 = __as3_generated_lexicalProvider_0.registerAS3LexicalMembers(__as3_callable_identity, null, [{ name: "isMac", visibility: "private", static: true, kind: "variable", type: "Boolean" }]);
        __as3_callable_declarationDomain.lexical0.set(__as3_callable_identity, __as3_generated_lexicalScope_1);
        const __as3_generated_access_4 = __as3_generated_lexicalProvider_0.resolveAS3LexicalMember(__as3_generated_lexicalScope_1, "isMac", "private", true);
        __as3_callable_classValue.registerAS3Constructor(__as3_callable_identity, { minimum: 0, maximum: 0, coerceArguments: (values5) => values5 });
        __as3_classValue_2 = __as3_classValue_2_finalize(Reader);
        __as3_generated_lexicalProvider_0.as3SetLexicalMember(__as3_classValue_2, __as3_generated_access_4, Capabilities_1.Capabilities.os.search("Mac OS") > -1);
        return Reader;
      });
    });
  }]
]);
function bindNativeSourceClasses(domain) {
  const cache = /* @__PURE__ */ new Map([["./cohortDomain", { "scriptDomain": domain }]]);
  let failed = false, failure3;
  function load(name2) {
    if (failed) throw failure3;
    if (__external.has(name2)) return __external.get(name2);
    if (cache.has(name2)) return cache.get(name2);
    if (!__bodies.has(name2)) throw new Error("Unbound native cohort module: " + name2);
    const exports2 = /* @__PURE__ */ Object.create(null);
    cache.set(name2, exports2);
    try {
      __bodies.get(name2)(exports2, load);
    } catch (error4) {
      failed = true;
      failure3 = error4;
      cache.clear();
      throw error4;
    }
    return exports2;
  }
  const headers = load("./__native_declarations");
  return [
    { name: "caps.Reader", declaration: headers["type0"], resolve: () => readNativeClass(load("./__native_class_0")["Reader"], "value") }
  ];
}
var nativeSourceClassModule = createNativeSourceClassModule(async () => bindNativeSourceClasses);

// .cache/capabilities-static-diagnostic/entry.ts
globalThis.completion = (async () => {
  const domain = new ApplicationDomain(ApplicationDomain.currentDomain), session = createNativeSourceClassLoadingSession({ resolve: () => nativeSourceClassModule, maxModules: 1 });
  await session.load("caps", domain);
  const instance = as3ConstructClass(domain.getDefinition("caps.Reader"));
  const rows = [];
  for (const method2 of ["read", "identity"]) {
    try {
      rows.push({ method: method2, value: as3CallValue(as3GetProperty(instance, method2), () => []) });
    } catch (error4) {
      rows.push({ method: method2, error: { name: error4.name, errorID: error4.errorID, message: error4.message } });
    }
  }
  session.retire();
  globalThis.result = rows;
})();
