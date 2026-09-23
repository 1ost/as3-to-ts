// Host observation only; all four AS3 subjects are emitted complete.
const nc=load('nativeClass'),read=name=>nc.readNativeClass(load(name)[name]);
const Consumer=read('Consumer'),Tracker=read('Tracker'),c=new Consumer(),rows=[];
rows.push({id:'initial',value:Tracker.events.concat()});
rows.push({id:'first-read',value:[c.boss(),Tracker.events.concat()]});
rows.push({id:'values',value:c.values().map(String)});
rows.push({id:'after-reads',value:Tracker.events.concat()});
const p=new (read('Products'))();
rows.push({id:'after-construction',value:Tracker.events.concat()});
rows.push({id:'after-construction-values',value:c.values().map(String)});
const GameConfig=read('GameConfig');
rows.push({id:'game-config-products',value:[GameConfig.BASTION_BOSS_TOTAL_TIME,GameConfig.BASTION_MONSTER_TOTAL_TIME,GameConfig.TALENT_MAX_COOLDOWN,GameConfig.LEAGUE_TECH_MAX_COOLDOWN]});
rows.push({id:'game-config-arrays',value:[GameConfig.chatExpressions.concat(),GameConfig.FORM_LEVEL_UNIT_NUM.concat(),GameConfig.CORPSWAR_FIELD_POINT.concat(),GameConfig.SPECIAL_STAR_EFFECTS.concat()]});
globalThis.result=rows;
