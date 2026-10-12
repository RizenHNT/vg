const { JSDOM } = require('jsdom');
const { readFileSync, readdirSync } = require('node:fs');
const assert = require('node:assert/strict');
const KEY = 'VG_DRAWER_PREVIEW_V1';
const builtHTML = readFileSync('dist/index.html', 'utf8');
const entry = builtHTML.match(/src="\/([^"]+\.js)"/)[1];
const stylesheet = readFileSync('dist/'+builtHTML.match(/href="\/([^"]+\.css)"/)[1], 'utf8');
const code = readFileSync('dist/' + entry, 'utf8');
const wait = () => new Promise(r => setTimeout(r, 30));
async function boot(save, expandTop = false) {
  const errors = [];
  const dom = new JSDOM('<style>'+stylesheet+'</style><div id="root"></div>', { url: 'https://vg.test', runScripts: 'outside-only', pretendToBeVisual: true });
  dom.window.console.error = (...args) => errors.push(args.join(' '));
  if (save !== undefined) dom.window.localStorage.setItem(KEY, typeof save === 'string' ? save : JSON.stringify(save));
  dom.window.eval(code); await wait();
  const doc = dom.window.document;
  const state = () => JSON.parse(dom.window.localStorage.getItem(KEY));
  const click = async (text, scope = doc) => {
    let button = [...scope.querySelectorAll('button')].find(b => b.textContent.trim() === text);
    if (!button && scope === doc) {
      doc.querySelector(text.startsWith('PG') ? '[data-testid="guard-toggle"]' : '[data-testid="turn-toggle"]').click(); await wait();
      button = [...scope.querySelectorAll('button')].find(b => b.textContent.trim() === text);
    }
    const active = doc.querySelector('[role="dialog"]');
    if (button && active && !active.contains(button) && button.closest('main')) {
      doc.dispatchEvent(new dom.window.KeyboardEvent('keydown', {key:'Escape',bubbles:true})); await wait();
    }
    assert.ok(button, 'button ' + text); assert.ok(!button.disabled, text + ' enabled'); button.click(); await wait();
  };
  if(expandTop) {doc.querySelector('[data-testid="turn-toggle"]').click();await wait();}
  return { dom, doc, click, state, errors };
}
(async () => {
  let x = await boot();
  await x.click('Ride 升级'); assert.equal(x.state().units.front_center.grade, 1);
  await x.click('回合开始'); assert.equal(x.state().units.front_center.grade, 1); assert.equal(x.state().energy, 0);
  x.doc.querySelector('[data-testid="unit-front_center"]').click(); await wait();
  let drawer = x.doc.querySelector('[role="dialog"]'); assert.ok(drawer); assert.equal(x.doc.body.style.overflow, 'hidden');
  await x.click('+10k', drawer); await x.click('OT (100,000,000)', drawer);
  assert.equal(x.state().units.front_center.powerBuff, 100010000);
  await x.click('OT (100,000,000)', drawer); assert.equal(x.state().units.front_center.powerBuff, 10000);
  x.doc.dispatchEvent(new x.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait();
  assert.ok(!x.doc.querySelector('[role="dialog"]')); assert.equal(x.doc.body.style.overflow, '');
  await x.click('攻击 (V)'); assert.equal(x.state().attackCount, 1);
  await x.click('前列 +10k'); const before = x.state().attackHistory[0].units.front_center.powerBuff;
  assert.equal(before, 10000, 'history snapshot is immutable');
  await x.click('撤回'); assert.equal(x.state().units.front_center.powerBuff, 10000); assert.equal(x.state().attackCount, 0);
  await x.click('PG (4)'); assert.equal(x.state().resources.shield, 0); assert.equal(x.state().resources.sentinelActive, true);
  await x.click('PG 取消'); assert.equal(x.state().resources.sentinelsRemaining, 4);
  assert.equal(x.errors.length, 0, x.errors.join('\n')); x.dom.window.close();
  // Grade remains independent of power and survives a reload; back-row preview uses the attacker.
  x = await boot({ units: { front_center: { basePower: 13000, grade: 2 }, front_left: { basePower: 10000 }, back_left: { basePower: 8000, isBackRowAttack: true } } });
  assert.ok(x.doc.querySelector('[data-testid="unit-front_center"]').textContent.includes('G2'));
  await x.click('后排攻击'); assert.equal(x.state().units.back_left.isRested, true); assert.equal(x.state().units.front_left.isRested, false);
  await x.click('撤回'); assert.equal(x.state().units.back_left.isRested, false);
  await x.click('回合开始'); const saved = x.state(); x.dom.window.close();
  x = await boot(saved); assert.ok(x.doc.querySelector('[data-testid="unit-front_center"]').textContent.includes('G2')); x.dom.window.close();
  // Storage failure must leave the current game interactive and expose an explicit status.
  x = await boot();
  x.dom.window.Storage.prototype.setItem = () => { throw new Error('quota'); };
  await x.click('Ride 升级'); assert.ok(x.doc.querySelector('[role="status"]')); assert.ok(x.doc.querySelector('header')); x.dom.window.close();
  // Equality requires one additional 5k shield increment, including an exact 5k gap.
  for (const [attack, shield, blocked] of [[13000,0,false],[18000,5000,false],[18000,10000,true],[12000,0,true]]) {
    x = await boot({ units: { front_center: { basePower: 13000, grade: 3 } }, resources: { shield } });
    x.doc.querySelector('[data-testid="guard-toggle"]').click(); await wait();
    const input = x.doc.querySelector('input[placeholder="对手ATK"]');
    Object.getOwnPropertyDescriptor(x.dom.window.HTMLInputElement.prototype, 'value').set.call(input, String(attack));
    input.dispatchEvent(new x.dom.window.Event('input', { bubbles: true })); await wait();
    assert.equal(x.doc.body.textContent.includes('防御成功!'), blocked, `${attack} vs 13000 + ${shield}`);
    assert.equal(x.errors.length, 0); x.dom.window.close();
  }
  // Returning from v3 preserves visible totals exactly once.
  x = await boot({ version: 3, personaBonus: 10000, units: { front_center: { basePower: 13000, powerBuff: 5000, grade: 3, present: true }, front_left: { basePower: 0, powerBuff: 0, present: false } } });
  assert.ok(x.doc.querySelector('[data-testid="unit-front_center"]').textContent.includes('28,000'));
  await x.click('+1'); const migrated = x.state(); assert.equal(migrated.version, 2); assert.equal(migrated.units.front_left.powerBuff, 0); x.dom.window.close();
  x = await boot(migrated); assert.ok(x.doc.querySelector('[data-testid="unit-front_center"]').textContent.includes('28,000')); x.dom.window.close();
  // Old / malformed saved fields must not unmount the app.
  for (const save of ['{broken', null, { language: 'unknown', units: { front_left: null, front_center: { basePower: 'bad' } }, resources: null, extraCounters: [null], attackHistory: [null] }]) {
    x = await boot(save); assert.ok(x.doc.querySelector('header')); await x.click('回合开始'); assert.equal(x.state().units.front_center.basePower, 6000); x.dom.window.close();
  }
  // Side menus stay outside the board and share one modal at a time.
  x = await boot(undefined, false);
  assert.ok(!x.doc.querySelector('#top-controls')); assert.ok(!x.doc.querySelector('.guard-panel'));
  assert.equal(x.dom.window.getComputedStyle(x.doc.querySelector('.edge-left')).position, 'fixed');
  x.doc.querySelector('[data-testid="turn-toggle"]').click(); await wait();
  assert.ok(x.doc.querySelector('.turn-panel')); assert.equal(x.doc.body.style.overflow, 'hidden');
  assert.ok([...x.doc.querySelectorAll('#top-controls button')].find(b => b.textContent.trim() === 'Ride 升级').classList.contains('text-blue-300'));
  x.doc.querySelector('[data-testid="guard-toggle"]').click(); await wait();
  assert.ok(!x.doc.querySelector('.turn-panel')); assert.ok(x.doc.querySelector('.guard-panel'));
  x.doc.querySelector('.side-menu-backdrop').click(); await wait(); assert.equal(x.doc.body.style.overflow, '');
  assert.ok(!x.doc.querySelector('main input[placeholder="对手ATK"]')); assert.ok(!x.doc.querySelector('main .free-counters'));
  assert.equal(x.doc.querySelectorAll('[data-testid^="unit-"]').length, 6); x.dom.window.close();
  // Current values are atomic; visible digits roll in the requested direction.
  x = await boot({ units: { front_center: { basePower:13000, powerBuff:5000, grade:3 } } }, false);
  x.doc.querySelector('[data-testid="unit-front_center"]').click(); await wait();
  const power = () => Number(x.doc.querySelector('[data-testid="drawer-power"]').dataset.value);
  assert.equal(power(), 18000);
  assert.equal(x.dom.window.getComputedStyle(x.doc.querySelector('.drawer-heading')).position, 'sticky');
  assert.ok(x.doc.querySelector('.drawer-toolbar select#unit-grade'));
  assert.ok(x.doc.querySelector('.drawer-heading .drawer-critical'));
  await x.click('+5k', x.doc.querySelector('.unit-drawer')); assert.equal(power(),23000); assert.ok(x.doc.querySelector('.drawer-live-power .roll-up'));
  await x.click('-10k', x.doc.querySelector('.unit-drawer')); assert.equal(power(),13000); assert.ok(x.doc.querySelector('.drawer-live-power .roll-down'));
  assert.ok(!x.doc.querySelector('[data-testid="power-delta"]'));
  const rapid = [...x.doc.querySelectorAll('.unit-drawer button')].find(b => b.textContent.trim() === '+5k');
  for(let i=0;i<20;i++)rapid.click(); await wait(); assert.equal(power(),113000);
  x.doc.querySelector('[aria-label="增加暴击"]').click(); x.doc.querySelector('[aria-label="增加暴击"]').click(); await wait();
  assert.equal(Number(x.doc.querySelector('[data-testid="critical-value"]').dataset.value),3);
  const grade=x.doc.querySelector('#unit-grade');grade.value='4';grade.dispatchEvent(new x.dom.window.Event('change',{bubbles:true}));await wait();
  assert.equal(x.state().units.front_center.basePower,28000);assert.equal(x.state().units.front_center.powerBuff,100000);
  grade.value='0';grade.dispatchEvent(new x.dom.window.Event('change',{bubbles:true}));await wait();assert.equal(x.state().units.front_center.basePower,6000);
  x.doc.querySelector('[data-testid="unit-close"]').click();await wait();
  x.doc.querySelector('[data-testid="unit-front_left"]').click();await wait();
  assert.equal(Number(x.doc.querySelector('[data-testid="drawer-power"]').dataset.value),0);assert.ok(!x.doc.querySelector('.drawer-live-power [data-rolling]'));
  assert.equal(x.errors.length,0,x.errors.join('\n'));x.dom.window.close();
  // Rear guards do not inherit Vanguard power shortcuts.
  x=await boot({units:{front_left:{basePower:10000,grade:2}}});
  x.doc.querySelector('[data-testid="unit-front_left"]').click();await wait();
  x.doc.querySelector('#unit-grade').value='0';x.doc.querySelector('#unit-grade').dispatchEvent(new x.dom.window.Event('change',{bubbles:true}));await wait();
  assert.equal(x.state().units.front_left.grade,0);assert.equal(x.state().units.front_left.basePower,10000);x.dom.window.close();
  // Front and rear attacks remain independently selectable in either order.
  x=await boot({units:{front_left:{basePower:10000},back_left:{basePower:8000,isBackRowAttack:true},front_right:{basePower:12000},back_right:{basePower:6000,isSupporting:true}}});
  assert.equal(x.doc.querySelectorAll('.attack-between').length,3);
  assert.equal(Number(x.doc.querySelector('[data-testid="total-back_left"]').dataset.value),8000);
  assert.ok(x.doc.querySelector('[data-testid="attack-back_right"]').disabled);
  x.doc.querySelector('[data-testid="attack-front_left"]').click();await wait();assert.equal(x.state().units.front_left.isRested,true);assert.equal(x.state().units.back_left.isRested,false);
  x.doc.querySelector('[data-testid="attack-back_left"]').click();await wait();assert.equal(x.state().units.back_left.isRested,true);assert.equal(x.state().attackCount,2);
  assert.equal(x.doc.querySelectorAll('.attack-between').length,3,'buttons do not jump after the first attack');
  x.doc.querySelector('[data-testid="attack-front_left"]').click();await wait();assert.equal(x.state().attackCount,2,'rested front never falls back to rear');
  await x.click('撤回');assert.equal(x.state().units.back_left.isRested,false);assert.equal(x.state().units.front_left.isRested,true);
  assert.equal(x.errors.length,0,x.errors.join('\n'));x.dom.window.close();
  x=await boot({units:{front_left:{basePower:10000},back_left:{basePower:8000,isSupporting:true}}});
  assert.equal(x.doc.querySelectorAll('.attack-between').length,0);assert.equal(Number(x.doc.querySelector('[data-testid="total-front_left"]').dataset.value),18000);
  x.doc.querySelector('[data-testid="attack-front_left"]').click();await wait();assert.equal(x.state().units.front_left.isRested,true);assert.equal(x.state().units.back_left.isRested,true);x.dom.window.close();
  // OT power, glow and drawer state are independent for every unit.
  x=await boot({units:{front_center:{basePower:13000,powerBuff:5000,grade:3},front_left:{basePower:10000}}});
  const openUnit=async id=>{x.doc.querySelector('[data-testid="unit-'+id+'"]').click();await wait();};
  const closeUnit=async()=>{x.doc.querySelector('[data-testid="unit-close"]').click();await wait();};
  await openUnit('front_center');x.doc.querySelector('[data-testid="unit-ot"]').click();await wait();assert.ok(x.doc.querySelector('[data-testid="unit-ot"]').classList.contains('ot-active'));
  await closeUnit();await openUnit('front_left');assert.ok(x.doc.querySelector('[data-testid="unit-ot"]').classList.contains('ot-inactive'));assert.equal(x.doc.querySelector('[data-testid="unit-ot"]').getAttribute('aria-pressed'),'false');
  assert.ok(x.doc.querySelector('[data-testid="unit-front_center"]').classList.contains('rainbow-glow'));assert.ok(!x.doc.querySelector('[data-testid="unit-front_left"]').classList.contains('rainbow-glow'));
  x.doc.querySelector('[data-testid="unit-ot"]').click();await wait();await closeUnit();await openUnit('front_center');
  x.doc.querySelector('[data-testid="unit-ot"]').click();await wait();assert.equal(x.state().units.front_center.powerBuff,5000);assert.equal(x.state().units.front_left.otActive,true);
  const ot=x.doc.querySelector('[data-testid="unit-ot"]');ot.click();ot.click();await wait();assert.equal(x.state().units.front_center.powerBuff,5000,'rapid toggle preserves non-OT buff');
  assert.equal(x.errors.length,0,x.errors.join('\n'));x.dom.window.close();
  // Free counters preserve edited legacy resources once, and rapid taps use current state.
  x=await boot({resources:{soul:7,critTriggers:2},extraCounters:[{name:'Custom',value:3}]});
  x.doc.querySelector('[data-testid="settings-toggle"]').click();await wait();assert.equal(x.doc.querySelectorAll('.free-counter').length,3);
  const plus=x.doc.querySelector('.free-counter [aria-label="增加"]');for(let i=0;i<20;i++)plus.click();await wait();assert.equal(x.state().extraCounters[0].value,23);
  const names=x.state().extraCounters.map(c=>c.name);assert.ok(names.includes('魂'));assert.ok(names.includes('暴击触发'));
  const resaved=x.state();x.dom.window.close();x=await boot(resaved);await x.click('+1');assert.equal(x.state().extraCounters.length,3);x.dom.window.close();
  // Random tools settle on the selected face; language-specific labels stay meaningful.
  for(const [language,roll,flip,heads] of [['zh','掷骰子','抛硬币','正面'],['en','Roll die','Flip coin','Heads'],['ja','サイコロを振る','コイントス','表']]){
    x=await boot({language});x.doc.querySelector('[data-testid="settings-toggle"]').click();await wait();
    let draws=0;x.dom.window.Math.random=()=>{draws++;return 0;};
    const rollButton=[...x.doc.querySelectorAll('button')].find(b=>b.textContent.trim()===roll);
    for(let i=0;i<10;i++)rollButton.click();await wait();assert.equal(draws,1);
    assert.ok(x.doc.querySelector('.die-cube.is-rolling'));assert.equal(x.doc.querySelectorAll('.die-face').length,6);
    await x.click(flip);assert.ok(x.doc.querySelector('.coin-disc.is-rolling'));await new Promise(r=>setTimeout(r,770));
    assert.equal(x.doc.querySelector('[data-testid="dice-result"]').textContent,'1');assert.equal(x.doc.querySelector('[data-testid="coin-result"]').textContent,heads);
    assert.ok(!x.doc.querySelector('.chance-scene .is-rolling'));assert.equal(x.errors.length,0,x.errors.join('\n'));
    x.doc.dispatchEvent(new x.dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await wait();assert.equal(x.doc.body.style.overflow,'');x.dom.window.close();
  }
  const {existsSync}=require('node:fs');
  for(const kind of ['critical','boost','intercept','double-drive','triple-drive']){
    const file='public/symbols/'+kind+'.jpg';assert.ok(existsSync(file),file);const bytes=readFileSync(file);assert.ok(bytes.length>100);assert.equal(bytes[0],255);assert.equal(bytes[1],216);
  }
  console.log('PASS: side menus, compact live drawer, digit reels, grade shortcuts, explicit front/rear attacks, per-unit OT visuals, persistent free counters, 3D random tools in three languages, official icon assets and original combat regressions.');
})().catch(error => { console.error(error); process.exitCode = 1; });
