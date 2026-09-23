import { bound } from "undefinedbound";
import { classBound } from "undefinedclassBound";

@classBound
export class IntUintAssignmentLowering {

  public signed:number;
  public unsigned:number;
  public ordinary:number;

  @bound
public assign(data:any):any[] {
    var localSigned:number;
    var localUnsigned:number = (Number(data.initial) >>> 0);
    this.signed = (Number(data.signed) | 0);
    this.unsigned = (Number(data.unsigned) >>> 0);
    localSigned = (Number(data.localSigned) | 0);
    localUnsigned = (Number(data.localUnsigned) >>> 0);
    return [this.signed, this.unsigned, localSigned, localUnsigned];
  }

  @bound
public assignParameter(value:number, data:any):number {
    return value = (Number(data.value) | 0);
  }

  @bound
public assignAndReturn(data:any):number {
    return this.signed = (Number(data.value) | 0);
  }

  @bound
public compound(data:any):any[] {
    this.signed = (Number(data.startSigned) | 0);
    this.unsigned = (Number(data.startUnsigned) >>> 0);
    return [this.signed = (Number(this.signed + (data.addSigned)) | 0), this.unsigned = (Number(this.unsigned + (data.addUnsigned)) >>> 0), this.signed, this.unsigned];
  }

  @bound
public leaveUnprovenAssignmentsAlone(data:any):void {
    this.ordinary = data.value;
    data.signed = data.raw;
  }
}
