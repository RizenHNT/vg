const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');

const KEY = 'VG_COMBAT_STATE_V20_LOCAL';
const root = path.resolve('dist');
const types = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.webmanifest':'application/manifest+json', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ttf':'font/ttf' };
let update = false;
const missing = [];
const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : decodeURIComponent(pathname)));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { missing.push(pathname); response.writeHead(404); response.end(); return; }
    let data = fs.readFileSync(file);
    if (pathname === '/sw.js' && update) data = Buffer.from(data.toString().replace('const CACHE_NAME = CACHE_PREFIX + ', "const CACHE_NAME = CACHE_PREFIX + 'test-update-' + "));
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' });
    response.end(data);
});
const seed = { language:'en', energy:5, units:{ front_center:{grade:3,basePower:13000,powerBuff:5000},front_left:{grade:2,basePower:10000},front_right:{grade:2,basePower:10000},back_center:{grade:1,basePower:8000} },extraCounters:[{name:'Saved counter',value:7}] };

(async () => {
    let context;
    const tempRoot = fs.realpathSync(os.tmpdir());
    const profile = fs.mkdtempSync(path.join(tempRoot,'vg-pwa-test-'));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    fs.mkdirSync('layout-qa', { recursive:true });
    try {
        const manifest = JSON.parse(fs.readFileSync('dist/manifest.webmanifest','utf8'));
        assert.equal(manifest.display, 'standalone');
        assert.equal(manifest.start_url, '/');
        for (const size of [192,512]) {
            const icon = manifest.icons.find(icon => icon.sizes === size+'x'+size && icon.purpose === 'any');
            const png = fs.readFileSync(path.join(root,icon.src));
            assert.equal(png.readUInt32BE(16),size); assert.equal(png.readUInt32BE(20),size);
        }
        assert.ok(fs.readFileSync('dist/index.html','utf8').includes('https://vg-counter.vercel.app/share-card.png'));
        context = await chromium.launchPersistentContext(profile,{headless:true,viewport:{width:390,height:900},permissions:['clipboard-read','clipboard-write'],...(process.env.VG_BROWSER_CHANNEL ? {channel:process.env.VG_BROWSER_CHANNEL} : {})});
        const page = await context.newPage();
        const errors = [];
        context.on('serviceworker', worker => worker.on('console', message => { if (message.type() === 'error') console.error('Service worker:',message.text()); }));
        page.on('pageerror',error=>errors.push(error.message));
        await page.goto(base);
        await page.evaluate(({key,save})=>localStorage.setItem(key,JSON.stringify(save)),{key:KEY,save:seed});
        await page.reload();
        await page.getByTestId('unit-front_center').waitFor();
        try { await page.waitForFunction(()=>!!navigator.serviceWorker.controller); }
        catch (error) { console.error('PWA activation diagnostic:',await page.evaluate(async()=>({registrations:(await navigator.serviceWorker.getRegistrations()).map(r=>({scope:r.scope,active:r.active?.state,installing:r.installing?.state,waiting:r.waiting?.state})),caches:await caches.keys()})),missing); throw error; }
        assert.equal(await page.getByTestId('unit-front_center').getAttribute('data-value'),'18000','old production save loaded');
        const cdp = await context.newCDPSession(page);
        const info = await cdp.send('Page.getAppManifest');
        assert.equal(info.errors.length,0,'browser reads the manifest');
        assert.equal(JSON.parse(info.data).display,'standalone');
        const installability = await cdp.send('Page.getInstallabilityErrors');
        assert.deepEqual(installability.installabilityErrors,[],'browser installability checks');

        // The native prompt may fire while settings is closed; it must be retained.
        await page.evaluate(()=>{
            const event = new Event('beforeinstallprompt',{cancelable:true});
            window.promptCalls = 0;
            event.prompt = async()=>{window.promptCalls++;};
            event.userChoice = Promise.resolve({outcome:'dismissed'});
            window.dispatchEvent(event);
        });
        await page.getByTestId('settings-toggle').click();
        await page.waitForFunction(()=>document.querySelector('[data-testid=pwa-offline]')?.dataset.ready==='true');
        await page.getByTestId('pwa-install').click();
        assert.equal(await page.evaluate(()=>window.promptCalls),1);
        await page.getByTestId('pwa-install').click();
        assert.equal(await page.getByTestId('pwa-help').getAttribute('open'),'');
        await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:undefined}));
        await page.getByTestId('pwa-share').click();
        await page.getByText('Link copied',{exact:true}).waitFor();
        assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'https://vg-counter.vercel.app/');
        await page.screenshot({path:'layout-qa/pwa-install-help.png',fullPage:true});
        await page.keyboard.press('Escape');

        await context.setOffline(true);
        // New Chromium targets can retain an online navigator hint while requests
        // are offline. Set both native network state and the request blockade.
        await cdp.send('Network.overrideNetworkState',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
        assert.equal(await page.evaluate(async()=>{try{await fetch('/uncached-network-probe');return false;}catch{return true;}}),true,'uncached network requests are blocked');
        await page.reload();
        await page.getByTestId('unit-front_center').waitFor();
        assert.equal(await page.getByTestId('unit-front_center').getAttribute('data-value'),'18000');
        await page.getByTestId('unit-front_center').click();
        await page.getByRole('button',{name:'+5k',exact:true}).click();
        assert.equal(await page.getByTestId('drawer-power').getAttribute('data-value'),'23000');
        await page.getByTestId('unit-close').click();
        const relaunch = await context.newPage();
        const relaunchCdp = await context.newCDPSession(relaunch);
        await relaunchCdp.send('Network.overrideNetworkState',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
        await relaunch.goto(base+'/?utm_source=offline-check');
        await relaunch.getByTestId('unit-front_center').waitFor();
        assert.equal(await relaunch.getByTestId('unit-front_center').getAttribute('data-value'),'23000','new offline launch loads the modified save');
        const save = await relaunch.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
        assert.equal(save.extraCounters[0].value,7);
        await relaunch.getByTestId('settings-toggle').click();
        try { await relaunch.getByText('Offline · you can keep playing',{exact:true}).waitFor(); }
        catch (error) { console.error('Offline status diagnostic:',await relaunch.evaluate(async()=>({online:navigator.onLine,controlled:!!navigator.serviceWorker.controller,status:document.querySelector('[data-testid=pwa-offline]')?.textContent,registrations:(await navigator.serviceWorker.getRegistrations()).map(r=>r.active?.state)}))); throw error; }
        await relaunch.screenshot({path:'layout-qa/pwa-offline.png',fullPage:true});
        await relaunch.close();

        // A completed update waits until the player chooses to apply it.
        await context.setOffline(false);
        await cdp.send('Network.overrideNetworkState',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
        update = true;
        await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration()).update();});
        await page.getByTestId('pwa-update').waitFor();
        assert.equal(await page.getByTestId('unit-front_center').getAttribute('data-value'),'23000','update does not replace a live game');
        await page.screenshot({path:'layout-qa/pwa-update.png',fullPage:true});
        await Promise.all([page.waitForNavigation(),page.getByTestId('pwa-update').click()]);
        await page.getByTestId('unit-front_center').waitFor();
        assert.equal(await page.getByTestId('unit-front_center').getAttribute('data-value'),'23000','save survives applying the update');
        assert.equal(await page.getByTestId('pwa-update').count(),0);
        const caches = await page.evaluate(()=>window.caches.keys());
        assert.equal(caches.filter(key=>key.startsWith('vg-counter-shell-')).length,2,'current and preceding shell retained');
        await context.setOffline(true);
        await cdp.send('Network.overrideNetworkState',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
        await page.reload();
        await page.getByTestId('unit-front_center').waitFor();
        assert.equal(await page.getByTestId('unit-front_center').getAttribute('data-value'),'23000');
        assert.deepEqual(errors,[]);
        console.log('PASS PWA: browser installability; prompt retained; install help; clipboard share; old save; offline reload/new launch/edit; deliberate update; save preserved after update; no runtime errors.');
    } finally {
        await context?.close(); await new Promise(resolve=>server.close(resolve));
        const resolved = fs.realpathSync(profile);
        if (path.dirname(resolved) !== tempRoot || !path.basename(resolved).startsWith('vg-pwa-test-')) throw Error('Unexpected test profile location');
        fs.rmSync(resolved,{recursive:true,force:true});
    }
})().catch(error=>{console.error(error);process.exitCode=1});
