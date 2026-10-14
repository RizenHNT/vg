const { JSDOM } = require('jsdom');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const KEY = 'VG_COMBAT_STATE_V20_LOCAL';
const html = fs.readFileSync('dist/index.html', 'utf8');
const code = fs.readFileSync('dist/' + html.match(/src="\/([^"]+\.js)"/)[1], 'utf8');
const css = fs.readFileSync('dist/' + html.match(/href="\/([^"]+\.css)"/)[1], 'utf8');
const wait = (ms = 24) => new Promise(resolve => setTimeout(resolve, ms));
async function boot(save, measuredFit = false) {
    const errors = [];
    const dom = new JSDOM('<style>' + css + '</style><div id="root"></div>', { url: 'https://vg.test', runScripts: 'outside-only', pretendToBeVisual: true });
    if (measuredFit) {
        Object.defineProperty(dom.window.HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return this.classList.contains('power-fit') ? 80 : 0; } });
        const original = dom.window.HTMLElement.prototype.getBoundingClientRect;
        dom.window.HTMLElement.prototype.getBoundingClientRect = function() { if (this.classList.contains('power-value')) return { width: parseFloat(this.style.fontSize) * 3.75 }; return original.call(this); };
    }
    dom.window.console.error = (...args) => errors.push(args.join(' '));
    dom.window.console.log = () => {};
    if (save !== undefined) dom.window.localStorage.setItem(KEY, typeof save === 'string' ? save : JSON.stringify(save));
    dom.window.eval(code);
    for (let i = 0; i < 40 && !dom.window.document.querySelector('[data-slot]') && !dom.window.document.body.textContent.includes('页面遇到了错误'); i++) await wait(10);
    const d = dom.window.document;
    const state = () => JSON.parse(dom.window.localStorage.getItem(KEY));
    const test = name => d.querySelector('[data-testid="' + name + '"]');
    const click = async name => { const element = test(name); assert.ok(element, name); assert.ok(!element.disabled, name + ' enabled'); element.click(); await wait(); };
    const text = async (value, scope = d) => { const b = [...scope.querySelectorAll('button')].find(b => b.textContent.trim() === value); assert.ok(b, value); assert.ok(!b.disabled); b.click(); await wait(); };
    const input = async (element, value) => { assert.ok(element); Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(element, String(value)); element.dispatchEvent(new dom.window.Event('input', { bubbles: true })); await wait(); };
    const escape = async () => { d.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(); };
    const guard = async () => { if (!test('guard-circle')) await click('guard-toggle'); await click('guard-circle'); };
    const drag = async (source, target, cancelled = false) => {
        const node = test('unit-' + source); d.elementFromPoint = () => target;
        node.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 10 }));
        await wait(390);
        assert.ok(d.querySelector('.drag-unit-preview'), 'long press starts drag');
        d.dispatchEvent(new dom.window.MouseEvent('pointermove', { bubbles: true, cancelable: true, clientX: 90, clientY: 100 })); await wait();
        d.dispatchEvent(new dom.window.MouseEvent(cancelled ? 'pointercancel' : 'pointerup', { bubbles: true, clientX: 90, clientY: 100 })); await wait();
        assert.ok(!d.querySelector('.drag-unit-preview'));
        await wait(370);
    };
    const done = () => { assert.equal(errors.length, 0, errors.join('\n')); dom.window.close(); };
    return { dom, d, state, test, click, text, input, escape, guard, drag, done, errors };
}
(async () => {
    // Board, typography and non-modal menu structure: no badges collide with grade.
    let x = await boot();
    assert.equal(x.d.querySelectorAll('[data-slot]').length, 6);
    assert.equal(x.d.querySelectorAll('.edge-handle').length, 2);
    assert.ok(x.d.querySelector('.edge-right'));
    assert.ok(!x.d.querySelector('.guard-circle'));
    await x.click('turn-toggle');
    assert.equal(x.d.body.style.overflow, '', 'round menu does not lock the board');
    assert.equal(x.d.querySelectorAll('.turn-actions button').length, 7);
    assert.equal(x.dom.window.getComputedStyle(x.d.querySelector('.turn-panel')).position, 'fixed');
    assert.ok(!x.d.querySelector('main').contains(x.d.querySelector('.turn-panel')), 'left rail stays outside the field');
    assert.equal(x.dom.window.getComputedStyle(x.d.querySelector('.turn-actions')).flexDirection, 'column');
    assert.ok(x.d.querySelector('.vg-app').classList.contains('turn-open'));
    assert.deepEqual([...x.d.querySelectorAll('.turn-actions button')].map(b => b.textContent.trim()), ['回合开始','Ride 升级','前列 +10k','回合结束','自由支援','后列截击','撤销攻击']);
    for (const number of x.d.querySelectorAll('.power-fit, .power-value')) assert.equal(x.dom.window.getComputedStyle(number).fontStyle, 'normal');
    assert.ok(x.test('ride-action').classList.contains('text-blue-300'));
    await x.click('ride-action'); assert.equal(x.state().units.front_center.grade, 1); assert.equal(x.state().units.front_center.basePower, 8000);
    await x.text('回合开始'); assert.equal(x.state().units.front_center.grade, 1); assert.equal(x.state().energy, 0);
    await x.click('turn-toggle'); x.done();

    // Width fitting accounts for the actual cell padding, including nine-digit OT totals.
    x = await boot({units:{front_center:{grade:3,basePower:13000,powerBuff:100000000,otActive:true}}}, true);
    const numeral=x.test('unit-front_center').querySelector('.power-value');
    assert.ok(numeral.getBoundingClientRect().width <= 68, 'fitted numeral ' + JSON.stringify({font:numeral.style.fontSize,width:numeral.getBoundingClientRect().width,paddingLeft:x.dom.window.getComputedStyle(numeral.parentElement).paddingLeft,paddingRight:x.dom.window.getComputedStyle(numeral.parentElement).paddingRight}));
    x.done();

    // Main grade click opens quick choices and custom input, never a unit drawer.
    x = await boot({ units: { front_center: { grade: 3, basePower: 13000, powerBuff: 10000 }, front_left: { grade: 2, basePower: 11000 } } });
    x.test('grade-front_center').focus(); await x.click('grade-front_center');
    assert.ok(x.test('grade-picker')); assert.ok(!x.d.querySelector('.unit-drawer'));
    assert.equal(x.test('grade-front_center').textContent, '3');
    assert.equal(x.d.querySelector('.grade-options button[data-grade="4"]').textContent, '428,000');
    x.d.querySelector('[data-grade="4"]').click(); await wait();
    assert.equal(x.state().units.front_center.grade, 4); assert.equal(x.state().units.front_center.basePower, 28000); assert.equal(x.state().units.front_center.powerBuff, 10000);
    assert.equal(x.d.activeElement, x.test('grade-front_center'));
    await x.click('grade-front_left'); await x.input(x.d.querySelector('.grade-custom input'), 7);
    x.d.querySelector('.grade-custom').dispatchEvent(new x.dom.window.Event('submit', { bubbles: true, cancelable: true })); await wait();
    assert.equal(x.state().units.front_left.grade, 7); assert.equal(x.state().units.front_left.basePower, 11000, 'rear printed power is independent of grade');
    assert.equal(x.test('grade-front_left').textContent, '7');
    assert.ok(!x.test('unit-front_left').textContent.includes('G7'));
    await x.click('grade-front_left'); await x.escape(); assert.ok(!x.test('grade-picker')); x.done();

    // Compact drawer keeps base before modifier; manual entry expands only at the live summary.
    x = await boot({ units: { front_center: { grade: 3, basePower: 13000, powerBuff: 5000 } } });
    await x.click('unit-front_center');
    assert.equal(x.d.body.style.overflow, 'hidden');
    assert.ok(!x.d.querySelector('.inline-power-editor'));
    assert.equal(x.d.querySelectorAll('.unit-drawer input').length, 0);
    assert.equal(x.test('base-section').compareDocumentPosition(x.test('buff-section')) & 4, 4);
    assert.equal(x.dom.window.getComputedStyle(x.d.querySelector('.drawer-heading')).position, 'sticky');
    assert.equal(Number(x.test('drawer-power').dataset.value), 18000);
    x.test('drawer-grade').focus(); await x.click('drawer-grade'); await x.escape();
    assert.ok(x.d.querySelector('.unit-drawer')); assert.ok(!x.test('grade-picker')); assert.equal(x.d.activeElement, x.test('drawer-grade'));
    await x.text('+5k', x.d.querySelector('.unit-drawer'));
    assert.equal(Number(x.test('drawer-power').dataset.value), 23000);
    const reel = x.d.querySelector('.drawer-live-power .digit-track');
    assert.ok(reel); assert.ok(reel.children.length >= 21); assert.ok(reel.textContent.includes('1234567890'), 'reel traverses all decimal digits twice');
    await x.text('-10k', x.d.querySelector('.unit-drawer'));
    assert.equal(Number(x.test('drawer-power').dataset.value), 13000); assert.ok(x.d.querySelector('.drawer-live-power .roll-down'));
    const plus = [...x.d.querySelectorAll('.unit-drawer button')].find(b => b.textContent.trim() === '+5k');
    for(let i=0;i<20;i++) plus.click(); await wait(); assert.equal(Number(x.test('drawer-power').dataset.value), 113000);
    await x.click('edit-base'); await x.input(x.d.querySelector('#power-edit'), 9000);
    x.d.querySelector('.inline-power-editor').dispatchEvent(new x.dom.window.Event('submit', { bubbles: true, cancelable: true })); await wait();
    assert.equal(x.state().units.front_center.basePower, 9000); assert.ok(!x.d.querySelector('.inline-power-editor'));
    await x.click('edit-buff'); await x.input(x.d.querySelector('#power-edit'), -1000);
    x.d.querySelector('.inline-power-editor').dispatchEvent(new x.dom.window.Event('submit', { bubbles: true, cancelable: true })); await wait();
    assert.equal(x.state().units.front_center.powerBuff, -1000); assert.equal(Number(x.test('drawer-power').dataset.value), 8000);
    const critical = x.d.querySelector('[aria-label="增加暴击"]'); critical.click(); critical.click(); await wait(); assert.equal(Number(x.test('critical-value').dataset.value), 3);
    assert.ok(x.d.querySelector('.drawer-critical .official-symbol svg') === null);
    assert.ok(x.d.querySelector('.drawer-critical svg image').getAttribute('href').endsWith('vg-tech-atlas.png'));
    await x.click('unit-close'); await x.click('unit-front_left'); assert.equal(Number(x.test('drawer-power').dataset.value), 0);
    assert.ok(!x.d.querySelector('.drawer-live-power [data-rolling]')); await x.escape(); assert.equal(x.d.body.style.overflow, ''); x.done();

    // Attack and shield share controls but never overwrite one another or legacy printed shields.
    x = await boot({ units:{front_left:{grade:2,basePower:10000,powerBuff:5000,shield:12000,shieldBuff:3000,otActive:true},front_right:{grade:1,basePower:8000,shield:10000}} });
    assert.equal(x.test('shield-front_left').textContent,'15,000');
    assert.ok(!x.test('shield-front_right'), 'G1 shield stays off until Intercept is enabled');
    x.test('shield-front_left').focus(); await x.click('shield-front_left'); assert.ok(x.test('shield-picker')); assert.ok(!x.d.querySelector('.unit-drawer'));
    x.d.querySelector('[data-shield="20000"]').click(); await wait();
    assert.equal(x.state().units.front_left.shield,20000); assert.equal(x.state().units.front_left.shieldBuff,3000);
    assert.ok(x.d.activeElement===x.test('shield-front_left'),'closing shield choices restores focus to its trigger');
    await x.click('unit-front_left');
    assert.equal(Number(x.test('drawer-shield').dataset.value),23000); assert.equal(Number(x.test('drawer-power').dataset.value),15000);
    await x.click('edit-mode-shield'); assert.equal(x.test('edit-mode-shield').getAttribute('aria-pressed'),'true');
    assert.ok(x.test('unit-ot').disabled, 'shield controls never apply 100 million OT');
    await x.text('15k',x.test('base-section')); await x.text('+5k',x.test('buff-section'));
    assert.equal(x.state().units.front_left.shield,15000); assert.equal(x.state().units.front_left.shieldBuff,8000);
    assert.equal(x.state().units.front_left.powerBuff,5000); assert.equal(x.state().units.front_left.otActive,true);
    await x.click('edit-buff'); await x.input(x.d.querySelector('#power-edit'),-20000);
    x.d.querySelector('.inline-power-editor').dispatchEvent(new x.dom.window.Event('submit',{bubbles:true,cancelable:true})); await wait();
    assert.equal(x.state().units.front_left.shieldBuff,-20000); assert.equal(Number(x.test('drawer-shield').dataset.value),0,'total shield clamps at zero without discarding modifier');
    await x.click('edit-mode-power'); await x.text('+5k',x.test('buff-section'));
    assert.equal(x.state().units.front_left.powerBuff,10000); assert.equal(x.state().units.front_left.shieldBuff,-20000);
    const splitSave=x.state(); x.done(); x=await boot(splitSave); await x.click('unit-front_left');
    assert.equal(Number(x.test('drawer-shield').dataset.value),0); assert.equal(Number(x.test('drawer-power').dataset.value),20000);
    await x.click('unit-close'); await x.click('unit-front_right'); await x.click('ability-intercept'); await x.click('unit-close');
    assert.ok(x.test('shield-front_right'),'manual Intercept reveals G1 shield'); x.done();

    // Grade shortcuts initialize shield; G2 alone enables Intercept automatically.
    x=await boot({units:{front_left:{basePower:5000,grade:0}}});
    for(const [grade,shield] of [[0,5000],[1,5000],[2,5000],[3,0]]) {
        await x.click('grade-front_left'); x.d.querySelector(`[data-grade="${grade}"]`).click(); await wait();
        assert.equal(x.state().units.front_left.shield,shield); assert.equal(x.state().units.front_left.hasIntercept,grade===2);
        assert.equal(!!x.test('shield-front_left'),grade===2);
    }
    await x.click('unit-front_left'); await x.click('ability-intercept'); await x.click('edit-mode-shield');
    await x.text('10k',x.test('base-section')); await x.text('+5k',x.test('buff-section')); await x.click('unit-close');
    await x.click('guard-toggle'); await x.drag('front_left',x.test('guard-circle'));
    assert.equal(Number(x.test('guard-circle').dataset.value),15000,'Intercept uses base plus shield modifier');
    await x.click('turn-toggle'); await x.text('回合开始');
    assert.equal(x.state().units.front_left.shield,10000); assert.equal(x.state().units.front_left.shieldBuff,0,'turn resets temporary shield only'); x.done();

    // OT belongs to each unit and preserves unrelated modifiers on rapid toggles.
    x = await boot({ units: { front_center: { basePower:13000,powerBuff:5000,grade:3 }, front_left: { basePower:10000,grade:2 } } });
    await x.click('unit-front_center'); await x.click('unit-ot'); assert.equal(x.state().units.front_center.powerBuff, 100005000);
    await x.click('unit-close'); await x.click('unit-front_left'); assert.equal(x.test('unit-ot').getAttribute('aria-pressed'), 'false');
    assert.ok(x.test('unit-front_center').classList.contains('rainbow-glow')); assert.ok(!x.test('unit-front_left').classList.contains('rainbow-glow'));
    await x.click('unit-ot'); await x.click('unit-close'); await x.click('unit-front_center');
    await x.click('unit-ot'); assert.equal(x.state().units.front_center.powerBuff, 5000);
    const ot = x.test('unit-ot'); ot.click(); ot.click(); await wait(); assert.equal(x.state().units.front_center.powerBuff, 5000); assert.equal(x.state().units.front_left.otActive, true); x.done();

    // Boost is an ability independent of active support; enabling free boost allows another row.
    x = await boot({ units: { front_left: { grade:1,basePower:8000 }, front_right:{grade:2,basePower:10000}, back_right:{grade:1,basePower:8000,isSupporting:true} } });
    await x.click('unit-front_left'); await x.click('ability-boost'); assert.equal(x.state().units.front_left.hasBoost, false);
    await x.click('ability-boost'); assert.equal(x.state().units.front_left.hasBoost, true);
    await x.click('unit-close'); assert.ok(!x.test('boost-front_left'));
    await x.click('turn-toggle'); await x.click('free-support'); assert.ok(x.test('boost-front_left'));
    await x.click('boost-front_left'); assert.deepEqual(x.state().supportSlots, ['front_left']);
    await x.click('unit-back_right'); assert.deepEqual(x.state().supportSlots, ['front_left','back_right']);
    await x.click('attack-front_right'); assert.equal(x.state().units.front_left.isRested, true); assert.equal(x.state().units.back_right.isRested, true);
    x.done();

    // Free boost includes front rearguards without Boost, persists choices and rests only selected units.
    x = await boot({units:{front_center:{grade:3,basePower:13000},front_left:{grade:2,basePower:10000},front_right:{grade:3,basePower:13000},back_left:{grade:1,basePower:6000,isSupporting:true},back_center:{grade:1,basePower:8000,isSupporting:true},back_right:{grade:1,basePower:8000,isRested:true}}});
    for(const slot of x.d.querySelectorAll('[data-slot]'))assert.ok(!slot.dataset.selection,'normal field has no selection frame');
    await x.click('turn-toggle');await x.click('free-support');assert.deepEqual(x.state().supportSlots,[]);
    assert.equal(x.test('unit-front_left').dataset.supportTarget,'true');assert.equal(x.test('unit-front_right').dataset.supportTarget,'true');assert.ok(!x.test('unit-front_center').dataset.supportTarget);assert.ok(!x.test('unit-back_right').dataset.supportTarget);
    assert.equal(x.state().units.front_left.hasBoost,false);assert.equal(x.state().units.front_right.hasBoost,false);
    assert.equal(Number(x.test('total-front_center').dataset.value),13000,'no implicit boosters on entering selection');
    await x.click('unit-front_left');await x.click('unit-front_right');await x.click('unit-back_left');await x.click('unit-back_left');
    assert.deepEqual(x.state().supportSlots,['front_left','front_right']);assert.equal(x.test('unit-front_left').dataset.supportSelected,'true');assert.ok(!x.d.querySelector('.unit-drawer'));
    assert.equal(Number(x.test('total-front_center').dataset.value),36000);assert.equal(Number(x.test('total-front_left').dataset.value),23000,'attacker never boosts itself');assert.equal(x.state().units.front_left.isRested,false);
    const choosing=x.state();x.done();x=await boot(choosing);assert.equal(x.test('unit-front_left').dataset.supportSelected,'true');assert.equal(x.test('unit-front_right').dataset.supportSelected,'true');
    await x.click('attack-front_center');assert.equal(x.state().units.front_left.isRested,true);assert.equal(x.state().units.front_right.isRested,true);assert.equal(x.state().units.back_left.isRested,false);assert.equal(x.state().units.back_center.isRested,false);
    for(const slot of ['front_left','front_center','front_right']) {
        assert.equal(Number(x.dom.window.getComputedStyle(x.test('unit-'+slot).querySelector('.unit-power')).opacity),.38,'rested power dims');
        assert.equal(Number(x.dom.window.getComputedStyle(x.test('total-'+slot)).opacity),.38,'rested column total dims');
    }
    assert.equal(x.state().isMultiSupportMode,false);assert.deepEqual(x.state().supportSlots,[]);
    for(const slot of x.d.querySelectorAll('[data-slot]'))assert.ok(!slot.dataset.selection,'frames disappear after resolving');
    await x.click('turn-toggle');await x.click('attack-undo');assert.equal(x.state().units.front_left.isRested,false);assert.equal(x.state().units.front_center.isRested,false);
    assert.equal(x.state().isMultiSupportMode,true);assert.deepEqual(x.state().supportSlots,['front_left','front_right']);
    assert.notEqual(Number(x.dom.window.getComputedStyle(x.test('unit-front_left').querySelector('.unit-power')).opacity),.38,'undo restores normal brightness');
    await x.click('support-cancel');assert.equal(x.state().units.back_left.isSupporting,true);assert.equal(x.state().isMultiSupportMode,false);
    await x.click('free-support');await x.click('unit-back_left');await x.escape();assert.equal(x.state().units.back_left.isRested,false);assert.equal(x.state().isMultiSupportMode,false);
    for(const b of x.d.querySelectorAll('.column-attack')){assert.equal(b.textContent.trim(),'攻击');assert.ok(!b.querySelector('.power-fit'));}
    x.done();

    x=await boot({isMultiSupportMode:true,supportSlots:['front_left','front_right','front_center','missing'],guardSlots:['front_right'],units:{front_left:{grade:2,basePower:10000,isRested:true},front_right:{grade:3,basePower:13000},front_center:{grade:3,basePower:13000}}});
    assert.equal(x.d.querySelectorAll('[data-support-selected=true]').length,0,'rested, reserved, vanguard and invalid choices are rejected on reload');
    assert.equal(Number(x.test('total-front_center').dataset.value),13000,'discarded reload choices add no power');
    await x.click('unit-front_left');await x.click('unit-front_right');await x.click('unit-front_center');await x.click('unit-back_center');
    assert.equal(x.d.querySelectorAll('[data-support-selected=true]').length,0,'unavailable and empty units cannot be selected');x.done();

    // OT numerals dim with other rested numbers and recover when stood.
    x=await boot({units:{front_center:{grade:3,basePower:13000,powerBuff:100000000,otActive:true}}});
    await x.click('attack-front_center');
    assert.equal(Number(x.dom.window.getComputedStyle(x.test('unit-front_center').querySelector('.unit-power')).opacity),.38);
    assert.equal(Number(x.test('unit-front_center').dataset.value),100013000,'rest does not change the value');
    await x.click('turn-toggle');await x.text('回合开始');
    assert.equal(x.state().units.front_center.isRested,false);
    assert.notEqual(Number(x.dom.window.getComputedStyle(x.test('unit-front_center').querySelector('.unit-power')).opacity),.38);x.done();

    // Normal and rear attacks stay independently selectable, including after one attacker rests.
    x = await boot({ units: { front_left:{basePower:10000,grade:2},back_left:{basePower:8000,grade:1,isBackRowAttack:true},front_right:{basePower:12000,grade:2},back_right:{basePower:6000,grade:1,isSupporting:true} } });
    assert.equal(x.d.querySelectorAll('.attack-between').length, 3);
    assert.equal(Number(x.test('total-back_left').dataset.value), 8000); assert.ok(x.test('attack-back_right').disabled);
    await x.click('attack-front_left'); assert.equal(x.state().units.front_left.isRested, true); assert.equal(x.state().units.back_left.isRested, false);
    await x.click('attack-back_left'); assert.equal(x.state().attackCount, 2);
    x.test('attack-front_left').click(); await wait(); assert.equal(x.state().attackCount, 2);
    assert.equal(x.d.querySelectorAll('.attack-between').length, 3);
    await x.click('turn-toggle'); await x.click('attack-undo'); assert.equal(x.state().units.back_left.isRested, false); assert.equal(x.state().units.front_left.isRested, true);
    x.done();
    x = await boot({ units:{front_left:{grade:2,basePower:10000},back_left:{grade:1,basePower:8000,isSupporting:true}} });
    assert.equal(Number(x.test('total-front_left').dataset.value), 18000);
    await x.click('attack-front_left'); assert.equal(x.state().units.back_left.isRested, true);
    const old = x.state().attackHistory[0].units.front_left.powerBuff;
    await x.click('turn-toggle'); await x.text('前列 +10k'); assert.equal(x.state().attackHistory[0].units.front_left.powerBuff, old); x.done();

    // Ride becomes Stride at G3; temporary G4 ends without erasing the heart unit.
    x = await boot({ units:{front_center:{grade:2,basePower:10000,powerBuff:5000}} });
    await x.click('turn-toggle'); await x.click('ride-action');
    assert.equal(x.state().units.front_center.grade, 3); assert.equal(x.test('ride-action').textContent, '超越');
    await x.click('ride-action'); assert.equal(x.state().units.front_center.grade, 4); assert.equal(x.state().units.front_center.basePower, 28000); assert.equal(x.state().units.front_center.powerBuff, 5000);
    assert.equal(x.state().units.front_center.heart.basePower, 13000); assert.ok(x.test('ride-action').disabled);
    await x.text('回合结束'); assert.equal(x.state().units.front_center.grade, 3); assert.equal(x.state().units.front_center.basePower, 13000); assert.equal(x.state().units.front_center.powerBuff, 0); assert.equal(x.test('ride-action').textContent, '超越');
    x.done();

    x = await boot({ units:{front_center:{grade:3,basePower:17000,powerBuff:10000}} });
    await x.click('turn-toggle'); await x.click('ride-action');
    assert.equal(x.state().units.front_center.basePower,32000,'Stride adds 15000 to the edited heart base');
    assert.equal(x.state().units.front_center.powerBuff,10000);
    await x.text('回合结束');assert.equal(x.state().units.front_center.basePower,17000);assert.equal(x.state().units.front_center.grade,3);x.done();

    // Long press drag swaps actual unit fields, cancels safely and prevents accidental drawers.
    x = await boot({ units:{front_left:{grade:2,basePower:10000,powerBuff:1000,crit:2},back_right:{grade:1,basePower:8000}} });
    await x.drag('front_left', x.test('unit-back_right'));
    assert.equal(x.state().units.back_right.basePower, 10000); assert.equal(x.state().units.back_right.powerBuff, 1000); assert.equal(x.state().units.back_right.crit, 2);
    assert.equal(x.state().units.front_left.basePower, 8000); assert.ok(!x.d.querySelector('.unit-drawer'));
    const before = JSON.stringify(x.state().units);
    await x.drag('back_right', x.test('unit-front_left'), true); assert.equal(JSON.stringify(x.state().units), before);
    const node = x.test('unit-front_left');
    node.dispatchEvent(new x.dom.window.MouseEvent('pointerdown', { bubbles:true,button:0,clientX:0,clientY:0 }));
    x.d.dispatchEvent(new x.dom.window.MouseEvent('pointermove', { bubbles:true,clientX:30,clientY:40 })); await wait(390);
    assert.ok(!x.d.querySelector('.drag-unit-preview'), 'scroll movement cancels pending long press');
    x.done();

    // Mobile legacy-touch path handles held dragging while ordinary swipes keep scrolling.
    x = await boot({ units:{front_left:{grade:2,basePower:10000},back_left:{grade:1,basePower:8000}} });
    const touchEvent=(name,point)=>{const event=new x.dom.window.Event(name,{bubbles:true,cancelable:true});Object.defineProperty(event,'touches',{value:name==='touchend'?[]:[point]});Object.defineProperty(event,'changedTouches',{value:[point]});return event;};
    x.d.elementFromPoint=()=>x.test('unit-back_left');
    x.test('unit-front_left').dispatchEvent(touchEvent('touchstart',{clientX:10,clientY:10})); await wait(390);
    assert.ok(x.d.querySelector('.drag-unit-preview'));
    const heldMove=touchEvent('touchmove',{clientX:40,clientY:140});x.d.dispatchEvent(heldMove); await wait();assert.equal(heldMove.defaultPrevented,true,'held drag prevents native scroll');
    x.d.dispatchEvent(touchEvent('touchend',{clientX:40,clientY:140}));await wait(390);
    assert.equal(x.state().units.back_left.basePower,10000);assert.equal(x.state().units.front_left.basePower,8000);assert.ok(!x.d.querySelector('.unit-drawer'));
    x.test('unit-front_left').dispatchEvent(touchEvent('touchstart',{clientX:10,clientY:10}));
    const swipe=touchEvent('touchmove',{clientX:10,clientY:45});x.d.dispatchEvent(swipe);await wait(390);
    assert.equal(swipe.defaultPrevented,false,'a normal swipe is not stolen');assert.ok(!x.d.querySelector('.drag-unit-preview'));
    x.done();

    // Guardian circle counts printed SHIELD, reserves interceptors, and retires only on resolution.
    x = await boot({ units:{front_center:{grade:3,basePower:13000},front_left:{grade:2,basePower:10000,shield:10000,isRested:true},front_right:{grade:2,basePower:12000,shield:5000}} });
    await x.click('guard-toggle'); assert.ok(x.test('guard-circle'));
    assert.ok([...x.d.querySelector('main').children].findIndex(n => n.id === 'guard-circle-area') < [...x.d.querySelector('main').children].findIndex(n => n.querySelector?.('.battle-board')));
    await x.drag('front_left', x.test('guard-circle'));
    assert.deepEqual(x.state().guardSlots, ['front_left']); assert.equal(x.state().units.front_left.basePower, 10000, 'not retired before resolve');
    assert.equal(Number(x.test('guard-circle').dataset.value), 10000, 'shield, not 10000 power plus modifiers');
    await x.click('guard-circle'); assert.equal(Number(x.test('drawer-power').dataset.value), 23000);
    await x.text('23k', x.d.querySelector('.guard-drawer'));
    assert.equal(x.test('guard-status').dataset.safe, 'false', 'equal power hits');
    await x.input(x.d.querySelector('#manual-shield'), 5000); assert.equal(Number(x.test('drawer-power').dataset.value), 28000);
    assert.equal(x.test('guard-status').dataset.safe, 'true');
    await x.click('guard-resolve'); assert.equal(x.state().units.front_left.basePower, 0); assert.equal(x.state().units.front_right.basePower, 12000);
    assert.equal(x.state().guardSlots.length, 0); assert.equal(x.state().resources.shield, 0); x.done();

    // Same interceptor cannot be double-counted; cancel preserves units and refunds unspent PG.
    x = await boot({ units:{front_center:{grade:3,basePower:13000},front_left:{grade:2,basePower:11000,shield:5000}} });
    await x.click('guard-toggle'); await x.drag('front_left', x.test('guard-circle'));
    await x.guard(); await x.click('perfect-guard');
    assert.equal(x.state().resources.sentinelsRemaining, 3); assert.equal(x.test('guard-status').dataset.safe, 'true');
    await x.text('取消', x.d.querySelector('.guard-drawer'));
    assert.equal(x.state().guardSlots.length, 0); assert.equal(x.state().units.front_left.basePower, 11000); assert.equal(x.state().resources.sentinelsRemaining, 4);
    await x.click('perfect-guard'); await x.click('guard-resolve'); assert.equal(x.state().resources.sentinelsRemaining, 3, 'resolved PG remains consumed');
    x.done();

    // Back-row intercept requires explicit ability override; Vanguard never enters guardian circle.
    x = await boot({ units:{back_left:{grade:2,basePower:10000,shield:15000},front_right:{grade:1,basePower:8000}} });
    await x.click('guard-toggle'); await x.drag('back_left', x.test('guard-circle')); assert.equal(x.state()?.guardSlots?.length ?? 0, 0);
    await x.click('turn-toggle'); await x.click('back-intercept');
    await x.drag('back_left', x.test('guard-circle')); assert.deepEqual(x.state().guardSlots, ['back_left']); assert.equal(Number(x.test('guard-circle').dataset.value), 15000);
    assert.equal(x.state().units.back_left.basePower, 10000);
    await x.guard(); await x.click('guard-resolve'); assert.equal(x.state().units.back_left.basePower, 0); x.done();

    // Rear-intercept mode also grants permission to the pictured G0/G1 booster.
    x = await boot({ units:{front_center:{grade:3,basePower:13000},back_left:{grade:0,basePower:10000,hasIntercept:false,shield:15000}},resources:{shield:5000} });
    await x.click('guard-toggle'); await x.click('turn-toggle'); await x.click('back-intercept');
    await x.drag('back_left', x.test('guard-circle'));
    assert.deepEqual(x.state().guardSlots, ['back_left']); assert.equal(Number(x.test('guard-circle').dataset.value), 20000);
    await x.guard(); assert.equal(Number(x.test('drawer-power').dataset.value), 33000);
    await x.click('unit-close'); assert.equal(Number(x.test('guard-circle').dataset.value), 20000);
    await x.guard(); await x.text('取消', x.d.querySelector('.guard-drawer')); assert.equal(x.state().units.back_left.basePower, 10000);
    assert.equal(Number(x.test('guard-circle').dataset.value), 0); x.done();

    // R grade shortcuts bind printed power too, with explicit 5k/6k G0 options.
    x = await boot({units:{front_left:{grade:0,basePower:0}}});
    for (const [grade,power] of [[1,8000],[2,10000],[3,13000],[4,28000],[0,5000]]) {
        await x.click('grade-front_left'); x.d.querySelector('[data-grade="'+grade+'"]').click(); await wait();
        assert.equal(x.state().units.front_left.basePower,power); assert.equal(x.state().units.front_left.hasIntercept,grade===2);
        assert.equal(x.state().units.front_left.hasBoost,grade<=1); assert.equal(x.state().units.front_left.hasDoubleStrike,false);
        assert.equal(x.state().units.front_left.hasTripleStrike,false);
    }
    await x.click('grade-front_left'); x.d.querySelectorAll('.rear-zero-options button')[1].click(); await wait();
    assert.equal(x.state().units.front_left.grade,0); assert.equal(x.state().units.front_left.basePower,6000);
    await x.click('grade-front_left'); x.d.querySelector('[data-grade="2"]').click(); await wait();
    assert.ok(x.test('unit-front_left').querySelector('.slot-abilities .symbol-intercept'));
    assert.ok(!x.test('unit-front_left').querySelector('.slot-critical .symbol-intercept')); x.done();

    // Five trigger crests select targets on the field; critical resolves POWER before CRITICAL.
    const triggerBoard={units:{front_center:{grade:3,basePower:13000},front_left:{grade:2,basePower:10000},back_left:{grade:1,basePower:8000}}};
    x=await boot(triggerBoard); await x.click('guard-toggle');
    assert.equal(x.d.querySelectorAll('.trigger-button').length,5);
    for(const [kind,char] of [['over','超'],['draw','引'],['front','前'],['heal','治']]) {
        const letters=[...x.test('trigger-'+kind).querySelectorAll('svg text')];assert.equal(letters.length,2);assert.ok(letters.every(el=>el.textContent===char),'official literal trigger glyph '+kind);
    }
    assert.ok(x.test('trigger-critical').querySelector('svg image'));
    assert.equal(x.dom.window.getComputedStyle(x.test('guard-circle')).aspectRatio,'2/1');
    assert.equal(x.dom.window.getComputedStyle(x.test('guard-circle')).display,'grid');
    assert.equal(x.dom.window.getComputedStyle(x.test('guard-circle').querySelector('.guard-number')).color,'rgb(240, 253, 244)','shield value stays light against the green ring');
    await x.click('trigger-critical'); assert.equal(x.state().pendingTrigger.stage,'power');
    assert.equal(x.test('unit-front_left').dataset.triggerStage,'power'); assert.ok(!x.test('unit-front_right').dataset.triggerStage);
    await x.click('unit-front_left'); assert.equal(x.state().units.front_left.powerBuff,10000); assert.equal(x.state().units.front_left.crit,1);
    assert.equal(x.state().pendingTrigger.stage,'critical'); assert.equal(x.test('unit-front_center').dataset.triggerStage,'critical');
    const partial=x.state(); x.done();x=await boot(partial);assert.ok(x.test('guard-circle'));
    assert.equal(x.state().pendingTrigger.stage,'critical'); await x.click('unit-front_center');
    assert.equal(x.state().units.front_center.crit,2); assert.equal(x.state().units.front_center.powerBuff,0); assert.equal(x.state().pendingTrigger,null);
    assert.ok(!x.d.querySelector('.unit-drawer'));
    await x.click('trigger-critical'); await x.click('unit-back_left'); await x.click('trigger-cancel');
    assert.equal(x.state().units.back_left.powerBuff,0); assert.equal(x.state().units.front_center.crit,2);
    for(const kind of ['draw','heal']){await x.click('trigger-'+kind);await x.click('unit-front_center');}
    assert.equal(x.state().units.front_center.powerBuff,20000);assert.equal(x.state().resources.damage,0);assert.equal(x.state().resources.drawTriggers,4);
    await x.click('trigger-front');assert.equal(x.state().units.front_left.powerBuff,20000);assert.equal(x.state().units.front_center.powerBuff,30000);
    assert.equal(x.state().units.front_right.powerBuff,0,'front never populates an empty circle');assert.equal(x.state().units.back_left.powerBuff,0);
    await x.click('trigger-over');await x.click('unit-back_left');assert.equal(x.state().units.back_left.powerBuff,100000000);assert.equal(x.state().units.back_left.otActive,true);
    assert.equal(x.state().units.front_center.otActive,false);
    await x.click('trigger-critical');await x.click('unit-front_left');await x.escape();assert.equal(x.state().units.front_left.powerBuff,20000);
    assert.equal(x.state().pendingTrigger,null);x.done();

    // Desktop settings dock stays non-modal and leaves field buttons usable.
    x=await boot(triggerBoard);Object.defineProperty(x.dom.window,'innerWidth',{value:1440,configurable:true});
    x.dom.window.dispatchEvent(new x.dom.window.Event('resize'));await wait();await x.click('settings-edge');
    assert.equal(x.d.querySelector('.tools-panel').getAttribute('role'),'region');assert.equal(x.d.body.style.overflow,'');
    await x.click('unit-front_left');assert.ok(!x.d.querySelector('.tools-panel'));assert.ok(x.d.querySelector('.unit-drawer'));
    await x.escape();x.done();

    // Guard state and custom shield values survive reload; missing / malformed saves do not black screen.
    x = await boot({ units:{front_left:{grade:2,basePower:10000,shield:20000}},guardSlots:['front_left','front_left','front_center','bad'],opponentPower:53000 });
    await x.guard(); assert.equal(x.d.querySelector('#opponent-power').value, '53000');
    await x.input(x.d.querySelector('#manual-shield'), 5000);
    const guardSave = x.state(); x.done(); x = await boot(guardSave); await x.guard();
    assert.equal(Number(x.test('guard-circle').dataset.value), 25000); assert.equal(x.d.querySelector('#opponent-power').value, '53000'); x.done();
    for(const save of ['{broken',null,{language:'unknown',units:{front_left:null,front_center:{basePower:'bad'}},resources:null,extraCounters:[null],attackHistory:[null],guardSlots:['bad']}]) {
        x = await boot(save); assert.ok(x.d.querySelector('header')); await x.click('turn-toggle'); await x.text('回合开始'); assert.equal(x.state().units.front_center.basePower, 6000);
        // Invalid JSON is an expected storage warning, not a render error.
        assert.ok(!x.d.body.textContent.includes('页面遇到了错误')); x.dom.window.close();
    }
    x = await boot({version:3,personaBonus:10000,units:{front_center:{basePower:13000,powerBuff:5000,grade:3,present:true},front_left:{basePower:0,powerBuff:0,present:false}}});
    assert.equal(Number(x.test('unit-front_center').dataset.value), 28000); await x.text('+1'); const migrated=x.state(); assert.equal(migrated.version, 2); assert.equal(migrated.units.front_left.powerBuff, 0); x.done();
    x = await boot(migrated); assert.equal(Number(x.test('unit-front_center').dataset.value), 28000); x.done();
    x = await boot(); x.dom.window.Storage.prototype.setItem=()=>{throw new Error('quota');};
    await x.click('turn-toggle'); await x.click('ride-action'); assert.ok(x.d.querySelector('[role="status"]')); assert.ok(x.d.querySelector('header')); x.dom.window.close();

    // Free counters migrate once and use current values even for rapid clicks.
    x = await boot({resources:{soul:7,critTriggers:2},extraCounters:[{name:'Custom',value:3}]});
    await x.click('settings-toggle'); assert.equal(x.d.querySelectorAll('.free-counter').length, 3);
    const counterPlus=x.d.querySelector('.free-counter [aria-label="增加"]'); for(let i=0;i<20;i++)counterPlus.click(); await wait(); assert.equal(x.state().extraCounters[0].value, 23);
    assert.ok(x.state().extraCounters.some(c=>c.name==='魂')); const counterSave=x.state(); x.done();
    x = await boot(counterSave); await x.text('+1'); assert.equal(x.state().extraCounters.length, 3); x.done();

    // Three-language 3D random tools, repeat tap lock, and cleanup remain intact.
    for(const [language,roll,flip,heads] of [['zh','掷骰子','抛硬币','正面'],['en','Roll die','Flip coin','Heads'],['ja','サイコロを振る','コイントス','表']]) {
        x = await boot({language}); await x.click('settings-toggle'); let draws=0; x.dom.window.Math.random=()=>{draws++;return 0;};
        const button=[...x.d.querySelectorAll('button')].find(b=>b.textContent.trim()===roll); for(let i=0;i<10;i++)button.click(); await wait(); assert.equal(draws, 1); assert.equal(x.d.querySelectorAll('.die-face').length, 6);
        await x.text(flip); await wait(770); assert.equal(x.test('dice-result').textContent, '1'); assert.equal(x.test('coin-result').textContent, heads);
        await x.escape(); assert.equal(x.d.body.style.overflow, ''); x.done();
    }

    // Asset validation: transparent PNG, regular (non-italic) fonts, no JPEG square backgrounds in UI.
    const png=fs.readFileSync('public/symbols/vg-tech-atlas.png');
    assert.equal(png.readUInt32BE(16), 1254); assert.equal(png.readUInt32BE(20), 1254); assert.equal(png[25], 6, 'RGBA atlas');
    for(const weight of [600,800]) {
        const font=fs.readFileSync('public/fonts/barlow-condensed-'+weight+'.ttf');
        for(let i=0;i<font.readUInt16BE(4);i++) { const record=12+i*16,tag=font.toString('ascii',record,record+4),offset=font.readUInt32BE(record+8); if(tag==='head')assert.equal(font.readUInt16BE(offset+44)&2,0,'no italic macStyle'); if(tag==='OS/2')assert.equal(font.readUInt16BE(offset+62)&1,0,'no italic selection'); }
    }
    console.log('PASS: original combat and storage; upright decimal reels; vertical left turn rail; direct grade editing; compact base/mod drawer; explicit multi-select Boost/resolve/cancel/undo/reload; Kanji trigger symbols; G ellipse; selection-only frames; plain attack labels; ride/Stride; long-press swap and cancellation; printed-shield intercept/resolve/cancel/PG; rear intercept permission and live total; five trigger allocation/rollback/reload; rear grade presets; desktop settings dock; guard persistence; OT isolation; counters; 3D tools and icon/font assets.');
})().catch(error=>{console.error(error);process.exitCode=1});
