let status = { ready: false, update: false, failed: false };
const listeners = new Set();
let registration;
let started = false;
let reloadAfterUpdate = false;

export const getPwaStatus = () => status;
export function subscribePwa(listener) {
    listeners.add(listener);
    listener(status);
    return () => listeners.delete(listener);
}
function publish(change) {
    status = { ...status, ...change };
    listeners.forEach(listener => listener(status));
}
function watchRegistration(current) {
    registration = current;
    const watch = worker => {
        if (!worker) return;
        worker.addEventListener('statechange', () => {
            if (worker.state === 'installed') publish({ update: !!current.waiting && !!navigator.serviceWorker.controller });
            if (worker.state === 'redundant' && !navigator.serviceWorker.controller) publish({ failed: true });
        });
    };
    watch(current.installing);
    current.addEventListener('updatefound', () => watch(current.installing));
    publish({ update: !!current.waiting && !!navigator.serviceWorker.controller });
}
async function register() {
    const existing = await navigator.serviceWorker.getRegistration('/');
    if (existing?.active) {
        watchRegistration(existing);
        publish({ ready: true, failed: false });
        existing.active.postMessage({ type: 'CLAIM_CLIENTS' });
        // Reopening offline uses the installed shell without a network registration.
        if (navigator.onLine === false) return;
    }
    const current = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
    watchRegistration(current);
    const active = await navigator.serviceWorker.ready;
    // A navigation during the first install can miss the activation's claim.
    active.active?.postMessage({ type: 'CLAIM_CLIENTS' });
    publish({ ready: true, failed: false });
}
export function startPwa() {
    // Embedded reviews use their own memory store and never control the host page.
    if (started || !('serviceWorker' in navigator) || window.self !== window.top) return;
    started = true;
    window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); window.vgInstallPrompt = event; });
    window.addEventListener('appinstalled', () => { window.vgInstallPrompt = null; window.vgInstalled = true; });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        publish({ ready: true, update: false });
        if (reloadAfterUpdate) window.location.reload();
    });
    register().catch(() => { if (!status.ready) publish({ failed: true }); });
    window.addEventListener('online', () => {
        if (registration && status.ready) registration.update().catch(() => {});
        else register().catch(() => { if (!status.ready) publish({ failed: true }); });
    });
}
export function applyPwaUpdate() {
    if (!registration?.waiting) return;
    reloadAfterUpdate = true;
    registration.waiting.postMessage({ type: 'APPLY_UPDATE' });
}
