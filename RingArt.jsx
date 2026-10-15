import React from 'react';

// Shared art keeps the skin selector an accurate miniature of the actual field.
export const RingArt = React.memo(function RingArt({ skin = 'circuit' }) {
    if (skin === 'circuit') return <span className="ring-engraving ring-circuit"/>;
    return <svg className={'ring-engraving ring-'+skin} viewBox="0 0 160 160" fill="none" aria-hidden="true" focusable="false">
        {skin === 'ember' ? <>
            <path className="ring-secondary" d="M80 6 144 43 144 117 80 154 16 117 16 43Z M80 17 134 49 134 111 80 143 26 111 26 49Z"/>
            <circle cx="80" cy="80" r="51" strokeDasharray="47 7 9 7"/>
            <circle className="ring-secondary" cx="80" cy="80" r="44"/>
            {Array.from({ length: 6 }, (_, i) => <g key={i} transform={`rotate(${i*60} 80 80)`}><path d="M66 18 73 29 73 36 80 30 87 36 87 29 94 18M70 24 80 12 90 24M80 39V46"/><path className="ring-filled" d="m78 6 2-4 2 4-2 4Z"/></g>)}
            {Array.from({ length: 18 }, (_, i) => <path className="ring-secondary" key={i} transform={`rotate(${i*20} 80 80)`} d="M78 20h4v5h-4Z"/>)}
        </> : <>
            <circle className="ring-secondary" cx="80" cy="80" r="71" strokeDasharray="2 6"/>
            <circle cx="80" cy="80" r="56"/><circle className="ring-secondary" cx="80" cy="80" r="48"/>
            {Array.from({ length: 8 }, (_, i) => <g key={i} transform={`rotate(${i*45} 80 80)`}><path d="M80 9C61 25 63 35 80 41C97 35 99 25 80 9ZM80 13V37M80 42V48"/><path className="ring-secondary" d="M53 18Q67 33 60 48M107 18Q93 33 100 48"/><path className="ring-filled" d="m78 4 2-3 2 3-2 3Z"/></g>)}
        </>}
    </svg>;
});

export const FieldRing = React.memo(function FieldRing({ skin, vanguard }) {
    return <span aria-hidden="true" className={'unit-circle '+(vanguard?'circle-vanguard':'circle-rearguard')}>
        <span className="circle-art"><RingArt skin={skin}/></span>
        <span className="circle-unfold"><RingArt skin={skin}/></span>
        <span className="circle-spectrum"/>
    </span>;
});
