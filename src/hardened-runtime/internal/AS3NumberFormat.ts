/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
/**
 * Adapted from Adobe AVMplus core/d2a.cpp, MathUtils.cpp and BigInteger.cpp (MPL-2.0).
 * https://github.com/adobe/avmplus
 * Uses BigInt for the original integer ratio and preserves AVM's legacy fixed
 * precision stopping margins and tiny-fraction rounding. This is not JS toFixed.
 */

/** Preserve AVM's integer-power multiplication order, including its roundoff. */
function powerOfTen(exponent:number):number {
    if (exponent >= 0 && exponent < 23) return Number(`1e${exponent}`);
    let result=1, base=10;
    while (exponent > 0) {
        if (exponent % 2 === 1) result*=base;
        exponent=Math.floor(exponent/2);
        base*=base;
    }
    return result;
}

/** AVM doubleValueOf inspects the rounding word and at most one following word. */
function integerToDouble(integer:bigint):number {
    const length=integer.toString(2).length;
    if (length <= 53) return Number(integer);
    const dropped=length-53, shift=BigInt(dropped);
    let mantissa=integer>>shift;
    const halfBit=1n<<(shift-1n);
    // Preserve the native finite residual window: lower words are not inspected.
    const bottom=Math.max(0,(Math.floor(dropped/32)-1)*32);
    const residualMask=(halfBit-1n)&~((1n<<BigInt(bottom))-1n);
    if ((integer&halfBit) !== 0n && ((mantissa&1n) !== 0n || (integer&residualMask) !== 0n)) mantissa++;
    return Number(mantissa)*2**dropped;
}

/** Magnitude stage after the existing native lexical scanner accepts a decimal. */
export function as3DecimalMagnitude(coefficient:string, exponent:number):number {
    const unsigned=coefficient.replace(/^[+-]/, "");
    const point=unsigned.indexOf(".");
    const digits=unsigned.replace(".", "");
    if (point >= 0) exponent-=unsigned.length-point-1;
    let result:number;
    if (digits.length > 15) {
        let integer=BigInt(digits);
        if (exponent > 0) {
            const scale=powerOfTen(exponent);
            if (!Number.isFinite(scale)) return NaN;
            integer*=BigInt(scale);
            exponent=0;
        }
        result=integerToDouble(integer);
    } else result=Number(digits);
    if (exponent >= 0) result*=powerOfTen(exponent);
    else {
        if (exponent < -307) {
            const difference=exponent+307;
            result/=powerOfTen(-difference);
            exponent-=difference;
        }
        result/=powerOfTen(-exponent);
    }
    return coefficient[0] === "-" ? -result : result;
}

interface DigitGenerator { exponent:number; readonly finished:boolean; next():number; }

function fixedDigits(value:number, precision:number):DigitGenerator {
    const view=new DataView(new ArrayBuffer(8));
    view.setFloat64(0,value);
    const bits=view.getBigUint64(0);
    const storedExponent=Number((bits>>52n)&2047n);
    let mantissa=bits&((1n<<52n)-1n), exponent:number;
    if (storedExponent) {
        mantissa+=1n<<52n;
        exponent=storedExponent-1023-52;
    } else {
        exponent=-1074;
        while (mantissa < (1n<<52n)) { mantissa<<=1n; exponent--; }
    }
    // The native macOS frexp path always normalizes nonzero mantissas to 53 bits,
    // so its floating-point fast estimate is ineligible. Zero is handled outside.
    const boundary=mantissa === (1n<<52n);
    let numerator:bigint, denominator:bigint, upper:bigint, lower:bigint;
    if (exponent >= 0) {
        const unit=1n<<BigInt(exponent);
        numerator=mantissa*unit*(boundary ? 4n : 2n);
        denominator=boundary ? 4n : 2n;
        upper=unit*(boundary ? 2n : 1n); lower=unit;
    } else {
        numerator=mantissa*(boundary ? 4n : 2n);
        denominator=1n<<BigInt((boundary ? 2 : 1)-exponent);
        upper=boundary ? 2n : 1n; lower=1n;
    }
    const fixed=10n**BigInt(precision);
    numerator*=fixed; denominator*=fixed;
    const estimate=Math.ceil((exponent+52)*0.30102999566398119521373889472449-1e-10);
    const scale=10n**BigInt(Math.abs(estimate));
    if (estimate >= 0) denominator*=scale;
    else { numerator*=scale; upper*=scale; lower*=scale; }
    let decimalExponent:number;
    if (numerator+upper >= denominator) decimalExponent=estimate+1;
    else { numerator*=10n; upper*=10n; lower*=10n; decimalExponent=estimate; }
    let finished=false;
    return {exponent:decimalExponent, get finished(){return finished;}, next(){
        if (finished) return -1;
        let digit=Number(numerator/denominator);
        numerator%=denominator;
        const low=numerator <= lower, high=numerator+upper >= denominator;
        if (digit < 0 || digit > 9) digit=0;
        if (!low && !high) { numerator*=10n; upper*=10n; lower*=10n; }
        else { finished=true; if (!low || high && numerator*2n >= denominator) digit++; }
        return digit;
    }};
}

/** Receiver and precision coercion are owned by AS3Coerce. */
export function as3FixedDecimal(value:number, precision:number):string {
    if (precision < 0 || precision > 20) {
        const error=new RangeError("Error #1002: Number.toPrecision has a range of 1 to 21. Number.toFixed and Number.toExponential have a range of 0 to 20. Specified value is not within expected range.");
        Object.defineProperty(error,"errorID",{value:1002}); throw error;
    }
    if (!Number.isFinite(value)) return String(value);
    if (value === 0) return "0"+(precision ? "."+"0".repeat(precision) : "");
    const negative=value < 0;
    const digits=fixedDigits(Math.abs(value),precision);
    let exponent=digits.exponent-1, output="0", round=true;
    if (exponent >= 0) {
        const first=digits.next(); if (first > 0) output+=first;
        while (exponent > 0) { output+=digits.finished ? 0 : digits.next(); exponent--; }
        if (precision) {
            output+=".";
            for (let i=0;i<precision;i++) output+=digits.finished ? 0 : digits.next();
        }
    } else {
        output+="0.";
        while (exponent < -1 && precision > 0) { exponent++; precision--; output+="0"; }
        if (precision === 0 && exponent !== 0) round=false;
        for (let i=0;i<precision;i++) output+=digits.finished ? 0 : digits.next();
    }
    if (round && digits.next() > 4) {
        const characters=output.split("");
        for (let i=characters.length-1;i>=0;i--) {
            if (characters[i] === ".") continue;
            if (characters[i] !== "9") { characters[i]=String(Number(characters[i])+1); break; }
            characters[i]="0";
        }
        output=characters.join("");
    }
    if (output[0] === "0" && output[1] !== ".") output=output.slice(1);
    if (output.endsWith(".")) output=output.slice(0,-1);
    return (negative ? "-" : "")+output;
}
