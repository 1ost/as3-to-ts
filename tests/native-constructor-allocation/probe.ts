import '@allocation/init';
import { Laya } from '@laya/engine/Laya';
import { Sprite, SpriteDeclaration, SpriteConstructorEntry } from '@laya/flash/utils/AS3GeneratedSpriteConstruction';
import { DisplayObjectContainer } from '@laya/flash/display/DisplayObjectContainer';
import { InteractiveObject } from '@laya/flash/display/InteractiveObject';
import { DisplayObject } from '@laya/flash/display/DisplayObject';
import { EventDispatcher } from '@laya/flash/events/EventDispatcher';
import { IEventDispatcher } from '@laya/flash/events/IEventDispatcher';
import { isFlashSprite } from '@laya/flash/display/Sprite';
import { as3Is, defineAS3Interface, registerAS3Class } from '@laya/flash/utils/AS3Type';
import { declareAS3ReferenceType } from '@laya/flash/utils/AS3DeclarationType';
import { registerFlashTypeMetadata } from '@laya/flash/utils/FlashTypeMetadata';
import { getQualifiedClassName } from '@laya/flash/utils/getQualifiedClassName';
import { callableClassIntrinsics as c } from '../../utils/callableClass';

// Handwritten constructor-protocol carriers. These are deliberately NOT claimed
// as emitted AS3: Sprite trait projection/admission is still held by the planner.
async function run() {
    await Laya.init(160, 100);
    const rows: any[] = [], checks: string[] = [], order: any[] = [];
    const row = (id: string, value: any) => rows.push({id, value});
    const check = (value: any, label: string) => { if (!value) throw Error(label); checks.push(label); };
    const reject = (fn: () => any, label: string) => {
        let error: any; try { fn(); } catch (caught) { error = caught; }
        check(error && error.errorID === 1006, label);
    };
    let allocations = 0, baseBodies = 0, childBodies = 0, fail = false, failed: any;
    const entry = Object.freeze({constructor:Sprite, prepareInstance:SpriteConstructorEntry.prepareInstance,
        initializeInstance:SpriteConstructorEntry.initializeInstance,
        allocateInstance: (ctor: Function) => { allocations++; return SpriteConstructorEntry.allocateInstance(ctor); }});
    function BaseModule(this: any): any {
        return c.invokeNativeConstructor(this, BaseModule, arguments, function(this: any) {
            const fresh = c.enter(this, BaseModule); let succeeded = false;
            try {
                if (fresh) { moduleGeneration.enterInstance(this); c.prepareNativeBase(this, Sprite); }
                baseBodies++;
                c.callNativeBase(this, BaseModule, Sprite, []);
                succeeded = true;
            } finally { c.leave(this, BaseModule, succeeded); }
        });
    }
    function Child(this: any): any {
        return c.invokeNativeConstructor(this, Child, arguments, function(this: any) {
            const fresh = c.enter(this, Child); let succeeded = false;
            try {
                if (fresh) { childGeneration.enterInstance(this); c.prepareNativeBase(this, Sprite); }
                childBodies++;
                order.push(['field', this.x, this.y, this.numChildren, this.buttonMode, this.useHandCursor]);
                this.field = 7; order.push(['before-super', this.field, this.x, this.numChildren]);
                if (fail) { failed = this; throw Error('source failure'); }
                c.expectBase(this, Child, BaseModule); c.apply(BaseModule, this, []);
                order.push(['after-super', this.field, this.x, this.numChildren]); this.x = 12; this.y = 9;
                succeeded = true;
            } finally { c.leave(this, Child, succeeded); }
        });
    }
    c.registerNativeBase(Sprite, entry);
    for (const pair of [[BaseModule, Sprite], [Child, BaseModule]]) {
        const ctor = pair[0], base = pair[1];
        Object.setPrototypeOf(ctor, base); ctor.prototype = Object.create(base.prototype);
        Object.defineProperty(ctor.prototype, 'constructor', {value:ctor}); c.register(ctor, base);
    }
    const moduleInterface = defineAS3Interface('cn.kyiax.base::IBaseModule');
    const moduleType = declareAS3ReferenceType('cn.kyiax.base.impl::BaseModule', SpriteDeclaration);
    const childType = declareAS3ReferenceType('spritecases::Child', moduleType.type);
    const publish = (ctor: Function, name: string, base: string) => {
        Object.defineProperty(ctor, 'prototype', {writable:false});
        registerAS3Class(ctor, [moduleInterface]);
        registerFlashTypeMetadata(ctor, {name, base, isDynamic:false, isFinal:false,
            instance:{variables:[], methods:[], accessors:[]}, statics:{variables:[], methods:[], accessors:[]}});
    };
    publish(BaseModule, 'cn.kyiax.base.impl::BaseModule', 'flash.display::Sprite');
    publish(Child, 'spritecases::Child', 'cn.kyiax.base.impl::BaseModule');
    const moduleGeneration = moduleType.publishGeneration(BaseModule), childGeneration = childType.publishGeneration(Child);
    const base = new (BaseModule as any)(), child = new (Child as any)();
    row('base-state', [base.x, base.y, base.numChildren, base.parent, base.stage, base.buttonMode, base.useHandCursor]);
    row('base-types', [moduleInterface, BaseModule, Sprite, DisplayObjectContainer, InteractiveObject,
        DisplayObject, EventDispatcher, IEventDispatcher].map(type => as3Is(base, type)));
    row('base-name', getQualifiedClassName(base)); row('order', order.slice());
    row('child-state', [child.field, child.x, child.y, child.numChildren, child.buttonMode, child.useHandCursor]);
    row('child-types', [moduleInterface, BaseModule, Sprite, Child].map(type => as3Is(child, type)));
    row('child-name', getQualifiedClassName(child));
    base.addChild(child); row('parent', [base.numChildren, child.parent === base, base.getChildAt(0) === child]);
    child.graphics.drawRect(0, 0, 20, 30); row('graphics', [child.width, child.height]);
    base.removeChild(child); row('remove', [base.numChildren, child.parent === null]);
    check(allocations === 2 && baseBodies === 2 && childBodies === 1, 'one allocation per outer construction');
    check(isFlashSprite(base) && isFlashSprite(child), 'real native brands');
    check(Object.getPrototypeOf(child) === Child.prototype, 'exact derived receiver');
    check(base.graphics !== child.graphics, 'separate native graphics');
    reject(() => c.apply(Child, child, []), 'completed construction cannot reenter');
    reject(() => c.apply(BaseModule, child, []), 'completed base cannot reenter');
    check(allocations === 2, 'reentry does not allocate');
    fail = true;
    let error: any; try { new (Child as any)(); } catch (caught) { error = caught; }
    check(error && error.message === 'source failure' && isFlashSprite(failed), 'source failure propagates on native receiver');
    reject(() => c.apply(Child, failed, []), 'failed receiver cannot retry');
    check(allocations === 3 && baseBodies === 2, 'failed body does not call source base');
    fail = false;
    check(isFlashSprite(new (Child as any)()) && allocations === 4 && baseBodies === 3, 'independent construction after failure');
    return {rows, checks};
}
run().then(result => Object.assign(window, {allocationResult:result}), error => Object.assign(window, {allocationResult:{error:String(error)}}));
