import React, { useLayoutEffect, useRef, useState } from 'react';

const RUNES = Array.from({length:40},(_,i)=>i*9);
const SPOKES = Array.from({length:12},(_,i)=>i*30);
export const SummonSeal = React.memo(function SummonSeal({ inner=false }) {
    return <svg className="summon-seal" viewBox="0 0 240 240" fill="none" aria-hidden="true" focusable="false">
        <circle cx="120" cy="120" r="111" strokeWidth="1.5"/><circle cx="120" cy="120" r="104" strokeWidth=".7"/>
        <circle cx="120" cy="120" r="82" strokeWidth="1.2" strokeDasharray={inner?'8 4':'56 8 4 8'}/>
        <circle cx="120" cy="120" r="75" strokeWidth=".6"/>
        {RUNES.map((angle,i)=><path key={angle} transform={`rotate(${angle} 120 120)`} strokeWidth={i%3===0?1.8:1.1} d={['M117 17V27H123V22H118M124 17V20','M117 17H123L118 27M122 24H125','M117 17V26L123 21V17M120 24H125','M116 19H124M118 16V27M123 22V27'][i%4]}/>)}
        {SPOKES.map((angle,i)=><g key={angle} transform={`rotate(${angle} 120 120)`}><path d="M120 31V38M114 36L120 41L126 36M120 43V47M118 55L120 51L122 55L120 59Z"/><path opacity=".5" d={inner?'M104 49L120 67L136 49':'M102 49L120 42L138 49L136 57L120 63L104 57Z'}/>{i%3===0&&<path strokeWidth="2" d="M110 2L120 9L130 2M120 0V12"/>}</g>)}
        <path opacity=".55" strokeWidth=".6" d={inner?'M120 48L182 156H58ZM120 192L58 84H182Z':'M120 44L186 158H54ZM120 196L54 82H186Z'}/>
    </svg>;
});

export function NeonOrbit() {
    return <span className="neon-orbit" aria-hidden="true"><i className="neon-aura"/><i className="neon-stream"/><span className="neon-runes"><SummonSeal/></span><span className="neon-runes neon-runes-inner"><SummonSeal inner/></span><i className="neon-pulse"/><i className="neon-pulse neon-pulse-second"/>{SPOKES.filter((_,i)=>i%2===0).map((angle,i)=><i key={angle} className="neon-star" style={{'--spark-angle':angle+'deg','--spark-delay':i*-.4+'s'}}/>)}</span>;
}

export function SummonSequence({effect,t}) {
    return <span className={'combat-effect summon-sequence fx-'+effect.kind} data-testid={'fx-'+effect.kind} aria-hidden="true">
        <i className="summon-atmosphere"/><span className="summon-floor"><span className="summon-disc"><SummonSeal/></span><span className="summon-disc summon-disc-inner"><SummonSeal inner/></span></span>
        <i className="summon-beam"/><i className="summon-beam summon-beam-thin"/><i className="summon-impact"/>
        {SPOKES.map((angle,i)=><i className="summon-shard" key={angle} style={{'--spark-angle':angle+'deg','--spark-delay':(i%4)*.035+'s','--shard-distance':(46+i%3*14)+'px'}}/>)}
        <svg className="summon-slash" viewBox="0 0 240 240"><path d="M20 207Q119 93 222 34Q123 126 74 208L147 92Z"/></svg>
        <span className="summon-caption">{t['event_'+effect.kind] || t.ot}</span>
    </span>;
}

export function BattleSpells({ effects, units, t }) {
    const ref=useRef(null),[positions,setPositions]=useState({});
    const otSlots=Object.keys(units).filter(slot=>units[slot].otActive);
    const signature=[...new Set([...otSlots,...effects.flatMap(effect=>effect.slots)])].sort().join(',');
    useLayoutEffect(()=>{
        const root=ref.current?.parentElement;
        if(!root)return;
        const measure=()=>{
            const bounds=root.getBoundingClientRect(), next={};
            for(const slot of signature.split(',').filter(Boolean)){
                const circle=root.querySelector(`[data-slot="${slot}"] .unit-circle`);
                if(!circle)continue;
                const box=circle.getBoundingClientRect();
                next[slot]={left:box.left-bounds.left,top:box.top-bounds.top,width:box.width,height:box.height};
            }
            setPositions(current=>JSON.stringify(current)===JSON.stringify(next)?current:next);
        };
        measure();window.addEventListener('resize',measure);
        const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure);observer?.observe(root);
        return()=>{window.removeEventListener('resize',measure);observer?.disconnect();};
    },[signature]);
    return <div ref={ref} className="battle-spells" aria-hidden="true">
        {otSlots.map(slot=>positions[slot]&&<div key={slot} data-testid={'neon-'+slot} className="spell-anchor ot-anchor" style={positions[slot]}><NeonOrbit/></div>)}
        {effects.flatMap(effect=>effect.slots.map(slot=>positions[slot]&&<div key={effect.id+'-'+slot} data-effect-slot={slot} className="spell-anchor action-anchor" style={positions[slot]}><SummonSequence effect={effect} t={t}/></div>))}
    </div>;
}
