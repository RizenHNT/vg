const { JSDOM } = require('jsdom');
const { readFileSync, readdirSync } = require('node:fs');
const assert = require('node:assert/strict');
const KEY = 'VG_COMBAT_STATE_V20_LOCAL';
const code = readFileSync('dist/assets/' + readdirSync('dist/assets').find(n => n.endsWith('.js')), 'utf8');
const wait = () => new Promise(r => setTimeout(r, 25));
async function boot(save) {
  const errors = [];
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://vg.test', runScripts: 'outside-only', pretendToBeVisual: true });
  dom.window.console.error = (...args) => errors.push(args.join(' '));
  dom.window.addEventListener('error', e => errors.push(e.message));
  if (save !== undefined) dom.window.localStorage.setItem(KEY, typeof save === 'string' ? save : JSON.stringify(save));
  dom.window.eval(code); await wait();
  const doc = dom.window.document;
  const state = () => JSON.parse(dom.window.localStorage.getItem(KEY));
  const click = async (text, scope = doc) => {
    const b = [...scope.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === text || b.textContent.trim() === text);
    assert.ok(b, 'button ' + text); assert.ok(!b.disabled, text + ' enabled'); b.click(); await wait();
  };
  const input = async (selector, value) => {
    const e = doc.querySelector(selector); assert.ok(e, selector);
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(e, String(value));
    e.dispatchEvent(new dom.window.Event('input', { bubbles: true })); await wait();
  };
  const close = () => { assert.equal(errors.length,0,errors.join('\n')); assert.ok(doc.querySelector('header')); assert.ok(!doc.querySelector('[role="dialog"]')); dom.window.close(); };
  return { dom, doc, click, state, input, close };
}
(async () => {
  // Exercise rules independently from UI labels.
  const m = await import('data:text/javascript;base64,' + Buffer.from(readFileSync('model.js','utf8')).toString('base64'));
  let s = m.togglePersona(m.initialState());
  assert.equal(m.unitPower(s,'front_center'),15000);
  s = m.patchUnit(s,'front_left',{basePower:10000,present:true});
  assert.equal(m.unitPower(s,'front_left'),20000,'Persona applies to later calls');
  s = {...s, units:{...s.units,back_left:s.units.front_left,front_left:m.emptyUnit()}};
  assert.equal(m.unitPower(s,'back_left'),10000,'Persona stops when leaving front');
  let f = m.applyTrigger(m.initialState(),'front');
  f = m.patchUnit(f,'front_left',{basePower:10000,present:true});
  assert.equal(m.unitPower(f,'front_left'),10000,'Front trigger excludes later calls');
  assert.equal(m.unitPower(f,'front_center'),15000);
  s = m.patchUnit(m.initialState(),'front_left',{basePower:10000,present:true});
  s = m.applyTrigger(s,'crit','front_left','front_center');
  assert.equal(m.unitPower(s,'front_left'),20000); assert.equal(s.units.front_center.crit,2); assert.equal(s.units.front_left.crit,1); assert.equal(s.resources.critTriggers,3);
  s = m.applyTrigger(m.patchUnit(m.initialState(),'front_center',{powerBuff:15000}),'ot','front_center');
  assert.equal(s.units.front_center.powerBuff,100015000);
  for(const [own,opp,healed] of [[3,3,2],[3,4,3],[4,3,3],[0,0,0],[3,null,3]]) {
    s = m.initialState();s={...s,opponentDamage:opp,resources:{...s.resources,damage:own}};
    assert.equal(m.applyTrigger(s,'heal','front_center').resources.damage,healed);
  }
  for(const [atk,shield,blocked,needed] of [[13000,0,false,5000],[18000,5000,false,5000],[18000,10000,true,0],[12000,0,true,0],[100000000,0,false,99990000]]) {
    s=m.patchUnit(m.initialState(),'front_center',{basePower:13000});s={...s,opponentAttack:String(atk),resources:{...s.resources,shield}};
    assert.equal(m.guardInfo(s).blocked,blocked);assert.equal(m.guardInfo(s).remaining,needed);
  }
  s=m.patchUnit(m.initialState(),'front_left',{basePower:10000});s=m.patchUnit(s,'back_left',{basePower:8000,isSupporting:true});
  assert.equal(m.columnInfo(s,'left').power,18000);
  let next=m.record(s,m.attack(s,'left'),'attack');
  assert.equal(next.units.back_left.isRested,true);assert.equal(s.units.back_left.isRested,false);
  assert.equal(m.undo(next).units.back_left.isRested,false);assert.equal(m.undo(next).attackCount,0);
  s=m.patchUnit(s,'back_left',{isBackRowAttack:true,isSupporting:false});assert.equal(m.columnInfo(s,'left').attacker,'back_left');assert.equal(m.columnInfo(s,'left').power,8000);
  // New direct controls work without opening any settings.
  let x=await boot();
  await x.click('V 先导者 +10k');assert.equal(x.state().units.front_center.powerBuff,10000);
  await x.click('Persona Ride');assert.equal(x.state().personaBonus,10000);
  await x.click('前左 召唤 10k');assert.ok(x.doc.querySelector('[data-testid="unit-front_left"]').textContent.includes('20,000'));
  await x.click('暴击判定');assert.equal(x.state().units.front_left.powerBuff,10000);assert.equal(x.state().units.front_left.crit,2);
  await x.click('撤回');assert.equal(x.state().units.front_left.crit,1);
  await x.click('V 先导者 攻击');assert.equal(x.state().units.front_center.isRested,true);
  await x.click('回合开始');assert.equal(x.state().personaBonus,0);assert.equal(x.state().units.front_center.isRested,false);assert.equal(x.state().energy,0);
  await x.click('Ride 升级');assert.equal(x.state().units.front_center.grade,1);assert.equal(x.state().resources.soul,1);
  await x.click('回合开始');assert.equal(x.state().units.front_center.grade,1);
  await x.click('单位设置');assert.ok(x.doc.querySelector('[data-testid="unit-details"]'));
  await x.click('更多设置');assert.ok(x.doc.querySelector('[data-testid="more-settings"]'));assert.equal(x.doc.body.style.overflow,'');
  x.close();
  // Split critical stays pending until both targets are chosen, then is one undoable action.
  x=await boot({units:{front_center:{basePower:13000,grade:3},front_left:{basePower:10000}}});
  await x.click('力量 / 暴击分配');await x.click('前左',x.doc.querySelector('.target-picker'));
  assert.equal(x.doc.querySelector('.unit-power').textContent,'10,000');
  await x.click('V 先导者',x.doc.querySelector('.target-picker'));
  assert.equal(x.state().units.front_left.powerBuff,10000);assert.equal(x.state().units.front_center.crit,2);
  await x.click('撤回');assert.equal(x.state().units.front_left.powerBuff,0);assert.equal(x.state().resources.critTriggers,4);x.close();
  // Unknown opponent damage requires a condition choice; confirmation is atomic and undoable.
  x=await boot({resources:{damage:4}});await x.click('治疗判定');assert.ok(x.doc.querySelector('.heal-confirm'));
  await x.click('回 1 伤');assert.equal(x.state().resources.damage,3);assert.equal(x.state().resources.healTriggers,3);assert.equal(x.state().units.front_center.powerBuff,10000);
  await x.click('撤回');assert.equal(x.state().resources.damage,4);assert.equal(x.state().resources.healTriggers,4);assert.equal(x.state().units.front_center.powerBuff,0);x.close();
  x=await boot({resources:{damage:3},opponentDamage:4});await x.click('治疗判定');assert.equal(x.state().resources.damage,3);assert.equal(x.state().units.front_center.powerBuff,10000);x.close();
  // Guard equality, PG accounting, and input edits survive reload.
  x=await boot({units:{front_center:{basePower:13000,grade:3}}});await x.click('防御');await x.input('.opponent-input input',18000);
  await x.click('+5k',x.doc.querySelector('.shield-buttons'));assert.ok(x.doc.querySelector('.guard-needed'));
  await x.click('+5k',x.doc.querySelector('.shield-buttons'));assert.ok(x.doc.querySelector('.guard-ok'));
  await x.click('完全防御 PG剩余 4');assert.equal(x.state().resources.shield,10000);assert.equal(x.state().resources.sentinelsRemaining,3);
  await x.click('取消 PG剩余 3');assert.equal(x.state().resources.sentinelsRemaining,4);
  const saved=x.state();x.close();x=await boot(saved);assert.ok(x.doc.querySelector('[data-testid="unit-front_center"]').textContent.includes('G3'));x.close();
  // Storage failure must not blank the app.
  x=await boot();x.dom.window.Storage.prototype.setItem=()=>{throw new Error('quota');};await x.click('V 先导者 +10k');assert.ok(x.doc.querySelector('[role="status"]').textContent.includes('保存失败'));assert.ok(x.doc.querySelector('[data-testid="unit-front_center"]').textContent.includes('15,000'));x.close();
  for(const save of ['{broken',null,{language:'unknown',units:{front_left:null,front_center:{basePower:'bad'}},resources:null,extraCounters:[null],history:[null]}]) {
    x=await boot(save);await x.click('回合开始');assert.equal(x.state().units.front_center.basePower,5000);x.close();
  }
  console.log('PASS: direct controls, no drawers, Persona aura, Front snapshot, split critical, 5 heal cases, OT addition, 5 guard boundaries, boost/back-row attack, immutable undo, PG, reload, storage failure and malformed saves.');
})().catch(error=>{console.error(error);process.exitCode=1;});
