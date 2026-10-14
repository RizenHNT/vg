import React, { useEffect, useState } from 'react';
import { Download, Share2, Check, WifiOff, RefreshCcw } from 'lucide-react';
import { applyPwaUpdate, getPwaStatus, subscribePwa } from './pwa-runtime.js';
import './pwa.css';

const URL = 'https://vg-counter.vercel.app/';
const COPY = {
    zh: { title: '随身使用', install: '安装到桌面', installed: '已添加到桌面', share: '分享工具', copied: '链接已复制', shared: '已分享', help: '安装与离线使用', ready: '离线已就绪 · 记录保存在本机', offline: '当前离线 · 可以继续操作', preparing: '首次联网打开后，准备离线使用', failed: '离线暂未就绪，请联网后重新打开', ios: 'iPhone / iPad：用 Safari 打开，点「分享」→「添加到主屏幕」。', other: 'Android / 电脑：使用 Chrome 或 Edge，在浏览器菜单中选择「安装应用」或「添加到主屏幕」。', note: '首次联网打开，等「离线已就绪」后即可断网使用。各浏览器与桌面 App 的记录可能独立，请在同一入口继续对局。', update: '新版已准备好', apply: '更新并保留记录', shareText: '免费的先导者对战计数器：力量、暴击、EN 和盾值，中英日三语。', link: '体验链接', unofficial: '非官方手动辅助工具 · 适合朋友对战与练习' },
    en: { title: 'Take it with you', install: 'Install app', installed: 'App installed', share: 'Share tool', copied: 'Link copied', shared: 'Shared', help: 'Install & use offline', ready: 'Ready offline · saved on this device', offline: 'Offline · you can keep playing', preparing: 'Open online once to prepare offline use', failed: 'Offline not ready; reopen while online', ios: 'iPhone / iPad: open in Safari, then Share → Add to Home Screen.', other: 'Android / desktop: use Chrome or Edge and choose Install app or Add to Home Screen in the browser menu.', note: 'Open online once and wait for “Ready offline”. Browsers and home-screen apps may keep separate saves. Continue a game from the same entry point.', update: 'An update is ready', apply: 'Update & keep my save', shareText: 'Free Cardfight!! Vanguard counter: power, critical, Energy and shield. English, Chinese and Japanese.', link: 'Try it here', unofficial: 'Unofficial manual counter · for casual games and practice' },
    ja: { title: 'いつでも使う', install: 'ホーム画面に追加', installed: 'ホーム画面に追加済み', share: 'ツールを共有', copied: 'リンクをコピーしました', shared: '共有しました', help: 'インストール・オフライン利用', ready: 'オフライン利用OK · 記録はこの端末に保存', offline: 'オフライン · 操作を続けられます', preparing: '初回はオンラインで開いてください', failed: 'オフライン利用の準備ができていません。オンラインで開き直してください', ios: 'iPhone / iPad：Safariで開き、「共有」→「ホーム画面に追加」を選びます。', other: 'Android / パソコン：ChromeやEdgeのメニューから「アプリをインストール」または「ホーム画面に追加」を選びます。', note: '初回はオンラインで開き、「オフライン利用OK」と表示されるまで待ってください。ブラウザーとホーム画面のアプリでは記録が別になる場合があります。同じ起動方法で対戦を続けてください。', update: '新しいバージョンがあります', apply: '記録を保持して更新', shareText: 'ヴァンガードの無料カウンター。パワー、クリティカル、エネルギー、シールドを記録。日本語・英語・中国語対応。', link: 'リンク', unofficial: '非公式の手動カウンター · 友人との対戦や練習に' },
};
const copyFor = language => COPY[language] || COPY.zh;
function usePwaStatus() {
    const [status, setStatus] = useState(getPwaStatus);
    useEffect(() => subscribePwa(setStatus), []);
    return status;
}
export function PwaUpdateNotice({ language }) {
    const status = usePwaStatus();
    const t = copyFor(language);
    if (!status.update) return null;
    return <div className="pwa-update" role="status"><span>{t.update}</span><button type="button" data-testid="pwa-update" onClick={applyPwaUpdate}><RefreshCcw size={14} />{t.apply}</button></div>;
}
export function PwaTools({ language }) {
    const t = copyFor(language);
    const status = usePwaStatus();
    const [installPrompt, setInstallPrompt] = useState(null);
    const [installed, setInstalled] = useState(() => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true || window.vgInstalled === true);
    const [helpOpen, setHelpOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [manualLink, setManualLink] = useState(false);
    const [online, setOnline] = useState(navigator.onLine !== false);
    useEffect(() => {
        // The runtime retains a prompt fired before this settings panel opened.
        const prompt = event => { event.preventDefault(); window.vgInstallPrompt = event; setInstallPrompt(event); };
        setInstallPrompt(window.vgInstallPrompt || null);
        const done = () => { window.vgInstallPrompt = null; setInstalled(true); setInstallPrompt(null); };
        const connection = () => setOnline(navigator.onLine !== false);
        window.addEventListener('beforeinstallprompt', prompt);
        window.addEventListener('appinstalled', done);
        window.addEventListener('online', connection);
        window.addEventListener('offline', connection);
        return () => { window.removeEventListener('beforeinstallprompt', prompt); window.removeEventListener('appinstalled', done); window.removeEventListener('online', connection); window.removeEventListener('offline', connection); };
    }, []);
    const install = async () => {
        if (!installPrompt) { setHelpOpen(true); return; }
        try { await installPrompt.prompt(); await installPrompt.userChoice; }
        catch { setHelpOpen(true); }
        finally { window.vgInstallPrompt = null; setInstallPrompt(null); }
    };
    const share = async () => {
        setMessage('');
        if (navigator.share) {
            try { await navigator.share({ title: 'VG Counter', text: t.shareText, url: URL }); setMessage('shared'); return; }
            catch (error) { if (error.name === 'AbortError') return; }
        }
        try { await navigator.clipboard.writeText(URL); setMessage('copied'); }
        catch { setManualLink(true); }
    };
    const readyText = status.ready ? (online ? t.ready : t.offline) : status.failed ? t.failed : t.preparing;
    return <section className="pwa-tools" aria-label={t.title}>
        <div className="pwa-tool-buttons">
            <button type="button" data-testid="pwa-install" disabled={installed} onClick={install}>{installed ? <Check size={15} /> : <Download size={15} />}{installed ? t.installed : t.install}</button>
            <button type="button" data-testid="pwa-share" onClick={share}><Share2 size={15} />{t.share}</button>
        </div>
        <p className="pwa-offline" data-testid="pwa-offline" data-ready={status.ready} role="status">{status.ready ? online ? <Check size={13} /> : <WifiOff size={13} /> : null}{readyText}</p>
        {message && <p className="pwa-feedback" role="status">{t[message]}</p>}
        {manualLink && <label className="pwa-link">{t.link}<input readOnly value={URL} onFocus={e => e.target.select()} /></label>}
        <details data-testid="pwa-help" open={helpOpen} onToggle={event => setHelpOpen(event.currentTarget.open)}>
            <summary>{t.help}</summary><p>{t.ios}</p><p>{t.other}</p><p>{t.note}</p>
        </details>
        <p className="pwa-unofficial">{t.unofficial}</p>
    </section>;
}
