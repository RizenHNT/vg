const { JSDOM } = require('jsdom');
const { readFileSync, readdirSync } = require('node:fs');
const assert = require('node:assert/strict');
const KEY = 'VG_OFFICIAL_PREVIEW_V1';
const entry = readFileSync('dist/index.html', 'utf8').match(/src="\/([^"]+\.js)"/)[1];
const code = readFileSync('dist/' + entry, 'utf8');
const wait = () => new Promise(r => setTimeout(r, 30));
async function boot(save) {
  const errors = [];
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://vg.test', runScripts: 'outside-only', pretendToBeVisual: true });
  dom.window.console.error = (...args) => errors.push(args.join(' '));
  if (save !== undefined) dom.window.localStorage.setItem(KEY, typeof save === 'string' ? save : JSON.stringify(save));
  dom.window.eval(code); await wait();
  const doc = dom.window.document;
  const state = () => JSON.parse(dom.window.localStorage.getItem(KEY));
  const click = async (text, scope = doc) => {
    const button = [...scope.querySelectorAll('button')].find(b => b.textContent.trim() === text);
    assert.ok(button, 'button ' + text); assert.ok(!button.disabled, text + ' enabled'); button.click(); await wait();
  };
  return { dom, doc, click, state, errors };
}
(async () => {
  let x = await boot();
  await x.click('Ride 升级'); assert.equal(x.state().units.front_center.grade, 1);
  await x.click('回合开始'); assert.equal(x.state().units.front_center.grade, 1); assert.equal(x.state().energy, 0);
  x.doc.querySelector('[aria-label="选择先导者"]').click(); await wait();
  assert.ok(!x.doc.querySelector('.unit-editor')); assert.equal(x.doc.body.style.overflow, '');
  x.doc.querySelector('[aria-label="先导者 编辑 G"]').click(); await wait();
  let drawer = x.doc.querySelector('.unit-editor'); assert.ok(drawer); assert.equal(x.doc.body.style.overflow, '');
  await x.click('+10k', drawer); await x.click('OT (100,000,000)', drawer);
  assert.equal(x.state().units.front_center.powerBuff, 100010000);
  await x.click('OT (100,000,000)', drawer); assert.equal(x.state().units.front_center.powerBuff, 10000);
  x.doc.dispatchEvent(new x.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait();
  assert.ok(!x.doc.querySelector('.unit-editor')); assert.equal(x.doc.body.style.overflow, '');
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
  await x.click('攻击 (后排攻击)'); assert.equal(x.state().units.back_left.isRested, true); assert.equal(x.state().units.front_left.isRested, false);
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
    x = await boot(save); assert.ok(x.doc.querySelector('header')); await x.click('回合开始'); assert.equal(x.state().units.front_center.basePower, 5000); x.dom.window.close();
  }
  // All six units stay directly selectable without menus or focus changes.
  x = await boot();
  for (const button of x.doc.querySelectorAll('.unit-select')) { button.click(); await wait(); assert.ok(!x.doc.querySelector('.unit-editor')); assert.equal(x.doc.body.style.overflow, ''); }
  assert.equal(x.doc.querySelectorAll('.energy-panel button[aria-label^="能量 "]').length, 11);
  await x.click('10k 呼叫',x.doc.querySelector('[data-testid="unit-front_left"]'));
  await x.click('8k 呼叫',x.doc.querySelector('[data-testid="unit-back_left"]'));
  const quick = x.doc.querySelector('[data-testid="unit-front_left"] .unit-quick button');
  for(let i=0;i<20;i++) quick.click(); await wait();
  assert.equal(x.state().units.front_left.powerBuff,100000,'rapid clicks use latest state');
  await x.click('撤回'); assert.equal(x.state().units.front_left.powerBuff,95000);
  x.doc.querySelector('.persona-button').click(); await wait();
  assert.equal(x.state().personaBonus,10000);
  assert.equal(x.state().units.front_right.powerBuff,0,'Persona does not create units');
  await x.click('10k 呼叫',x.doc.querySelector('[data-testid="unit-front_right"]'));
  assert.equal(x.doc.querySelector('[data-testid="unit-front_right"] .unit-power').textContent,'20,000','later front calls receive Persona');
  x.doc.querySelector('.trigger-front').click(); await wait();
  assert.equal(x.state().units.front_right.powerBuff,10000); assert.equal(x.state().units.back_left.powerBuff,0);
  assert.equal(x.state().resources.frontTriggers,2);
  x.doc.querySelector('[aria-label="选择先导者"]').click(); await wait();
  x.doc.querySelector('.trigger-crit').click(); await wait();
  assert.equal(x.state().units.front_center.crit,2); assert.equal(x.state().resources.critTriggers,3);
  await x.click('撤回'); assert.equal(x.state().units.front_center.crit,1); assert.equal(x.state().resources.critTriggers,4);
  const damageBefore=x.state().resources.damage;
  x.doc.querySelector('.trigger-heal').click(); await wait();
  assert.equal(x.state().resources.healTriggers,4,'heal prompt makes no premature state change');
  await x.click('不满足，仅加力量'); assert.equal(x.state().resources.damage,damageBefore); assert.equal(x.state().resources.healTriggers,3);
  await x.click('回合开始'); assert.equal(x.state().personaBonus,0);
  assert.equal(x.errors.length,0,x.errors.join('\n'));x.dom.window.close();
  console.log('PASS: ride/turn separation, OT additive toggle, inline editor, direct six-slot controls, rapid clicks, trigger undo, Persona timing, heal confirmation, undo snapshot, PG toggle, 4 guard boundaries, 3 legacy-save recoveries.');
})().catch(error => { console.error(error); process.exitCode = 1; });
