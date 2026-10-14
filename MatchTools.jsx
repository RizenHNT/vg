import React, { useEffect, useRef, useState } from 'react';
import { Clock3, Pause, Play, RotateCcw, Sparkles, X } from 'lucide-react';
import { elapsedMatch, formatDuration, SKINS } from './match-state.js';

function useDialogFocus(ref, onClose) {
    const closeRef=useRef(onClose);closeRef.current=onClose;
    useEffect(() => {
        const previous = document.activeElement, overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        ref.current?.querySelector('[data-safe-cancel]')?.focus();
        const key = event => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); closeRef.current(); }
            if (event.key === 'Tab') {
                const controls = [...(ref.current?.querySelectorAll('button:not([disabled]),input') || [])];
                if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
                else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
            }
        };
        document.addEventListener('keydown',key,true);
        return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown',key,true); previous?.focus(); };
    }, []);
}

export function MatchPanel({ match, resources, canRestore, t, onTimer, onReset, onRestore, onCounter }) {
    const [now, setNow] = useState(Date.now);
    useEffect(() => {
        if (match.runningSince == null) return;
        const timer = setInterval(() => setNow(Date.now()),1000);
        return () => clearInterval(timer);
    }, [match.runningSince]);
    const labels = {front_left:t.front_l,front_center:t.vanguard,front_right:t.front_r,back_left:t.back_l,back_center:t.back_c,back_right:t.back_r};
    return <section className="match-panel" aria-label={t.match_tools} data-testid="match-panel">
        <div className="match-panel-heading"><h2><Clock3 size={13}/>{t.match_tools}</h2><span className="match-turn" data-testid="match-turn">{match.turn ? `${t.turn_number} ${match.turn}` : t.not_started}</span><output data-testid="match-time" aria-label={t.timer_hint}>{formatDuration(elapsedMatch(match,now))}</output></div>
        <div className="match-quick-counters">{[['damage',t.damage_counter],['soul',t.soul_counter]].map(([key,label]) => <div key={key} className="match-counter"><span>{label}</span><button type="button" aria-label={`${label} −1`} disabled={resources[key]===0} onClick={()=>onCounter(key,-1)}>−</button><output data-testid={'match-'+key}>{resources[key]}</output><button type="button" aria-label={`${label} +1`} onClick={()=>onCounter(key,1)}>+</button></div>)}</div>
        <div className="match-actions"><button type="button" data-testid="timer-toggle" onClick={onTimer}>{match.runningSince == null ? <Play size={12}/> : <Pause size={12}/>}<span>{match.runningSince == null ? t.timer_start : t.timer_pause}</span></button><button type="button" data-testid="match-reset" className="match-reset-button" onClick={onReset}><RotateCcw size={12}/><span>{t.match_reset}</span></button></div>
        {canRestore && <div className="match-restore-row"><span>{t.undo_available}</span><button type="button" data-testid="match-restore" onClick={onRestore}>{t.match_restore}</button></div>}
        <details className="match-log"><summary>{t.recent_actions}<span>{match.events.length}</span></summary>{match.events.length ? <ol>{[...match.events].reverse().slice(0,6).map((event,index)=><li key={event.at+'-'+index}><span>{t['event_'+event.kind]}{labels[event.slot] ? ` · ${labels[event.slot]}` : ''}</span><b>{event.value ? event.value.toLocaleString() : '—'}</b></li>)}</ol> : <p>{t.empty_log}</p>}</details>
    </section>;
}

export function MatchResetDialog({ mode, t, onClose, onConfirm }) {
    const [confirmed,setConfirmed]=useState(false), ref=useRef(null);
    useDialogFocus(ref,onClose);
    const restoring=mode==='restore';
    return <div className="match-modal-backdrop" onClick={onClose}><form ref={ref} className="match-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="match-confirm-title" aria-describedby="match-confirm-description" data-testid="match-confirm-dialog" onClick={event=>event.stopPropagation()} onSubmit={event=>{event.preventDefault();if(confirmed)onConfirm();}}>
        <div className="match-confirm-heading"><h2 id="match-confirm-title">{restoring?t.restore_title:t.reset_title}</h2><button type="button" aria-label={t.close} onClick={onClose}><X size={18}/></button></div>
        <p id="match-confirm-description">{restoring?t.restore_description:t.reset_description}</p>
        <label className="match-confirm-check"><input type="checkbox" data-testid="match-reset-ack" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/><span>{restoring?t.restore_ack:t.reset_ack}</span></label>
        <div className="match-confirm-actions"><button type="button" data-safe-cancel data-testid="match-reset-cancel" onClick={onClose}>{t.cancel}</button><button type="submit" data-testid="match-reset-confirm" disabled={!confirmed}>{restoring?t.restore_confirm:t.reset_confirm}</button></div>
    </form></div>;
}

export function AppearanceControls({ skin, effects, t, onSkin, onEffects }) {
    return <section className="appearance-controls" aria-label={t.appearance}>
        <h3><Sparkles size={13}/>{t.appearance}</h3>
        <div className="skin-options">{SKINS.map(name=><button type="button" key={name} data-testid={'skin-'+name} data-swatch={name} aria-pressed={skin===name} onClick={()=>onSkin(name)}><i aria-hidden="true"/><span>{t['skin_'+name]}</span></button>)}</div>
        <label className="effects-toggle"><input type="checkbox" data-testid="effects-toggle" checked={effects} onChange={event=>onEffects(event.target.checked)}/><span>{t.effects_toggle}</span></label>
        <p>{t.effects_note}</p>
    </section>;
}

export function CombatEffect({ effect, t }) {
    return <span className={'combat-effect fx-'+effect.kind} aria-hidden="true" data-testid={'fx-'+effect.kind}>
        <i className="fx-orbit"/><i className="fx-orbit fx-orbit-second"/><i className="fx-sweep"/>
        <span className="fx-caption">{t['event_'+effect.kind] || t.ot}</span>
    </span>;
}

export function RizenSecret({ t, onClose }) {
    const ref=useRef(null);useDialogFocus(ref,onClose);
    return <div className="match-modal-backdrop secret-backdrop" onClick={onClose}><div ref={ref} role="dialog" aria-modal="true" aria-label="Rizen" className="rizen-secret" data-testid="rizen-secret" onClick={event=>event.stopPropagation()}>
        <div className="rizen-constellation" aria-hidden="true"><svg viewBox="0 0 240 180"><path d="M24 138 66 32 116 68 158 18 213 126 116 68 125 155 24 138M66 32 158 18M213 126 125 155"/><g>{[[24,138],[66,32],[116,68],[158,18],[213,126],[125,155]].map(([x,y])=><circle key={x} cx={x} cy={y} r="3"/>)}</g></svg></div>
        <span className="rizen-secret-code">VG · 0x52495A454E</span><h2>Rizen</h2><p>STAND UP · KEEP FIGHTING</p><button type="button" data-safe-cancel onClick={onClose}>{t.secret_close}</button>
    </div></div>;
}
