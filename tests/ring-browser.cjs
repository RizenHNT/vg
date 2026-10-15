const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const key = 'VG_COMBAT_STATE_V20_LOCAL', root = path.resolve('dist');
const types = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.ttf':'font/ttf','.webmanifest':'application/manifest+json'};
const server = http.createServer((request,response) => {
    const file = path.resolve(root,'.'+(new URL(request.url,'http://localhost').pathname === '/' ? '/index.html' : decodeURIComponent(new URL(request.url,'http://localhost').pathname)));
    if (!file.startsWith(root+path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end(); return; }
    response.writeHead(200,{'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store'}); response.end(fs.readFileSync(file));
});
const seed = {language:'zh',skin:'circuit',energy:5,units:{front_center:{grade:3,basePower:13000,shield:0},front_left:{grade:2,basePower:11000,shield:10000,shieldBuff:2000,hasIntercept:true},front_right:{grade:1,basePower:8000},back_left:{grade:1,basePower:8000},back_center:{grade:1,basePower:8000},back_right:{grade:1,basePower:8000}}};
(async () => {
    fs.mkdirSync('layout-qa',{recursive:true});
    await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
    const base = process.env.VG_RING_URL || 'http://127.0.0.1:'+server.address().port;
    let browser;
    try {
        browser = await chromium.launch({headless:true,...(process.env.VG_BROWSER_CHANNEL ? {channel:process.env.VG_BROWSER_CHANNEL} : {})});
        const context = await browser.newContext({viewport:{width:390,height:844},hasTouch:true}), page = await context.newPage(), errors=[];
        page.on('pageerror',error=>errors.push(error.message));
        const state = () => page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
        await page.goto(base); await page.getByTestId('match-panel').waitFor();
        await page.evaluate(({key,seed})=>localStorage.setItem(key,JSON.stringify(seed)),{key,seed});
        await page.reload(); await page.getByTestId('match-panel').waitFor(); await page.evaluate(()=>document.fonts.ready);
        await page.getByTestId('grade-front_left').click();
        assert.deepEqual(await page.locator('.grade-options button').allTextContents(),['0','1','2','3','4','10','11']);
        assert.equal(await page.getByTestId('grade-zero-options').count(),0);
        const before=(await state()).units.front_left;
        for(let i=0;i<9;i++)await page.getByTestId('grade-up').click();
        const stepped=(await state()).units.front_left;
        assert.equal(stepped.grade,11); for(const field of Object.keys(before).filter(k=>k!=='grade'))assert.deepEqual(stepped[field],before[field],'stepping past G4/G10/G11 preserves '+field);
        await page.getByTestId('grade-down').click(); assert.equal((await state()).units.front_left.grade,10);
        await page.screenshot({path:'layout-qa/grade-stepper.png'});
        await page.keyboard.press('Escape');
        for(const [slot,power] of [['front_left',5000],['front_center',6000]]) {
            await page.getByTestId('grade-'+slot).click(); await page.locator('[data-grade="0"]').tap();
            assert.equal((await state()).units[slot].basePower,power); assert.equal(await page.getByTestId('grade-picker').count(),0);
        }
        // Native touch hold, release, then choose: release must not accidentally choose G0.
        await page.getByTestId('grade-front_left').click();
        const zero=await page.locator('[data-grade="0"]').boundingBox(), session=await context.newCDPSession(page);
        const point={x:zero.x+zero.width/2,y:zero.y+zero.height/2};
        await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]}); await pause(560);
        await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await pause(80);
        assert.equal(await page.getByTestId('grade-zero-options').count(),1,'long touch reveals G0 alternatives');
        assert.equal((await state()).units.front_left.basePower,5000,'release does not select a power');
        await page.screenshot({path:'layout-qa/grade-zero-hold.png'});
        await page.locator('[data-zero-power="6000"]').tap(); assert.equal((await state()).units.front_left.basePower,6000);
        await page.getByTestId('grade-front_left').click();
        await page.locator('[data-grade="0"]').focus(); await page.keyboard.press('ArrowDown');
        assert.equal(await page.getByTestId('grade-zero-options').count(),1,'keyboard opens the same alternatives');
        await page.locator('[data-zero-power="5000"]').click();
        // A hold interrupted by a drag cannot turn into an accidental default selection.
        await page.getByTestId('grade-front_left').click(); const box=await page.locator('[data-grade="0"]').boundingBox();
        await page.mouse.move(box.x+10,box.y+10);await page.mouse.down();await page.mouse.move(box.x+25,box.y+10);await pause(520);await page.mouse.up();
        assert.equal(await page.getByTestId('grade-zero-options').count(),0);assert.equal(await page.getByTestId('grade-picker').count(),1);await page.keyboard.press('Escape');
        await page.getByTestId('grade-front_center').click();await page.locator('[data-grade="3"]').click();
        const renderedSkins=[];
        for(const skin of ['circuit','ember','forest']) {
            await page.getByTestId('settings-toggle').click();await page.getByTestId('skin-'+skin).click();
            await page.getByTestId('skin-'+skin).scrollIntoViewIfNeeded();await page.screenshot({path:`layout-qa/skin-${skin}-selector.png`});await page.keyboard.press('Escape');
            await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`layout-qa/skin-${skin}-field.png`,fullPage:true});
            renderedSkins.push(await page.getByTestId('unit-front_center').locator('.ring-engraving').first().getAttribute('class'));
        }
        assert.equal(new Set(renderedSkins).size,3,'skins render different ring geometry');
        await page.getByTestId('unit-front_center').click();
        const drawerStyles=await page.getByTestId('drawer-power').evaluate(el=>[el,...el.querySelectorAll('.power-value,.digit-static,.digit-track>span')].map(n=>({shadow:getComputedStyle(n).textShadow,filter:getComputedStyle(n).filter})));
        assert.ok(drawerStyles.every(s=>s.shadow==='none'&&s.filter==='none'),'drawer glyphs are crisp at every nesting layer');
        await page.screenshot({path:'layout-qa/drawer-crisp-power.png'});await page.getByTestId('edit-mode-shield').click();await page.screenshot({path:'layout-qa/drawer-crisp-shield.png'});await page.getByTestId('unit-close').click();
        if(await page.getByTestId('guard-toggle').getAttribute('aria-expanded')==='false')await page.getByTestId('guard-toggle').click();
        await page.getByTestId('trigger-over').click();await page.getByTestId('unit-front_center').click();await pause(1100);
        const ot=page.getByTestId('unit-front_center');
        const sample=()=>ot.evaluate(el=>({ring:getComputedStyle(el.querySelector('.circle-art')).transform,unfold:getComputedStyle(el.querySelector('.circle-unfold')).transform,digit:getComputedStyle(el.querySelector('.digit-static,.digit-window')).color}));
        const first=await sample(), firstPixels=await ot.screenshot({path:'layout-qa/ot-motion-a.png',animations:'allow'});await pause(420);
        const second=await sample(), secondPixels=await ot.screenshot({path:'layout-qa/ot-motion-b.png',animations:'allow'});
        assert.notEqual(first.ring,second.ring,'engraved ring actually rotates');assert.notEqual(first.unfold,second.unfold,'second ring unfolds over time');assert.notEqual(first.digit,second.digit,'digit colors actually flow');assert.ok(!firstPixels.equals(secondPixels),'rendered OT frames differ');
        for(const width of [320,390,430,1440]) {
            await page.setViewportSize({width,height:844});await page.evaluate(()=>scrollTo(0,0));
            assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no overflow at '+width);
            await page.getByTestId('grade-front_center').click();const picker=await page.getByTestId('grade-picker').boundingBox();assert.ok(picker.x>=0&&picker.x+picker.width<=width&&picker.y+picker.height<=844,'grade picker fits '+width);await page.keyboard.press('Escape');
            await page.screenshot({path:`layout-qa/ring-${width}-ot.png`,fullPage:true});
        }
        await page.setViewportSize({width:390,height:844});await page.getByTestId('settings-toggle').click();await page.getByTestId('effects-toggle').uncheck();await page.keyboard.press('Escape');
        const off=await sample();await pause(230);assert.deepEqual(await sample(),off,'effects switch freezes continuous OT too');
        await page.getByTestId('settings-toggle').click();await page.getByTestId('effects-toggle').check();await page.keyboard.press('Escape');await page.emulateMedia({reducedMotion:'reduce'});
        const reduced=await sample();await pause(230);assert.deepEqual(await sample(),reduced,'reduced motion freezes OT');
        await page.emulateMedia({reducedMotion:'no-preference'});
        await page.reload();await page.getByTestId('match-panel').waitFor();assert.equal((await state()).skin,'forest');assert.equal((await state()).units.front_left.basePower,5000);
        for(const language of ['zh','en','ja']) {
            const localized=await browser.newContext({viewport:{width:320,height:640}}), lp=await localized.newPage();
            await lp.goto(base);await lp.getByTestId('match-panel').waitFor();
            await lp.evaluate(({key,seed,language})=>localStorage.setItem(key,JSON.stringify({...seed,language,skin:'forest'})),{key,seed,language});
            await lp.reload();await lp.getByTestId('match-panel').waitFor();await lp.evaluate(()=>document.fonts.ready);
            await lp.getByTestId('unit-front_center').click();await lp.getByTestId('drawer-grade').click();
            await lp.locator('[data-grade="0"]').focus();await lp.keyboard.press('ArrowDown');await lp.getByTestId('grade-zero-options').waitFor();await pause(50);
            const bounds=await lp.getByTestId('grade-picker').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=320&&bounds.y>=0&&bounds.y+bounds.height<=640,language+' drawer grade popup stays within a short phone screen');
            await lp.screenshot({path:`layout-qa/grade-${language}-320.png`});await lp.keyboard.press('Escape');assert.ok(await lp.getByTestId('drawer-grade').evaluate(el=>document.activeElement===el),'focus returns to drawer grade');await localized.close();
        }
        assert.deepEqual(errors,[]);await context.close();
        console.log('PASS ring design: seven grades; stepping preserves all values; R/V G0 defaults; native touch hold and release; keyboard alternative; drag cancellation; distinct skins; crisp drawer; rendered OT rotation/unfold/color changes; four widths; effect toggle and reduced motion; save reload.');
    } finally { await browser?.close();await new Promise(resolve=>server.close(resolve)); }
})().catch(error=>{console.error(error);process.exitCode=1});
