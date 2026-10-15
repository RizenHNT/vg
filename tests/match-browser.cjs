const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));
const root=path.resolve('dist'), key='VG_COMBAT_STATE_V20_LOCAL';
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ttf':'font/ttf','.webmanifest':'application/manifest+json'};
const server=http.createServer((request,response)=>{
    const pathname=new URL(request.url,'http://localhost').pathname;
    const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':decodeURIComponent(pathname)));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){response.writeHead(404);response.end();return;}
    response.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});response.end(fs.readFileSync(file));
});
const seed={language:'zh',skin:'ember',energy:7,resources:{soul:6,damage:3,shield:5000,sentinelsRemaining:2},guardSlots:['front_left'],opponentPower:53000,extraCounters:[{name:'Markers',value:4}],units:{front_center:{grade:3,basePower:13000,powerBuff:5000},front_left:{grade:2,basePower:10000,shield:10000,shieldBuff:5000},front_right:{grade:0,basePower:0},back_center:{grade:1,basePower:8000,isSupporting:true}},match:{turn:2,elapsedMs:120000,runningSince:null,events:[]}};
(async()=>{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base=process.env.VG_MATCH_URL||'http://127.0.0.1:'+server.address().port;
    fs.mkdirSync('layout-qa',{recursive:true});let browser;
    try{
        browser=await chromium.launch({headless:true,...(process.env.VG_BROWSER_CHANNEL?{channel:process.env.VG_BROWSER_CHANNEL}:{})});
        const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
        page.on('pageerror',error=>errors.push(error.message));
        const state=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
        await page.goto(base);await page.getByTestId('match-panel').waitFor();
        await page.evaluate(({key,seed})=>localStorage.setItem(key,JSON.stringify(seed)),{key,seed});await page.reload();await page.getByTestId('match-panel').waitFor();
        await page.getByTestId('grade-front_center').click();await page.locator('[data-grade="10"]').click();
        let save=await state();assert.equal(save.units.front_center.grade,10);assert.equal(save.units.front_center.basePower,13000);assert.equal(save.units.front_center.hasDoubleStrike,true);assert.equal(save.units.front_center.hasTripleStrike,false);
        await page.getByTestId('grade-front_center').click();await page.locator('[data-grade="11"]').click();
        save=await state();assert.equal(save.units.front_center.grade,11);assert.equal(save.units.front_center.basePower,18000);assert.equal(save.units.front_center.hasDoubleStrike,true);assert.equal(save.units.front_center.hasTripleStrike,false);assert.equal(save.units.front_center.isStriding,false);
        await page.getByTestId('grade-front_right').click();await page.locator('[data-grade="2"]').click();
        await page.locator('[data-effect-slot="front_right"] [data-testid=fx-call]').waitFor();await pause(120);await page.screenshot({path:'layout-qa/match-call.png',fullPage:true});
        await page.getByTestId('attack-front_center').click();await page.locator('[data-effect-slot="front_center"] [data-testid=fx-attack]').waitFor();await pause(120);await page.screenshot({path:'layout-qa/match-attack.png',fullPage:true});
        save=await state();assert.equal(save.attackCount,1);assert.equal(save.attackHistory.length,1);assert.ok(save.match.events.some(event=>event.kind==='attack'));
        await page.getByTestId('timer-toggle').click();await pause(1150);await page.getByTestId('timer-toggle').click();
        save=await state();assert.ok(save.match.elapsedMs>=121000);assert.equal(save.match.runningSince,null);
        const before=await state();await page.getByTestId('match-reset').click();assert.ok(await page.getByTestId('match-reset-confirm').isDisabled());
        await page.keyboard.press('Enter');assert.equal(await page.getByTestId('match-confirm-dialog').count(),0,'Enter activates the safe default Cancel');assert.deepEqual(await state(),before,'opening or cancelling never changes the save');
        await page.getByTestId('match-reset').click();await page.getByTestId('match-reset-ack').check();await page.getByTestId('match-reset-confirm').click();
        save=await state();assert.equal(save.energy,0);assert.equal(save.resources.soul,0);assert.equal(save.resources.damage,0);assert.equal(save.units.front_center.grade,0);assert.equal(save.units.front_center.basePower,6000);assert.equal(save.attackHistory.length,0);assert.equal(save.match.turn,0);assert.equal(save.match.elapsedMs,0);assert.equal(save.extraCounters[0].name,'Markers');assert.equal(save.extraCounters[0].value,0);assert.equal(save.skin,'ember');assert.deepEqual(save.resetBackup.state.units,before.units);assert.deepEqual(save.resetBackup.state.attackHistory,before.attackHistory);
        await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);
        await page.reload();await page.getByTestId('match-restore').waitFor();assert.ok((await state()).resetBackup,'reset backup survives an offline new load');
        assert.equal(await page.evaluate(async()=>{try{await fetch('/match-uncached-probe');return false;}catch{return true;}}),true,'restore is exercised with network genuinely blocked');
        await page.getByTestId('settings-toggle').click();await page.getByTestId('skin-forest').click();await page.getByRole('button',{name:'日本語',exact:true}).click();
        await page.getByTestId('match-restore').click();assert.ok(await page.getByTestId('match-reset-confirm').isDisabled());await page.getByTestId('match-reset-ack').check();await page.getByTestId('match-reset-confirm').click();
        save=await state();for(const field of ['units','resources','extraCounters','attackHistory','attackCount','energy','guardSlots','opponentPower','pendingTrigger'])assert.deepEqual(save[field],before[field],'restore '+field);
        assert.equal(save.match.elapsedMs,before.match.elapsedMs);assert.equal(save.skin,'forest');assert.equal(save.language,'ja');assert.equal(save.resetBackup,null);
        await page.reload();await page.getByTestId('match-panel').waitFor();assert.equal(await page.locator('.vg-app').getAttribute('data-skin'),'forest');assert.equal(await page.getByTestId('brand-title').textContent(),'VG Counter');
        await page.getByTestId('unit-front_center').click();assert.equal(await page.getByRole('button',{name:'ツインドライブ',exact:true}).getAttribute('class').then(Boolean),true);await page.getByTestId('unit-close').click();
        if(await page.getByTestId('guard-toggle').getAttribute('aria-expanded')==='false')await page.getByTestId('guard-toggle').click();await page.getByTestId('trigger-over').click();await page.getByTestId('unit-front_center').click();await pause(1000);
        const luminous=await page.getByTestId('unit-front_center').locator('.power-value').evaluate(el=>({filter:getComputedStyle(el).filter,colors:[...el.querySelectorAll('.digit-static,.digit-track>span')].map(digit=>getComputedStyle(digit).color)}));
        assert.ok(luminous.filter.includes('drop-shadow'),'OT numeral glows');assert.ok(new Set(luminous.colors).size>1,'OT hues span the complete number');assert.ok(luminous.colors.every(color=>!['transparent','rgba(0, 0, 0, 0)'].includes(color)));await page.screenshot({path:'layout-qa/match-ot-ja.png',fullPage:true});
        assert.equal(await page.getByText('Rizen',{exact:true}).count(),0,'signature stays hidden');for(let i=0;i<7;i++)await page.getByTestId('brand-title').click();await page.getByTestId('rizen-secret').waitFor();await page.screenshot({path:'layout-qa/match-rizen.png'});await page.keyboard.press('Escape');assert.equal(await page.getByTestId('rizen-secret').count(),0);
        await page.getByTestId('settings-toggle').click();await page.getByTestId('effects-toggle').uncheck();await page.keyboard.press('Escape');await page.getByTestId('grade-front_right').click();await page.locator('[data-grade="1"]').click();assert.equal(await page.locator('.combat-effect').count(),0,'effects toggle stops transient scenes');
        await page.emulateMedia({reducedMotion:'reduce'});await page.getByTestId('settings-toggle').click();await page.getByTestId('effects-toggle').check();await page.keyboard.press('Escape');await page.getByTestId('grade-front_right').click();await page.locator('[data-grade="2"]').click();assert.equal(await page.locator('.combat-effect').count(),0,'system reduced motion stops scenes');
        await page.getByTestId('timer-toggle').click();await page.getByTestId('match-reset').click();await page.getByTestId('match-reset-ack').check();await page.getByTestId('match-reset-confirm').click();const frozen=(await state()).resetBackup;assert.equal(frozen.resume,true);await pause(250);await page.getByTestId('match-restore').click();await page.getByTestId('match-reset-ack').check();await page.getByTestId('match-reset-confirm').click();const resumed=await state();assert.equal(resumed.match.elapsedMs,frozen.state.match.elapsedMs);assert.ok(resumed.match.runningSince>frozen.savedAt,'undo resumes a running timer without counting the gap after reset');await page.getByTestId('timer-toggle').click();
        const second=await browser.newContext();const other=await second.newPage();await other.goto(base);await other.getByTestId('match-panel').waitFor();assert.equal(await other.getByTestId('unit-front_center').getAttribute('data-value'),'6000');assert.equal(await other.getByTestId('match-restore').count(),0,'another profile cannot see the saved previous game');await second.close();
        for(const language of ['zh','en','ja']){
            const localized=await browser.newContext({viewport:{width:390,height:844}}),lp=await localized.newPage();await lp.goto(base);await lp.getByTestId('match-panel').waitFor();await lp.evaluate(({key,seed,language})=>localStorage.setItem(key,JSON.stringify({...seed,language,guardSlots:[]})),{key,seed,language});await lp.reload();await lp.getByTestId('match-panel').waitFor();await lp.evaluate(()=>document.fonts.ready);await lp.screenshot({path:`layout-qa/match-${language}-closed.png`,fullPage:true});assert.ok(!/undefined|VG Counter.*OS OS/.test(await lp.locator('body').innerText()));await lp.getByTestId('match-reset').click();await lp.screenshot({path:`layout-qa/match-${language}-reset.png`});await localized.close();
        }
        assert.deepEqual(errors,[]);await context.close();
        console.log('PASS match: compact field; G10/G11 Twin Drive; summon/attack scenes; timer; deliberate reset/cancel; complete undo after reload; preferences preserved; glowing OT; hidden Rizen; effects/reduced motion; profile isolation and all three languages.');
    }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1});
