const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const demo = { language:'zh', energy:5, units:{front_center:{grade:3,basePower:13000,hasDoubleStrike:true},front_left:{grade:2,basePower:10000},front_right:{grade:4,basePower:28000},back_left:{grade:0,basePower:10000,shield:15000},back_center:{grade:1,basePower:8000},back_right:{grade:1,basePower:8000}} };
(async () => {
    fs.mkdirSync('layout-qa',{recursive:true});
    const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4173'],{stdio:'ignore'});
    let browser;
    try {
        for(let i=0;i<40;i++){try{if((await fetch('http://127.0.0.1:4173')).ok)break;}catch{}await wait(250);}
        browser=await chromium.launch({headless:true,...(process.env.VG_BROWSER_CHANNEL ? {channel:process.env.VG_BROWSER_CHANNEL} : {})});
        for(const width of [320,390,430,1440]) {
            const page=await browser.newPage({viewport:{width,height:900}});const errors=[];
            page.on('pageerror',error=>errors.push(error.message));
            await page.goto('http://127.0.0.1:4173');
            await page.evaluate(save=>localStorage.setItem('VG_COMBAT_STATE_V20_LOCAL',JSON.stringify(save)),demo);
            await page.reload();await page.getByTestId('unit-front_center').waitFor();await page.evaluate(()=>document.fonts.ready);
            const closed=await page.locator('.energy-section').boundingBox();
            const matchPanel=await page.getByTestId('match-panel').boundingBox();
            const firstRow=await page.getByTestId('unit-front_center').boundingBox();const secondRow=await page.getByTestId('unit-back_center').boundingBox();
            assert.ok(secondRow.y-firstRow.y<=160,'field rows remain compact');
            assert.ok(matchPanel.y>=closed.y+closed.height&&matchPanel.y-closed.y-closed.height<=16,'useful match controls follow EN');
            await page.screenshot({path:`layout-qa/${width}-guard-closed.png`,fullPage:true});
            await page.getByTestId('shield-front_left').click();
            const shieldPicker=await page.getByTestId('shield-picker').boundingBox();
            assert.ok(shieldPicker.x>=0&&shieldPicker.x+shieldPicker.width<=width,'shield picker stays on-screen');
            assert.equal(await page.locator('.unit-drawer').count(),0,'shield shortcut does not open the drawer');
            await page.locator('[data-shield="10000"]').click();
            assert.equal(await page.getByTestId('shield-front_left').textContent(),'10,000');
            await page.getByTestId('shield-front_left').click();await page.locator('[data-shield="5000"]').click();
            await page.getByTestId('guard-toggle').click();
            const circle=await page.getByTestId('guard-circle').boundingBox();assert.ok(Math.abs(circle.width/circle.height-2)<.04,'flat elliptical G ring');
            for(const state of ['closed','open']) {
                if(state==='open')await page.getByTestId('turn-toggle').click();
                const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,main:document.querySelector('main').getBoundingClientRect().toJSON(),rail:document.querySelector('.turn-panel')?.getBoundingClientRect().toJSON(),numbers:[...document.querySelectorAll('.battle-board .power-value')].map(el=>({box:el.getBoundingClientRect().toJSON(),parent:el.parentElement.getBoundingClientRect().toJSON()}))}));
                assert.ok(metrics.scroll<=width,'no horizontal overflow '+JSON.stringify({width,state,scroll:metrics.scroll}));
                if(metrics.rail)assert.ok(metrics.rail.right<=metrics.main.left+1,'turn rail leaves the main field clear');
                for(const n of metrics.numbers)assert.ok(n.box.left>=n.parent.left-1&&n.box.right<=n.parent.right+1,'numeral fits its cell '+JSON.stringify({width,state,n}));
                const guardText=await page.getByTestId('guard-circle').evaluate(el=>({box:el.getBoundingClientRect().toJSON(),emblem:el.querySelector('.guard-emblem').getBoundingClientRect().toJSON(),number:el.querySelector('.power-value').getBoundingClientRect().toJSON(),color:getComputedStyle(el.querySelector('.guard-number')).color}));
                assert.ok(guardText.emblem.right+2<=guardText.number.left,'G emblem and shield value have separate space '+JSON.stringify({width,state,guardText}));
                assert.ok(guardText.number.top>=guardText.box.top&&guardText.number.bottom<=guardText.box.bottom,'shield number stays within the ellipse');
                assert.equal(guardText.color,'rgb(240, 253, 244)');
                const totals=await page.locator('.column-total').evaluateAll(items=>items.map(el=>({box:el.getBoundingClientRect().toJSON(),label:el.querySelector('.column-total-label').getBoundingClientRect().toJSON(),number:el.querySelector('.power-value').getBoundingClientRect().toJSON()})));
                for(const total of totals){assert.ok(total.label.bottom<=total.number.top,'column label does not overlap its value');assert.ok(total.number.bottom<=total.box.bottom,'column value fits');}
                await page.screenshot({path:`layout-qa/${width}-${state}.png`,fullPage:true});
            }
            await page.getByTestId('free-support').click();
            await page.getByTestId('unit-front_left').click();await page.getByTestId('unit-front_right').click();
            assert.equal(await page.getByTestId('total-front_center').getAttribute('data-value'),'51000');
            await page.getByTestId('attack-front_center').click();
            for(const slot of ['front_left','front_center','front_right']){
                const unit=page.getByTestId('unit-'+slot);
                assert.equal(await unit.getAttribute('data-rested'),'true');
                assert.equal(await unit.locator('.unit-rest-label').innerText(),'横置');
                assert.ok(await unit.locator('.unit-power').evaluate(el=>Number(getComputedStyle(el).opacity)>=.75),'rested power stays readable');
                const label=await unit.locator('.unit-rest-label').boundingBox(),number=await unit.locator('.power-value').boundingBox();
                assert.ok(label.y>=number.y+number.height-1,'rest label sits below the numeral');
            }
            await page.screenshot({path:`layout-qa/${width}-rested.png`,fullPage:true});
            await page.getByTestId('attack-undo').click();await page.getByTestId('support-cancel').click();
            assert.equal(await page.locator('.unit-rest-label').count(),0,'undo clears all rested labels');
            await page.getByTestId('back-intercept').click();
            const source=await page.getByTestId('unit-back_left').boundingBox();const target=await page.getByTestId('guard-circle').boundingBox();
            await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();await wait(410);await page.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:10});await page.mouse.up();await wait(370);
            assert.equal(await page.getByTestId('guard-circle').getAttribute('data-value'),'15000');
            await page.getByTestId('turn-toggle').click();
            await page.getByTestId('trigger-critical').click();await page.getByTestId('unit-front_left').click();await wait(400);await page.screenshot({path:`layout-qa/${width}-choose-critical.png`,fullPage:true});
            await page.getByTestId('unit-front_center').click();
            assert.equal(await page.getByTestId('unit-front_left').getAttribute('data-value'),'20000');
            await page.getByTestId('trigger-over').click();await page.getByTestId('unit-front_center').click();await wait(400);
            assert.equal(await page.getByTestId('unit-front_center').getAttribute('data-value'),'100013000');
            const fit=await page.getByTestId('unit-front_center').locator('.power-value').evaluate(el=>({text:el.getBoundingClientRect().width,box:el.parentElement.getBoundingClientRect().width}));assert.ok(fit.text<=fit.box+1,'OT numeral fits');
            const otColors=await page.getByTestId('unit-front_center').locator('.digit-static,.digit-track>span').evaluateAll(items=>items.map(el=>getComputedStyle(el).color));
            assert.ok(otColors.every(color=>color!=='rgba(0, 0, 0, 0)'&&color!=='transparent'),'OT digits remain visible while their reels move');
            assert.ok(new Set(otColors).size>1,'OT uses colored luminous digits');
            await wait(400);await page.screenshot({path:`layout-qa/${width}-ot-field.png`,fullPage:true});
            await page.getByTestId('unit-front_center').click();await page.getByTestId('drawer-power').waitFor();await page.screenshot({path:`layout-qa/${width}-drawer.png`,fullPage:true});
            const oldPower=await page.getByTestId('drawer-power').getAttribute('data-value');
            await page.getByTestId('edit-mode-shield').click();
            await page.getByTestId('buff-section').getByRole('button',{name:'+5k',exact:true}).click();
            assert.equal(await page.getByTestId('drawer-shield').getAttribute('data-value'),'5000');
            assert.equal(await page.getByTestId('drawer-power').getAttribute('data-value'),oldPower,'shield buttons keep attack unchanged');
            await wait(400);
            const values=await page.locator('.drawer-value-button').evaluateAll(items=>items.map(el=>el.getBoundingClientRect().toJSON()));
            assert.ok(values[0].right<=values[1].left,'attack and shield have separate hit targets');
            const summary=await page.locator('.drawer-summary').boundingBox();assert.ok(summary.x>=0&&summary.x+summary.width<=width,'drawer values fit narrow screens');
            await page.screenshot({path:`layout-qa/${width}-shield-drawer.png`,fullPage:true});await page.getByTestId('unit-close').click();
            if(width===1440){await page.getByTestId('settings-edge').click();const settings=await page.locator('.tools-panel').boundingBox();const main=await page.locator('main').boundingBox();assert.ok(settings.x>=main.x+main.width,'settings uses right margin');assert.equal(await page.locator('body').evaluate(el=>el.style.overflow),'');await page.screenshot({path:'layout-qa/1440-settings.png',fullPage:true});}
            assert.deepEqual(errors,[]);console.log('PASS browser:',width,'compact field, match tools, shield switch, G ellipse, rails, drag shield, triggers and glowing OT');await page.close();
        }
        const shortPage=await browser.newPage({viewport:{width:320,height:640}});
        await shortPage.goto('http://127.0.0.1:4173');await shortPage.getByTestId('unit-front_center').waitFor();await shortPage.evaluate(()=>document.fonts.ready);
        const shortEnergy=await shortPage.locator('.energy-section').boundingBox();assert.ok(shortEnergy.y+shortEnergy.height<=642,'EN fits a short 320x640 viewport');
        const shortMatch=await shortPage.getByTestId('match-panel').boundingBox();assert.ok(shortMatch.y>=shortEnergy.y+shortEnergy.height&&shortMatch.y-shortEnergy.y-shortEnergy.height<=16,'short viewport continues into the useful match panel');
        await shortPage.screenshot({path:'layout-qa/320-short-closed.png',fullPage:true});await shortPage.close();
    } finally { await browser?.close();server.kill(); }
})().catch(error=>{console.error(error);process.exitCode=1});
