package {
public class IntUintAssignmentLowering {

  public var signed:int;
  public var unsigned:uint;
  public var ordinary:Number;

  public function assign(data:Object):Array {
    var localSigned:int;
    var localUnsigned:uint = data.initial;
    this.signed = data.signed;
    unsigned = data.unsigned;
    localSigned = data.localSigned;
    localUnsigned = data.localUnsigned;
    return [signed, unsigned, localSigned, localUnsigned];
  }

  public function assignParameter(value:int, data:Object):int {
    return value = data.value;
  }

  public function assignAndReturn(data:Object):int {
    return this.signed = data.value;
  }

  public function compound(data:Object):Array {
    signed = data.startSigned;
    unsigned = data.startUnsigned;
    return [signed += data.addSigned, unsigned += data.addUnsigned, signed, unsigned];
  }

  public function leaveUnprovenAssignmentsAlone(data:Object):void {
    ordinary = data.value;
    data.signed = data.raw;
  }
}}
