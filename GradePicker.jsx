import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X, Minus, Plus } from 'lucide-react';

// Shortcuts set card presets; the stepper deliberately changes only grade.
export default function GradePicker({ slot, unit, anchor, t, onSelect, onStep, onClose }) {
    const [zeroOptions, setZeroOptions] = useState(false);
    const [position, setPosition] = useState({ left:8, top:8, width:Math.min(304, window.innerWidth - 16) });
    const dialogRef = useRef(null), hold = useRef(null), suppressClick = useRef(false);
    const closeRef = useRef(onClose); closeRef.current = onClose;
    const clearHold = () => { clearTimeout(hold.current?.timer); hold.current = null; };
    useLayoutEffect(() => {
        const place = () => {
            const width = Math.min(304, window.innerWidth - 16);
            const height = dialogRef.current?.getBoundingClientRect().height || 0;
            const next = { width, left:Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8)), top:Math.max(8, Math.min(anchor.bottom + 4, window.innerHeight - height - 8)) };
            setPosition(previous => previous.width===next.width && previous.left===next.left && previous.top===next.top ? previous : next);
        };
        place(); window.addEventListener('resize',place);
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
        if (dialogRef.current) observer?.observe(dialogRef.current);
        return () => { window.removeEventListener('resize',place); observer?.disconnect(); };
    }, [anchor.left, anchor.bottom]);
    useEffect(() => {
        const previous = document.activeElement;
        (dialogRef.current?.querySelector(`[data-grade="${unit.grade}"]`) || dialogRef.current?.querySelector('[data-testid="grade-up"]'))?.focus();
        const outside = event => {
            if (!dialogRef.current?.contains(event.target) && !event.target.closest?.('[data-grade-toggle]')) closeRef.current();
        };
        const key = event => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); closeRef.current(); }
            if (event.key === 'Tab') {
                const controls = [...(dialogRef.current?.querySelectorAll('button:not(:disabled),input') || [])];
                if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
                else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
            }
        };
        document.addEventListener('pointerdown', outside);
        document.addEventListener('keydown', key, true);
        return () => { clearHold(); document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key, true); previous?.focus(); };
    }, []);
    const apply = (grade, power) => { onSelect(slot, grade, power); onClose(); };
    const revealZero = () => { suppressClick.current = true; setZeroOptions(true); };
    return <div ref={dialogRef} role="dialog" aria-label={t.edit_grade} className="grade-picker grade-quick-picker" style={position} data-testid="grade-picker" onClick={e => e.stopPropagation()}>
        <div className="grade-picker-heading"><span>{t.edit_grade}</span><div className="grade-stepper">
            <button type="button" data-testid="grade-down" aria-label={t.grade_down} disabled={unit.grade <= 0} onClick={() => onStep(slot, -1)}><Minus size={15}/></button>
            <output aria-live="polite" data-testid="grade-current">{unit.grade}</output>
            <button type="button" data-testid="grade-up" aria-label={t.grade_up} disabled={unit.grade >= 99} onClick={() => onStep(slot, 1)}><Plus size={15}/></button>
        </div><button type="button" aria-label={t.close} onClick={onClose}><X size={16}/></button></div>
        <div className="grade-options">{[0, 1, 2, 3, 4, 10, 11].map(grade => <button type="button" key={grade} data-grade={grade} aria-pressed={unit.grade === grade}
            title={grade === 0 ? t.grade_zero_hint : undefined} aria-describedby={grade === 0 ? 'grade-zero-hint' : undefined}
            aria-expanded={grade === 0 ? zeroOptions : undefined} aria-controls={grade === 0 ? 'grade-zero-options' : undefined}
            onPointerDown={grade === 0 ? event => {
                if (event.button !== 0) return;
                clearHold(); suppressClick.current = false;
                event.currentTarget.setPointerCapture?.(event.pointerId);
                hold.current = { x: event.clientX, y: event.clientY, timer: setTimeout(revealZero, 450) };
            } : undefined}
            onPointerMove={grade === 0 ? event => { if (hold.current && Math.hypot(event.clientX - hold.current.x, event.clientY - hold.current.y) > 10) { clearHold(); suppressClick.current = true; } } : undefined}
            onPointerUp={grade === 0 ? clearHold : undefined}
            onPointerCancel={grade === 0 ? () => { clearHold(); suppressClick.current = true; } : undefined}
            onLostPointerCapture={grade === 0 ? clearHold : undefined}
            onContextMenu={grade === 0 ? event => { event.preventDefault(); clearHold(); revealZero(); } : undefined}
            onKeyDown={grade === 0 ? event => { if (event.key === 'ArrowDown' || (event.shiftKey && event.key === 'F10')) { event.preventDefault(); clearHold(); revealZero(); } } : undefined}
            onClick={event => { if (grade === 0 && suppressClick.current && event.detail !== 0) { suppressClick.current = false; return; } suppressClick.current = false; apply(grade); }}><b>{grade}</b></button>)}</div>
        <p id="grade-zero-hint" className="grade-hint">{t.grade_zero_hint}</p>
        {zeroOptions && <div id="grade-zero-options" className="grade-zero-options" data-testid="grade-zero-options"><span>{t.printed_power}</span>{[5000, 6000].map(power => <button type="button" key={power} data-zero-power={power} onClick={() => apply(0, power)}>{power.toLocaleString()}</button>)}</div>}
        <p className="grade-step-hint">{t.grade_step_hint}</p>
    </div>;
}
