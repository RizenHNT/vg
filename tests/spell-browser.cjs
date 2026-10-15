const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const key='VG_COMBAT_STATE_V20_LOCAL',root=path.resolve('dist');let legacy=false;
const oldHTML='<html><body><h1 id="legacy-shell">Previous offline shell</h1><script>navigator.serviceWorker.register("/sw.js")</script></body></html>';
const oldWorker=`self.addEventListener('install',e=>e.waitUntil(caches.open('vg-counter-shell-legacy').then(c=>c.put('/index.html',new Response(${JSON.stringify(oldHTML)},{headers:{'Content-Type':'text/html'}})))));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{const p=new URL(e.request.url).pathname;if(e.request.mode==='navigate'&&(p==='/'||p==='/index.html'))e.respondWith(caches.match('/index.html'));});self.addEventListener('message',e=>{if(e.data?.type==='APPLY_UPDATE')self.skipWaiting()});`;
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.ttf':'font/ttf','.webmanifest':'application/manifest+json'};
const server=http.createServer((request,response)=>{
    const pathname=new URL(request.url,'http://localhost').pathname;
    if(legacy&&(pathname==='/'||pathname==='/index.html'||pathname==='/sw.js')){response.writeHead(200,{'Content-Type':pathname==='/sw.js'?'application/javascript':'text/html','Cache-Control':'no-store'});response.end(pathname==='/sw.js'?oldWorker:oldHTML);return;}
    const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':decodeURIComponent(pathname)));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){response.writeHead(404);response.end();return;}
    response.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});response.end(fs.readFileSync(file));
});
const seed={language:'zh',skin:'circuit',units:{front_center:{grade:3,basePower:13000,powerBuff:100000000,otActive:true},front_left:{grade:2,basePower:10000,hasIntercept:true},back_center:{grade:1,basePower:8000}},energy:5};
(async()=>{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=process.env.VG_SPELL_URL||'http://127.0.0.1:'+server.address().port;
    fs.mkdirSync('layout-qa/spell-frames',{recursive:true});let browser;
    try{
        browser=await chromium.launch({headless:true,...(process.env.VG_BROWSER_CHANNEL?{channel:process.env.VG_BROWSER_CHANNEL}:{})});
        const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
        await page.goto(base);await page.getByTestId('match-panel').waitFor();await page.evaluate(({key,seed})=>localStorage.setItem(key,JSON.stringify(seed)),{key,seed});await page.reload();await page.getByTestId('match-panel').waitFor();await page.evaluate(()=>document.fonts.ready);
        await page.getByTestId('neon-front_center').waitFor();
        assert.ok(await page.getByTestId('neon-front_center').locator('.summon-seal path').count()>50,'OT contains complete engraved seals');
        await page.waitForFunction(()=>document.querySelector('[data-testid="neon-front_center"] .neon-runes')?.getAnimations().some(a=>a.playState==='running'&&a.currentTime>100));
        const moving=()=>page.getByTestId('neon-front_center').evaluate(el=>({outer:getComputedStyle(el.querySelector('.neon-runes')).transform,inner:getComputedStyle(el.querySelector('.neon-runes-inner')).transform,pulse:getComputedStyle(el.querySelector('.neon-pulse')).transform}));
        const start=await moving();await pause(500);const later=await moving();
        if(start.outer===later.outer)console.log('Animation diagnostic:',await page.getByTestId('neon-front_center').evaluate(el=>({visibility:document.visibilityState,effects:el.closest('.vg-app').dataset.effects,style:{name:getComputedStyle(el.querySelector('.neon-runes')).animationName,duration:getComputedStyle(el.querySelector('.neon-runes')).animationDuration,state:getComputedStyle(el.querySelector('.neon-runes')).animationPlayState},animations:el.querySelector('.neon-runes').getAnimations().map(a=>({state:a.playState,time:a.currentTime,timing:a.effect.getComputedTiming()}))})));
        for(const layer of Object.keys(start))assert.notEqual(start[layer],later[layer],layer+' really animates');
        await page.getByTestId('settings-toggle').click();await page.getByTestId('skin-ember').click();await page.keyboard.press('Escape');await page.screenshot({path:'layout-qa/neon-dragon-field.png',fullPage:true});
        await page.getByTestId('settings-toggle').click();await page.getByTestId('skin-forest').click();await page.keyboard.press('Escape');await page.screenshot({path:'layout-qa/neon-grove-field.png',fullPage:true});
        await page.getByTestId('settings-toggle').click();const saved=await page.evaluate(key=>localStorage.getItem(key),key);await page.getByTestId('effect-preview').click();await page.getByTestId('effect-preview-dialog').waitFor();
        let frame=0;const frameTimes=[];
        for(const [kind,count] of [['over',30],['call',20],['attack',20]]){
            await page.getByTestId('preview-'+kind).click();
            if(kind!=='over')assert.ok(await page.getByTestId('spell-demo').locator('.summon-seal path').count()>50,'summon/attack use intricate rotating seals');
            const shots=[];
            for(let i=0;i<(process.env.VG_CAPTURE_SPELLS?count:3);i++){
                if(process.env.VG_CAPTURE_SPELLS)frameTimes.push(Date.now());
                const screenshot=await page.getByTestId('effect-preview-dialog').screenshot({animations:'allow',...(process.env.VG_CAPTURE_SPELLS?{path:`layout-qa/spell-frames/${String(frame++).padStart(3,'0')}.png`}:{})});shots.push(screenshot);await pause(process.env.VG_CAPTURE_SPELLS?75:120);
            }
            assert.ok(!shots[0].equals(shots[1]),kind+' rendered frames move');
            await page.screenshot({path:`layout-qa/spell-preview-${kind}.png`});
        }
        if(process.env.VG_CAPTURE_SPELLS)fs.writeFileSync('layout-qa/spell-frames/timing.json',JSON.stringify(frameTimes.map((at,i)=>i+1<frameTimes.length?frameTimes[i+1]-at:150)));
        assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),saved,'preview never changes saved game');await page.keyboard.press('Escape');assert.equal(await page.getByTestId('effect-preview-dialog').count(),0);await page.keyboard.press('Escape');
        await page.getByTestId('attack-front_center').click();await page.locator('[data-effect-slot="front_center"] [data-testid="fx-attack"]').waitFor();
        const fx=await page.locator('[data-effect-slot="front_center"]').evaluate(el=>({parent:el.parentElement.className,pointer:getComputedStyle(el.parentElement).pointerEvents,overflow:getComputedStyle(el.parentElement).overflow}));assert.equal(fx.parent,'battle-spells');assert.equal(fx.pointer,'none');assert.equal(fx.overflow,'visible','spell is not cropped to the unit cell');
        await page.getByTestId('unit-front_left').click();await page.getByTestId('unit-close').click();await pause(1700);assert.equal(await page.locator('.action-anchor').count(),0,'transient effects clean up');
        await page.getByTestId('settings-toggle').click();await page.getByTestId('effects-toggle').uncheck();await page.keyboard.press('Escape');assert.equal(await page.locator('.battle-spells').evaluate(el=>getComputedStyle(el).display),'none');
        await page.getByTestId('settings-toggle').click();await page.getByTestId('effects-toggle').check();await page.keyboard.press('Escape');await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.battle-spells').evaluate(el=>getComputedStyle(el).display),'none');
        assert.deepEqual(errors,[]);await context.close();
        if(!process.env.VG_SPELL_URL){
            // Real legacy cache-first worker: / remains stale until /play.html bridges it.
            legacy=true;const stale=await browser.newContext(),sp=await stale.newPage();await sp.goto(base);await sp.locator('#legacy-shell').waitFor();await sp.waitForFunction(()=>!!navigator.serviceWorker.controller);
            await sp.evaluate(({key,seed})=>localStorage.setItem(key,JSON.stringify(seed)),{key,seed});legacy=false;await sp.reload();await sp.locator('#legacy-shell').waitFor();
            await sp.goto(base+'/play.html');await sp.getByTestId('match-panel').waitFor();assert.equal(await sp.getByTestId('unit-front_center').getAttribute('data-value'),'100013000','legacy bridge preserves the existing save');
            await sp.getByTestId('pwa-update').waitFor();await Promise.all([sp.waitForNavigation(),sp.getByTestId('pwa-update').click()]);await sp.getByTestId('match-panel').waitFor();assert.equal(await sp.getByTestId('unit-front_center').getAttribute('data-value'),'100013000');
            await stale.setOffline(true);await sp.reload();await sp.getByTestId('match-panel').waitFor();assert.equal(await sp.getByTestId('unit-front_center').getAttribute('data-value'),'100013000','new bridge also launches offline');await stale.close();
        }
        console.log('PASS spells: full engraved neon seals; counter-rotation and unfolding; illustrated skins; moving OT/call/attack previews; preview save isolation; uncropped non-blocking battle effects; cleanup; effects/reduced motion; real stale-worker recovery and offline save preservation.');
    }finally{legacy=false;await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1});
