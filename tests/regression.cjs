const { JSDOM } = require('jsdom');
const { readFileSync, readdirSync } = require('node:fs');
const assert = require('node:assert/strict');
const KEY = 'VG_COMBAT_STATE_V20_LOCAL';
const code = readFileSync('dist/assets/' + readdirSync('dist/assets').find(n => n.endsWith('.js')), 'utf8');
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
  // Equality requires one additional 5k shield increment, including an exact 5k gap.
  for (const [attack, shield, blocked] of [[13000,0,false],[18000,5000,false],[18000,10000,true],[12000,0,true]]) {
    x = await boot({ units: { front_center: { basePower: 13000, grade: 3 } }, resources: { shield } });
    const input = x.doc.querySelector('input[placeholder="对手ATK"]');
    Object.getOwnPropertyDescriptor(x.dom.window.HTMLInputElement.prototype, 'value').set.call(input, String(attack));
    input.dispatchEvent(new x.dom.window.Event('input', { bubbles: true })); await wait();
    assert.equal(x.doc.body.textContent.includes('防御成功!'), blocked, `${attack} vs 13000 + ${shield}`);
    assert.equal(x.errors.length, 0); x.dom.window.close();
  }
  // Old / malformed saved fields must not unmount the app.
  for (const save of ['{broken', null, { language: 'unknown', units: { front_left: null, front_center: { basePower: 'bad' } }, resources: null, extraCounters: [null], attackHistory: [null] }]) {
    x = await boot(save); assert.ok(x.doc.querySelector('header')); await x.click('回合开始'); assert.equal(x.state().units.front_center.basePower, 5000); x.dom.window.close();
  }
  console.log('PASS: ride/turn separation, OT additive toggle, drawer close, undo snapshot, PG toggle, 4 guard boundaries, 3 legacy-save recoveries.');
})().catch(error => { console.error(error); process.exitCode = 1; });
