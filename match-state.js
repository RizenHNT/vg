export const SKINS = ['circuit', 'ember', 'forest'];
export const freshMatch = () => ({ turn: 0, elapsedMs: 0, runningSince: null, events: [] });
const number = (value, fallback = 0) => value !== null && Number.isFinite(Number(value)) ? Number(value) : fallback;
export function normalizeMatch(raw) {
    if (!raw || typeof raw !== 'object') return freshMatch();
    const kinds = ['attack','undo','call','ride','retire','turn','end','trigger','guard','timer'];
    return {
        turn: Math.max(0, Math.trunc(number(raw.turn))),
        elapsedMs: Math.max(0, number(raw.elapsedMs)),
        runningSince: raw.runningSince == null || !Number.isFinite(Number(raw.runningSince)) || Number(raw.runningSince)<=0 ? null : Number(raw.runningSince),
        events: (Array.isArray(raw.events) ? raw.events : []).filter(event => event && kinds.includes(event.kind)).slice(-24).map(event => ({ kind:event.kind, slot:String(event.slot || '').slice(0,30), value:number(event.value), at:Math.max(0,number(event.at)), turn:Math.max(0,Math.trunc(number(event.turn))) })),
    };
}
export const elapsedMatch = (match, now = Date.now()) => match.elapsedMs + (match.runningSince == null ? 0 : Math.max(0, now - match.runningSince));
export const pauseMatch = (match, now = Date.now()) => ({ ...match, elapsedMs:elapsedMatch(match,now), runningSince:null });
export const toggleMatchTimer = (match, now = Date.now()) => match.runningSince == null ? { ...match, runningSince:now } : pauseMatch(match,now);
export function addMatchEvent(match, event, now = Date.now()) {
    return normalizeMatch({ ...match, events:[...match.events,{ ...event, at:now, turn:match.turn }] });
}
export function formatDuration(ms) {
    const seconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(seconds / 60), hours = Math.floor(minutes / 60);
    return hours ? `${hours}:${String(minutes % 60).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}` : `${String(minutes).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`;
}
