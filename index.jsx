import './styles.css';
import './drawer-enhancements.css';
import './match-upgrade.css';
import './ring-design.css';
import './summon-art.css';
import { BattleSpells } from './SpellArt.jsx';
import GradePicker from './GradePicker.jsx';
import { FieldRing } from './RingArt.jsx';
import { AppearanceControls, MatchPanel, MatchResetDialog, RizenSecret } from './MatchTools.jsx';
import { MATCH_COPY } from './match-copy.js';
import { SKINS, freshMatch, normalizeMatch, addMatchEvent, pauseMatch, toggleMatchTimer } from './match-state.js';
import { PwaTools, PwaUpdateNotice } from './PwaTools.jsx';
import { startPwa } from './pwa-runtime.js';
import React, { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from 'react';
import {
    Sword, Zap, RotateCcw, X, Settings2, Dices, CircleDollarSign, ChevronDown,
    Trash2, Move, Shield, Ghost, AlertTriangle, Layers, Crown, CornerUpLeft, Anchor, Plus, Minus, Globe, Users, ChevronsUp,
    RefreshCcw, // 新增的图标，用于回合重置
} from 'lucide-react';

// --- Constants & Data ---
const MAX_ENERGY = 10;
const STORAGE_KEY = 'VG_COMBAT_STATE_V20_LOCAL'; // 正式站沿用现有存档；嵌入预览使用独立内存存储


const INITIAL_UNIT = {
    basePower: 0,
    powerBuff: 0,
    crit: 1,
    isVanguard: false,
    isRested: false,
    isSupporting: false,
    isBackRowAttack: false, // 新增：后排可以攻击的模式标记
    grade: 0,
    // 新增：状态标记
    otActive: false,
    hasBoost: true,
    shield: 5000,
    shieldBuff: 0,
    hasIntercept: false,      // 截击
    hasDoubleStrike: false,   // 双判
    hasTripleStrike: false,   // 三判
};

// 新增：定义 OT 修正值
const OT_BUFF_VALUE = 100000000;

// Editable shortcuts for this calculator, not universal printed card powers.
const DEFAULT_GRADE_PRESETS = [6000, 8000, 10000, 13000, 28000];
const REAR_GRADE_ZERO_POWER = 5000;
// Editable card shortcuts; retain explicit printed shield values in old saves.
const GRADE_SHIELD_PRESETS = [5000, 5000, 5000];
// Official printed values: Griphogila and Vartex both have Twin Drive.
const SPECIAL_UNIT_PRESETS = [{ grade:10, power:13000, name:'dragontree' }, { grade:11, power:18000, name:'vartex' }];
const SHIELD_PRESETS = [0, 5000, 10000, 15000, 20000, 25000, 30000, 50000].map(val => ({ val, label: val ? `${val / 1000}k` : '0' }));
const gradeShield = grade => GRADE_SHIELD_PRESETS[grade] ?? 0;
const LEGACY_GRADE_PRESETS = [5000, 8000, 10000, 13000];
let GRADE_PRESETS = [...DEFAULT_GRADE_PRESETS];

// Function: Automatically detect current GRADE from basePower
// Returns the highest index i such that GRADE_PRESETS[i] <= basePower.
// If basePower is lower than the first preset, returns 0.
const detectGradeFromPower = (basePower) => {
    if (!basePower || GRADE_PRESETS.length === 0) return 0;
    let idx = 0;
    for (let i = 0; i < GRADE_PRESETS.length; i++) {
        if (basePower >= GRADE_PRESETS[i]) idx = i;
        else break;
    }
    return idx;
};

const BASE_PRESETS = [
    { val: 5000, label: '5k' },
    { val: 6000, label: '6k' },
    { val: 8000, label: '8k' },
    { val: 10000, label: '10k' },
    { val: 13000, label: '13k' },
    { val: 15000, label: '15k' },
    { val: 18000, label: '18k' },
    { val: 23000, label: '23k' },
    { val: 26000, label: '26k' },
    { val: 28000, label: '28k' },
];

// 调整：移除了 OT 按钮，并新增了 -10k 和 -15k 按钮以完成 3x2 的网格
const POS_NEG_BUFF_BUTTONS = [
    // Top Row (Positive)
    { label_zh: '+5k', label_en: '+5k', label_ja: '+5k', value: 5000, color: 'bg-blue-600/20 text-blue-400 border-blue-500/50' },
    { label_zh: '+10k', label_en: '+10k', label_ja: '+10k', value: 10000, color: 'bg-indigo-600/20 text-indigo-400 border-indigo-500/50' },
    { label_zh: '+15k', label_en: '+15k', label_ja: '+15k', value: 15000, color: 'bg-purple-600/20 text-purple-400 border-purple-500/50' },
    // Bottom Row (Negative)
    { label_zh: '-5k', label_en: '-5k', label_ja: '-5k', value: -5000, color: 'bg-red-600/20 text-red-400 border-red-500/50' },
    { label_zh: '-10k', label_en: '-10k', label_ja: '-10k', value: -10000, color: 'bg-red-600/20 text-red-400 border-red-500/50' },
    { label_zh: '-15k', label_en: '-15k', label_ja: '-15k', value: -15000, color: 'bg-red-600/20 text-red-400 border-red-500/50' },
];

const SHIELD_ACTIONS = [
    { val: 5000, label_zh: '+5k', label_en: '+5k', label_ja: '+5k', color: 'bg-blue-800/40 text-blue-300' },
    { val: 10000, label_zh: '+10k', label_en: '+10k', label_ja: '+10k', color: 'bg-blue-800/40 text-blue-300' },
    { val: 15000, label_zh: '+15k', label_en: '+15k', label_ja: '+15k', color: 'bg-blue-800/40 text-blue-300' },
    { val: 25000, label_zh: '+25k', label_en: '+25k', label_ja: '+25k', color: 'bg-blue-800/40 text-blue-300' },
    { val: 50000, label_zh: '+50k', label_en: '+50k', label_ja: '+50k', color: 'bg-blue-800/40 text-blue-300' },
    { val: -5000, label_zh: '-5k', label_en: '-5k', label_ja: '-5k', color: 'bg-red-900/40 text-red-400' },
    { val: -10000, label_zh: '-10k', label_en: '-10k', label_ja: '-10k', color: 'bg-red-900/40 text-red-400' },
    { val: -15000, label_zh: '-15k', label_en: '-15k', label_ja: '-15k', color: 'bg-red-900/40 text-red-400' }, // 新增 -15k
];

const ENERGY_ACTIONS = [
    { label_zh: '+1', label_en: '+1', label_ja: '+1', value: 1, color: 'bg-cyan-900/40 text-cyan-400' },
    { label_zh: '+2', label_en: '+2', label_ja: '+2', value: 2, color: 'bg-cyan-900/40 text-cyan-400' },
    { label_zh: '+3 (EN)', label_en: '+3 (EN)', label_ja: '+3 (EN)', value: 3, color: 'bg-cyan-900/40 text-cyan-400' },
    { label_zh: '+5', label_en: '+5', label_ja: '+5', value: 5, color: 'bg-cyan-900/40 text-cyan-400' },
    { label_zh: '-1', label_en: '-1', label_ja: '-1', value: -1, color: 'bg-slate-800 text-slate-400' },
    { label_zh: '清零', label_en: 'Reset', label_ja: 'リセット', value: -100, color: 'bg-red-900/20 text-red-400' },
];

const INITIAL_BOARD = {
    front_left: { ...INITIAL_UNIT },
    front_center: { ...INITIAL_UNIT, isVanguard: true, grade: 0, basePower: GRADE_PRESETS[0] },
    front_right: { ...INITIAL_UNIT },
    back_left: { ...INITIAL_UNIT },
    back_center: { ...INITIAL_UNIT },
    back_right: { ...INITIAL_UNIT },
};

// 1. 更新 INITIAL_RESOURCES 以包含详细触发器计数，并移除 triggersRemaining
const INITIAL_RESOURCES = {
    soul: 0,
    damage: 0,
    shield: 0,
    critTriggers: 4,
    drawTriggers: 4,
    frontTriggers: 3,
    healTriggers: 4,
    sentinelsRemaining: 4,
    sentinelActive: false,
    otTriggers: 1, // 新增：Over Trigger (OT) 计数
};

const INITIAL_GAME_STATE = {
    units: INITIAL_BOARD,
    energy: 0,
    resources: INITIAL_RESOURCES,
    extraCounters: [{ name: '', value: 0 }],
    attackCount: 0,
    attackHistory: [],
    isMultiSupportMode: false,
    supportSlots: [],
    allowBackIntercept: false,
    guardSlots: [],
    opponentPower: null,
    pendingTrigger: null,
    match: freshMatch(),
    skin: 'circuit',
    effects: true,
    resetBackup: null,
};

// Sanitize legacy saves before rendering. Every slot must have numeric fields.
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) && value !== null ? Number(value) : fallback;
const getSafePower = unit => finite(unit?.basePower) + finite(unit?.powerBuff);
const getUnitShield = unit => Math.max(0, finite(unit?.shield) + finite(unit?.shieldBuff));
const canSelectFreeSupport = (slot, units, guardSlots = []) => {
    const unit = units[slot];
    return slot !== 'front_center' && !!unit && (slot.startsWith('front_') || unit.hasBoost) && !unit.isRested && getSafePower(unit) > 0 && !guardSlots.includes(slot);
};
const normalizeState = (raw = {}) => {
    if (!raw || typeof raw !== 'object') raw = {};
    // Keep displayed values when returning from the discarded redesign.
    if (raw.version === 3) {
        const persona = Math.max(0, finite(raw.personaBonus));
        raw = { ...raw, version: 2, personaBonus: 0, history: undefined,
            units: Object.fromEntries(Object.entries(raw.units || {}).map(([slot, unit]) => [slot,
                unit && typeof unit === 'object' ? { ...unit, powerBuff: finite(unit.powerBuff) + (slot.startsWith('front') && unit.present !== false && (unit.basePower || unit.powerBuff) ? persona : 0) } : unit
            ])) };
    }

    const units = Object.fromEntries(Object.entries(INITIAL_BOARD).map(([slot, initial]) => {
        const candidate = raw.units?.[slot];
        const unit = { ...initial, ...(candidate && typeof candidate === 'object' ? candidate : {}) };
        for (const key of ['basePower', 'powerBuff', 'crit', 'grade', 'shieldBuff']) unit[key] = finite(unit[key], initial[key]);
        unit.grade = Math.min(99, Math.max(0, Math.trunc(unit.grade)));
        unit.shield = Math.max(0, finite(candidate?.shield, gradeShield(unit.grade)));
        unit.hasBoost = candidate?.hasBoost === undefined ? unit.grade <= 1 : candidate.hasBoost === true;
        if (candidate?.hasIntercept === undefined) unit.hasIntercept = unit.grade === 2 && slot !== 'front_center';
        unit.crit = Math.max(0, unit.crit);
        for (const key of ['isRested', 'isSupporting', 'isBackRowAttack', 'hasIntercept', 'hasDoubleStrike', 'hasTripleStrike', 'otActive']) unit[key] = unit[key] === true;
        if (unit.hasTripleStrike) unit.hasDoubleStrike = false;
        unit.isVanguard = slot === 'front_center';
        return [slot, unit];
    }));
    const resources = { ...INITIAL_RESOURCES, ...raw.resources };
    for (const key of Object.keys(INITIAL_RESOURCES)) {
        resources[key] = key === 'sentinelActive' ? !!resources[key] : Math.max(0, finite(resources[key], INITIAL_RESOURCES[key]));
    }
    const extraCounters = Array.isArray(raw.extraCounters) ? raw.extraCounters.filter(c => c && typeof c === 'object').map(c => ({ name: String(c.name ?? ''), value: finite(c.value) })) : [{ name: '', value: 0 }];
    if (!raw.resourceCountersMigrated && raw.resources) {
        const names = raw.language === 'ja' ? ['ソウル', 'ダメージ', 'クリティカル', 'ドロー', 'フロント', 'ヒール', 'オーバー'] : raw.language === 'en' ? ['Soul', 'Damage', 'Critical triggers', 'Draw triggers', 'Front triggers', 'Heal triggers', 'Over triggers'] : ['魂', '伤害', '暴击触发', '抽牌触发', '前列触发', '治疗触发', '超触发'];
        ['soul', 'damage', 'critTriggers', 'drawTriggers', 'frontTriggers', 'healTriggers', 'otTriggers'].forEach((key, index) => {
            if (raw.resources[key] !== undefined && resources[key] !== INITIAL_RESOURCES[key]) extraCounters.push({ name: names[index], value: resources[key] });
        });
    }
    return { ...INITIAL_GAME_STATE, ...raw, units, resources,
        match: normalizeMatch(raw.match),
        skin: SKINS.includes(raw.skin) ? raw.skin : 'circuit',
        effects: raw.effects !== false,
        resetBackup: raw.resetBackup?.state && typeof raw.resetBackup.state === 'object' && raw.resetBackup.state.units ? { state:{ ...raw.resetBackup.state, resetBackup:null }, savedAt:finite(raw.resetBackup.savedAt), resume:raw.resetBackup.resume === true } : null,
        energy: Math.max(0, Math.min(MAX_ENERGY, finite(raw.energy))),
        attackCount: Math.max(0, finite(raw.attackCount)),
        opponentPower: raw.opponentPower == null ? null : Math.max(0, finite(raw.opponentPower)),
        allowBackIntercept: raw.allowBackIntercept === true,
        isMultiSupportMode: raw.isMultiSupportMode === true,
        supportSlots: raw.isMultiSupportMode === true ? [...new Set((Array.isArray(raw.supportSlots) ? raw.supportSlots : Object.keys(units).filter(slot => units[slot].isSupporting)).filter(slot => canSelectFreeSupport(slot, units, Array.isArray(raw.guardSlots) ? raw.guardSlots : [])))] : [],
        guardSlots: [...new Set(Array.isArray(raw.guardSlots) ? raw.guardSlots.filter(slot => slot !== 'front_center' && Object.hasOwn(units, slot) && units[slot].basePower + units[slot].powerBuff > 0) : [])],
        extraCounters, resourceCountersMigrated: true,
        pendingTrigger: ['critical', 'draw', 'heal', 'over'].includes(raw.pendingTrigger?.kind) && ['power', 'critical'].includes(raw.pendingTrigger?.stage)
            ? { kind: raw.pendingTrigger.kind, stage: raw.pendingTrigger.kind === 'critical' ? raw.pendingTrigger.stage : 'power', beforeUnits: normalizeState({ units: raw.pendingTrigger.beforeUnits || units }).units }
            : null,
        attackHistory: Array.isArray(raw.attackHistory) ? raw.attackHistory.filter(h => h && h.units).slice(-100).map(h => ({ units: normalizeState({ units: h.units }).units, attackCount: finite(h.attackCount), isMultiSupportMode: h.isMultiSupportMode === true, supportSlots: Array.isArray(h.supportSlots) ? h.supportSlots.filter(slot => slot !== 'front_center' && Object.hasOwn(INITIAL_BOARD, slot)) : [] })) : [],
    };
};
const cloneUnits = (units) => Object.fromEntries(Object.entries(units).map(([key, unit]) => [key, { ...unit }]));

const formatNumber = (num) => {
    if (num === 0) return '0';
    // 检查是否是 OT 力量值，如果是则显示完整的 100,000,000
    if (num === OT_BUFF_VALUE) return (100000000).toLocaleString();
    return num.toLocaleString();
};

function RollingDigits({ value, resetKey = '' }) {
    const formatted = formatNumber(value);
    const [frame, setFrame] = useState({ text: formatted, previous: formatted, value, serial: 0, resetKey });
    if (frame.text !== formatted || frame.resetKey !== resetKey) {
        setFrame({ text: formatted, previous: frame.resetKey === resetKey ? frame.text : formatted, value,
            direction: value >= frame.value ? 'up' : 'down', serial: frame.serial + 1, resetKey });
    }
    const previous = frame.previous.padStart(frame.text.length, ' ').slice(-frame.text.length);
    return <><span className="sr-only">{formatted}</span><span className="rolling-digits" aria-hidden="true">
        {[...frame.text].map((digit, index) => {
            const tone = { '--digit-index':index, '--digit-count':frame.text.length, '--digit-tone':`hsl(${Math.round(330-index/Math.max(1,frame.text.length-1)*280)} 95% 72%)` };
            if (!/\d/.test(digit)) return <span key={index} className="digit-punctuation" style={tone}>{digit}</span>;
            const before = /\d/.test(previous[index]) ? Number(previous[index]) : 0;
            const after = Number(digit);
            const rolling = frame.previous !== frame.text && previous[index] !== digit;
            if (!rolling) return <span key={index} className="digit-static" style={tone}>{digit}</span>;
            const step = frame.direction === 'up' ? 1 : -1;
            const distance = step > 0 ? (after - before + 10) % 10 : (before - after + 10) % 10;
            const steps = 20 + distance;
            const sequence = Array.from({ length: steps + 1 }, (_, i) => (before + step * i + 40) % 10);
            return <span key={index + '-' + frame.serial} className="digit-window" data-rolling="true" style={tone}>
                <span className={'digit-track roll-' + frame.direction} style={{ '--reel-steps': steps }}>
                    {sequence.map((number, i) => <span key={i}>{number}</span>)}
                </span>
            </span>;
        })}
    </span></>;
}

function PowerNumber({ value, className = '', maxSize = 34, resetKey = '' }) {
    const box = useRef(null);
    const text = useRef(null);
    useLayoutEffect(() => {
        const fit = () => {
            if (!box.current || !text.current) return;
            const metrics = getComputedStyle(box.current);
            const boxWidth = box.current.getBoundingClientRect().width || box.current.clientWidth;
            const available = boxWidth - parseFloat(metrics.paddingLeft || 0) - parseFloat(metrics.paddingRight || 0) - parseFloat(metrics.borderLeftWidth || 0) - parseFloat(metrics.borderRightWidth || 0) - 2;
            if (available <= 0) return;
            text.current.style.fontSize = `${maxSize}px`;
            const width = text.current.getBoundingClientRect().width;
            if (width > available) text.current.style.fontSize = `${Math.max(8, Math.floor(maxSize * available / width))}px`;
        };
        fit();
        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
        observer?.observe(box.current);
        let mounted = true;
        document.fonts?.ready.then(() => { if (mounted) fit(); });
        document.fonts?.addEventListener('loadingdone', fit);
        return () => { mounted = false; observer?.disconnect(); document.fonts?.removeEventListener('loadingdone', fit); };
    }); // Refit before paint when a rail or another layout control changes width.
    return <span ref={box} className={`power-fit ${className}`}><span ref={text} className="power-value" style={{ fontSize: maxSize }}><RollingDigits value={value} resetKey={resetKey} /></span></span>;
}

function LivePowerValue({ value, unitKey, className = '', testId = 'drawer-power', maxSize = 32 }) {
    return <output data-testid={testId} data-value={value} aria-live="polite" className={`drawer-live-power ${className}`}><PowerNumber value={value} resetKey={unitKey} maxSize={maxSize} /></output>;
}

const LANGUAGES = [
    { code: 'zh', name: '中文' },
    { code: 'ja', name: '日本語' },
    { code: 'en', name: 'English' },
];

const TRANSLATIONS = {
    zh: {
        app_name: '先导者 OS',
        ride_next: 'Ride 升级',
        turn_start: '回合开始',
        system_booting: '系统启动中...',
        attack: '攻击',
        reset: '重置',
        round_reset: '回合重置', // 新增：回合状态重置
        stand_all: '一键竖置', // 新增：一键竖置
        undo_attack: '撤回',
        unit_adj: '单位调整',
        vanguard: '先导者',
        front_l: '前列 L',
        front_r: '前列 R',
        back_l: '后列 L',
        back_c: '后列 C',
        back_r: '后列 R',
        column_total_solo: '合计 (单)',
        column_total_supporting: '合计 (支)',
        column_total_unsupported: '合计 (未)',
        no_unit: '空',
        attack_solo: '攻击',
        attack_support: '攻击 (Boost)',
        attack_vanguard: '攻击 (V)',
        rest: '横置',
        stand: '站立',
        retire: '退场',
        support_off: '取消',
        support_on: '支援',
        move_mode: '队形',
        move_on: '移动 ON',
        front_buff: '前列 +10k',
        energy: 'EN',
        g_shield: 'G (Shield)',
        opponent_atk: '对手ATK',
        base_diff: '防御基准',
        current_g: '当前 G:',
        required_g_inc: '需 5k:',
        guard_success: '防御成功!',
        g_reset: 'G值清零',
        pg_remaining: 'PG 剩余',
        pg_active: 'PG 激活中',
        pg_button: 'PG',
        pg_off: 'PG 取消', // 新增：PG 取消
        soul: '魂',
        damage: '伤',
        triggers_detailed: '触发计数', // 新增：详细触发器标题
        crit: '暴', // 暴击 (Short form for Trigger Counter)
        draw: '抽', // 抽牌
        front: '前', // 前列
        heal: '治', // 治疗
        base_power_setup: '基础',
        reset_base: '重置基础',
        custom_value: '任意值',
        set_base: '设置',
        power_buff_adj: '修正',
        reset_buff: '重置修正',
        manual_buff: '手动',
        crit_full: '暴击', // 修复：重命名为 crit_full
        add_counter: '+ 添加',
        language: '语言',
        base_short: '基', // Base Power Short
        buff_short: '增', // Buff/Modifier Short (修正)
        extra_counters: '计数器',
        multi_support: '多重支援',
        std_support: '标准',
        ot: 'OT', // 新增：OT (Over Trigger)
        // New Manual Guard Controls
        set_shield_manual: '手动设置 G 值',
        set_shield_button: '设置 G',
        // 新增：状态标记
        boost: '支援',
        intercept: '截击',
        double_strike: '双判',
        triple_strike: '三判',
        edit_grade: '编辑 G',
        add_grade: '新增 G',
        remove_grade: '删除 G',
        back_row_attack_mode: '后排攻击',
    },
    en: {
        app_name: 'VANGUARD OS',
        ride_next: 'Ride next',
        turn_start: 'Turn Start',
        system_booting: 'BOOTING...',
        attack: 'ATK',
        reset: 'RESET',
        round_reset: 'Round Reset',
        stand_all: 'Stand All',
        undo_attack: 'UNDO',
        unit_adj: 'ADJUST',
        vanguard: 'VANGUARD',
        front_l: 'Front L',
        front_r: 'Front R',
        back_l: 'Back L',
        back_c: 'Back C',
        back_r: 'Back R',
        column_total_solo: 'Total (Solo)',
        column_total_supporting: 'Total (Boost)',
        column_total_unsupported: 'Total (No)',
        no_unit: 'Empty',
        attack_solo: 'Attack',
        attack_support: 'Attack(Boost)',
        attack_vanguard: 'Attack(V)',
        rest: 'Rest',
        stand: 'Stand',
        retire: 'Retire',
        support_off: 'Cancel',
        support_on: 'Boost',
        move_mode: 'Move',
        move_on: 'Move ON',
        front_buff: 'Front +10k',
        energy: 'EN',
        g_shield: 'G (Shield)',
        opponent_atk: 'Opp. ATK',
        base_diff: 'Guard Base',
        current_g: 'Current:',
        required_g_inc: 'Need:',
        guard_success: 'SAFE!',
        g_reset: 'Reset G',
        pg_remaining: 'PG Left',
        pg_active: 'PG Active',
        pg_button: 'PG',
        pg_off: 'PG Cancel',
        soul: 'Soul',
        damage: 'Dmg',
        triggers_detailed: 'Trigger Count',
        crit: 'Crit', // (Short form for Trigger Counter)
        draw: 'Draw',
        front: 'Front',
        heal: 'Heal',
        base_power_setup: 'Base',
        reset_base: 'Reset Base',
        custom_value: 'Custom',
        set_base: 'Set',
        power_buff_adj: 'Buff',
        reset_buff: 'Reset Buff',
        manual_buff: 'Manual',
        crit_full: 'Crit', // 修复：重命名为 crit_full
        add_counter: '+ Add',
        language: 'Lang',
        base_short: 'B',
        buff_short: '+',
        extra_counters: 'Counters',
        multi_support: 'Multi-Bst',
        std_support: 'Std',
        ot: 'OT', // 新增：OT (Over Trigger)
        // New Manual Guard Controls
        set_shield_manual: 'Manual Shield Value',
        set_shield_button: 'Set G',
        // 新增：状态标记
        boost: 'Boost',
        intercept: 'Intercept',
        double_strike: 'Double',
        triple_strike: 'Triple',
        edit_grade: 'Edit G',
        add_grade: 'Add G',
        remove_grade: 'Remove G',
        back_row_attack_mode: 'Back Atk',
    },
    ja: {
        app_name: 'ヴァンガード OS',
        ride_next: 'ライド',
        turn_start: 'ターン開始',
        system_booting: '起動中...',
        attack: 'アタック',
        reset: 'リセット',
        round_reset: 'ラウンドリセット',
        stand_all: '全スタンド',
        undo_attack: '取消',
        unit_adj: '調整',
        vanguard: 'ヴァンガード',
        front_l: '前列 L',
        front_r: '前列 R',
        back_l: '後列 L',
        back_c: '後列 C',
        back_r: '後列 R',
        column_total_solo: '合計(単)',
        column_total_supporting: '合計(支)',
        column_total_unsupported: '合計(無)',
        no_unit: 'なし',
        attack_solo: 'アタック',
        attack_support: 'アタック(支)',
        attack_vanguard: 'アタック(V)',
        rest: 'レスト',
        stand: 'スタンド',
        retire: '退却',
        support_off: '解除',
        support_on: 'ブースト',
        move_mode: '移動',
        move_on: '移動中',
        front_buff: '前列+10k',
        energy: 'EN',
        g_shield: 'G (ガード)',
        opponent_atk: '相手ATK',
        base_diff: 'ガード基準',
        current_g: '現在値:',
        required_g_inc: '要求値:',
        guard_success: 'ガード成功 (Safe)',
        g_reset: 'Gリセット',
        pg_remaining: 'PG残',
        pg_active: 'PG発動中',
        pg_button: 'PG',
        pg_off: 'PG解除',
        soul: 'ソウル',
        damage: 'ダメージ',
        triggers_detailed: 'トリガー数',
        crit: '☆', // (Short form for Trigger Counter)
        draw: '引',
        front: '前',
        heal: '治',
        base_power_setup: '基本',
        reset_base: '基本リセット',
        custom_value: '任意',
        set_base: '設定',
        power_buff_adj: '修正',
        reset_buff: '修正リセット',
        manual_buff: '手動',
        crit_full: '☆', // 修复：重命名为 crit_full
        add_counter: '+ 追加',
        language: '言語',
        base_short: '基',
        buff_short: '修',
        extra_counters: 'カウンター',
        multi_support: '多重B',
        std_support: '標準',
        ot: 'OT', // 新增：OT (Over Trigger)
        // New Manual Guard Controls
        set_shield_manual: 'G手動入力',
        set_shield_button: 'G設定',
        // 新增：状態マーク
        boost: 'ブースト',
        intercept: 'インターセプト',
        double_strike: 'ダブル',
        triple_strike: 'トリプル',
        edit_grade: 'G編集',
        add_grade: 'G追加',
        remove_grade: 'G削除',
        back_row_attack_mode: '後列攻',
    }
};

const SYMBOL_ATLAS = '/symbols/vg-tech-atlas.png';
const SYMBOL_BOXES = {
    critical: '0 290 315 320', boost: '315 290 310 320', intercept: '625 290 310 320',
    doubleDrive: '935 290 315 320', tripleDrive: '0 625 315 320',
    stand: '335 625 270 310', rest: '625 650 310 270',
};
function OfficialSymbol({ kind }) {
    return <svg className={'official-symbol symbol-' + kind} viewBox={SYMBOL_BOXES[kind]} aria-hidden="true" focusable="false">
        <image href={SYMBOL_ATLAS} width="1254" height="1254" />
    </svg>;
}

// Literal official trigger characters stay crisp at any size. No generic pictograms.
const TRIGGER_GLYPHS = { over: '超', draw: '引', front: '前', heal: '治' };
const TRIGGER_COLORS = { draw: ['#ffaaa5','#dd4148','#7e1722'], front: ['#ffc0e5','#e15db2','#841455'], heal: ['#b0f6c5','#47bd77','#165d3a'] };
function TriggerSymbol({ kind }) {
    if (kind === 'critical') return <svg className="trigger-symbol trigger-critical-symbol" viewBox={SYMBOL_BOXES.critical} aria-hidden="true" focusable="false"><image href={SYMBOL_ATLAS} width="1254" height="1254" /></svg>;
    const colors = TRIGGER_COLORS[kind] || ['#79e6ed','#df7f92','#f6d460'];
    const gradient = 'trigger-letter-' + kind;
    return <svg className="trigger-symbol trigger-kanji-symbol" viewBox="0 0 96 96" aria-hidden="true" focusable="false">
        <defs><linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">{colors.map((color,index) => <stop key={color} offset={index / (colors.length - 1)} stopColor={color} />)}</linearGradient></defs>
        <path d="M10 47 77 38 88 50 88 80 21 90 10 78Z" fill="#070d18" stroke="#cdb55c" strokeWidth="2" />
        <path d="M21 60 88 50M21 60 21 90" fill="none" stroke="#a89042" strokeWidth="1.4" />
        <g transform="translate(0 -2) skewY(-9)">
            <text x="48" y="75" className="trigger-kanji" textAnchor="middle" fill="#0b1120" stroke="#847653" strokeWidth="1.5">{TRIGGER_GLYPHS[kind]}</text>
            <text x="48" y="71" className="trigger-kanji" textAnchor="middle" fill={'url(#' + gradient + ')'} stroke="#e6ce78" strokeWidth=".8" paintOrder="stroke">{TRIGGER_GLYPHS[kind]}</text>
        </g>
    </svg>;
}

function ShieldPicker({ slot, unit, anchor, t, onSelect, onClose }) {
    const [custom, setCustom] = useState(String(unit.shield));
    const dialogRef = useRef(null);
    useEffect(() => {
        const previousFocus = document.activeElement;
        (dialogRef.current?.querySelector(`[data-shield="${unit.shield}"]`) || dialogRef.current?.querySelector('input'))?.focus();
        const outside = event => { if (!dialogRef.current?.contains(event.target) && !event.target.closest?.('[data-shield-toggle]')) onClose(); };
        const keydown = event => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); onClose(); }
            if (event.key === 'Tab') {
                const controls = [...(dialogRef.current?.querySelectorAll('button,input') || [])];
                const first = controls[0], last = controls[controls.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }
        };
        document.addEventListener('pointerdown', outside);
        document.addEventListener('keydown', keydown, true);
        return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', keydown, true); previousFocus?.focus(); };
    }, []);
    const apply = value => { if (value !== '' && Number.isFinite(Number(value))) { onSelect(slot, Math.max(0, Number(value))); onClose(); } };
    const width = Math.min(228, window.innerWidth - 16);
    const left = Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8));
    const top = Math.max(8, Math.min(anchor.bottom + 4, window.innerHeight - 240));
    return <div ref={dialogRef} role="dialog" aria-label={t.shield_base} className="grade-picker shield-picker" style={{ left, top, width }} data-testid="shield-picker" onClick={e => e.stopPropagation()}>
        <div className="grade-picker-heading"><span>{t.shield_base}</span><button type="button" aria-label={t.close} onClick={onClose}><X size={16} /></button></div>
        <div className="shield-options">{SHIELD_PRESETS.map(preset => <button type="button" key={preset.val} data-shield={preset.val} aria-pressed={unit.shield === preset.val} onClick={() => apply(preset.val)}>{preset.label}</button>)}</div>
        <div className="shield-picker-modifier">{t.shield_buff} {unit.shieldBuff >= 0 ? '+' : ''}{formatNumber(unit.shieldBuff)}</div>
        <form className="grade-custom" onSubmit={e => { e.preventDefault(); apply(custom); }}><input type="number" min="0" inputMode="numeric" aria-label={t.shield_value} value={custom} onChange={e => setCustom(e.target.value)} /><button type="submit">{t.set_base}</button></form>
    </div>;
}

const UNIT_VALUE_COPY = {
    zh: { power_value: '攻击力', shield_value: '盾值', shield_base: '基本盾值', shield_buff: '盾值修正', power_only: 'OT 用于攻击力' },
    en: { power_value: 'Power', shield_value: 'Shield', shield_base: 'Base shield', shield_buff: 'Shield modifier', power_only: 'OT applies to power' },
    ja: { power_value: 'パワー', shield_value: 'シールド', shield_base: '基本シールド', shield_buff: 'シールド修正', power_only: 'OTはパワーに適用' },
};

const INTERFACE_COPY = {"zh":{"turn_controls":"回合操作","defense":"防御计算","settings":"设置","close":"关闭","roll_dice":"掷骰子","flip_coin":"抛硬币","heads":"正面","tails":"反面","rolling":"投掷中","counter":"自由计数器","counter_name":"计数器名称","decrease":"减少","increase":"增加","remove_counter":"删除计数器","grade_presets":"单位力量预设","unit_status":"状态标记","front_attack":"前排攻击","back_attack":"后排攻击","critical_down":"减少暴击","critical_up":"增加暴击","back_row_attack_mode":"后排可攻"},"en":{"turn_controls":"Turn controls","defense":"Guard calculator","settings":"Settings","close":"Close","roll_dice":"Roll die","flip_coin":"Flip coin","heads":"Heads","tails":"Tails","rolling":"Rolling","counter":"Custom counter","counter_name":"Counter name","decrease":"Decrease","increase":"Increase","remove_counter":"Remove counter","grade_presets":"Unit power presets","unit_status":"Abilities","front_attack":"Front attack","back_attack":"Back attack","critical_down":"Decrease critical","critical_up":"Increase critical","back_row_attack_mode":"Rear enabled"},"ja":{"turn_controls":"ターン操作","defense":"ガード計算","settings":"設定","close":"閉じる","roll_dice":"サイコロを振る","flip_coin":"コイントス","heads":"表","tails":"裏","rolling":"抽選中","counter":"フリーカウンター","counter_name":"カウンター名","decrease":"減らす","increase":"増やす","remove_counter":"カウンターを削除","grade_presets":"ユニットのパワー設定","unit_status":"能力","front_attack":"前列アタック","back_attack":"後列アタック","critical_down":"クリティカルを減らす","critical_up":"クリティカルを増やす","back_row_attack_mode":"後列攻撃可"}};
const PLAYMAT_COPY = {
    zh: { stride: '超越', turn_end: '回合结束', free_support: '自由支援', back_intercept: '后列截击', custom_grade: '自定等级', buff_short: '修', pg_button: '完全防御', pg_off: '取消完全防御', shield_value: '盾值', intercepting: '已加入G区', settle_guard: '结算', cancel_guard: '取消', guard_circle: 'G区', guarded_power: '防御合计', guard_need: '还需盾值', guard_success: '防御成功', guard_failed: '防御不足', stand: '竖置', unit_status: '能力', invalid_intercept: '该单位目前不能截击', fixed_vanguard: '先导者不参与换位', moving: '换位中', move_done: '已换位', opponent_atk: '对方攻击力', manual_shield: '手牌盾值', rear_attack: '后排攻击' },
    en: { stride: 'Stride', turn_end: 'Turn end', free_support: 'Free boost', back_intercept: 'Rear intercept', custom_grade: 'Custom grade', buff_short: 'Mod', pg_button: 'Perfect guard', pg_off: 'Cancel PG', shield_value: 'Shield', intercepting: 'In guard circle', settle_guard: 'Resolve', cancel_guard: 'Cancel', guard_circle: 'Guard circle', guarded_power: 'Total defense', guard_need: 'Shield needed', guard_success: 'Guard successful', guard_failed: 'More shield needed', stand: 'Stand', unit_status: 'Abilities', invalid_intercept: 'This unit cannot intercept now', fixed_vanguard: 'The Vanguard cannot swap positions', moving: 'Moving', move_done: 'Swapped', opponent_atk: 'Opponent power', manual_shield: 'Shield from hand', rear_attack: 'Rear attack' },
    ja: { stride: '超越', turn_end: 'ターン終了', free_support: '自由ブースト', back_intercept: '後列インターセプト', custom_grade: '任意のグレード', buff_short: '修', pg_button: '完全ガード', pg_off: '完全ガード解除', shield_value: 'シールド', intercepting: 'ガードに参加', settle_guard: 'バトル終了', cancel_guard: '取消', guard_circle: 'ガーディアンサークル', guarded_power: '防御合計', guard_need: '追加シールド', guard_success: 'ガード成功', guard_failed: 'シールド不足', stand: 'スタンド', unit_status: '能力', invalid_intercept: 'このユニットはインターセプトできません', fixed_vanguard: 'ヴァンガードは移動できません', moving: '移動中', move_done: '移動しました', opponent_atk: '相手のパワー', manual_shield: '手札のシールド', rear_attack: '後列アタック' },
};
const ATTACK_PRESETS = [13000, 18000, 21000, 23000, 28000, 31000, 33000, 36000, 41000];
const DIE_PIPS = [[4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
const DIE_ROTATIONS = ['rotateX(0deg)', 'rotateX(-90deg)', 'rotateY(-90deg)', 'rotateY(90deg)', 'rotateX(90deg)', 'rotateY(180deg)'];
const diePose = value => `rotateX(-18deg) rotateY(22deg) ${DIE_ROTATIONS[value - 1]}`;
function ChanceTools({ t }) {
    const [die, setDie] = useState({ value: 1, previous: 1, rolling: false, done: false });
    const [coin, setCoin] = useState({ value: 0, previous: 0, rolling: false, done: false });
    const timers = useRef({});
    const busy = useRef({ die: false, coin: false });
    useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);
    const rollDuration = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 720;
    const rollDie = () => {
        if (busy.current.die) return;
        busy.current.die = true;
        const value = Math.floor(Math.random() * 6) + 1;
        setDie({ value, previous: die.value, rolling: true, done: false });
        timers.current.die = setTimeout(() => { busy.current.die = false; setDie(current => ({ ...current, rolling: false, done: true })); }, rollDuration());
    };
    const flipCoin = () => {
        if (busy.current.coin) return;
        busy.current.coin = true;
        const value = Math.random() < .5 ? 0 : 1;
        setCoin({ value, previous: coin.value, rolling: true, done: false });
        timers.current.coin = setTimeout(() => { busy.current.coin = false; setCoin(current => ({ ...current, rolling: false, done: true })); }, rollDuration());
    };
    return <div className="chance-tools">
        <div className="chance-tool">
            <div className="chance-scene" aria-hidden="true"><div className={`die-cube ${die.rolling ? 'is-rolling' : ''}`} style={{ '--dice-pose': diePose(die.value), '--dice-start': diePose(die.previous), '--dice-end': `rotateX(-18deg) rotateY(22deg) rotateX(720deg) rotateY(1080deg) ${DIE_ROTATIONS[die.value - 1]}` }}>
                {DIE_PIPS.map((pips, index) => <div key={index} className={`die-face die-face-${index + 1}`}>{Array.from({ length: 9 }, (_, dot) => <i key={dot} className={pips.includes(dot) ? 'die-pip' : ''} />)}</div>)}
            </div></div>
            <output aria-live="polite" data-testid="dice-result">{die.rolling ? t.rolling : die.done ? die.value : 'D6'}</output>
            <button type="button" onClick={rollDie} disabled={die.rolling} className="bg-slate-800 rounded text-slate-300">{t.roll_dice}</button>
        </div>
        <div className="chance-tool">
            <div className="chance-scene" aria-hidden="true"><div className={`coin-disc ${coin.rolling ? 'is-rolling' : ''}`} style={{ '--coin-pose': `rotateY(${coin.value * 180}deg)`, '--coin-start': `rotateY(${coin.previous * 180}deg)`, '--coin-end': `rotateX(720deg) rotateY(${1440 + coin.value * 180}deg)` }}><div className="coin-face coin-front"><Crown size={25} /></div><div className="coin-face coin-back"><span>V</span></div></div></div>
            <output aria-live="polite" data-testid="coin-result">{coin.rolling ? t.rolling : coin.done ? coin.value === 0 ? t.heads : t.tails : '—'}</output>
            <button type="button" onClick={flipCoin} disabled={coin.rolling} className="bg-slate-800 rounded text-slate-300">{t.flip_coin}</button>
        </div>
    </div>;
}

export default function App() {
    useEffect(() => { startPwa(); }, []);
    const [loading, setLoading] = useState(true);
    const [gameState, setGameState] = useState(INITIAL_GAME_STATE);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [showTopControls, setShowTopControls] = useState(false);
    const [showGuard, setShowGuard] = useState(false);
    const [gradeEditor, setGradeEditor] = useState(null);
    const [shieldEditor, setShieldEditor] = useState(null);
    const [unitValueMode, setUnitValueMode] = useState('power');
    const [powerEditor, setPowerEditor] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [dragState, setDragState] = useState(null);
    const [gestureMessage, setGestureMessage] = useState('');
    const gestureRef = useRef(null);
    const suppressClickUntil = useRef(0);
    const [swapSource, setSwapSource] = useState(null);
    const [showTools, setShowTools] = useState(false);
    const [wideScreen, setWideScreen] = useState(() => window.innerWidth >= 1040);
    const [triggerFlash, setTriggerFlash] = useState(false);
    const [manualInput, setManualInput] = useState("");
    const [customBasePower, setCustomBasePower] = useState("");
    const opponentAttackPower = gameState.opponentPower;
    const setOpponentAttackPower = value => updateState({ opponentPower: value });
    const [showAttackAdjust, setShowAttackAdjust] = useState(false);
    const [language, setLanguage] = useState('zh');

    // 新增：手动设置 G 盾值的输入状态
    const [manualGuardInput, setManualGuardInput] = useState("");

    // 新增：存储单位的特殊模式（后排支援/后排攻击）


    // 新增：存储单位的 G 级别（可手动调整）

    const stateRef = useRef(gameState);
    const [storageWarning, setStorageWarning] = useState(false);
    const [matchDialog, setMatchDialog] = useState(null);
    const [secretOpen, setSecretOpen] = useState(false);
    const [combatEffects, setCombatEffects] = useState([]);
    const effectSerial = useRef(0), effectTimers = useRef(new Set()), secretTaps = useRef({ count:0, at:0 });
    useEffect(()=>()=>effectTimers.current.forEach(clearTimeout),[]);

    // 新增：G 标签编辑模式


    // 操作 G 预设（增加/删除）
    const addGradePreset = (val) => {
        const suggested = typeof val === 'number' ? val : (GRADE_PRESETS[GRADE_PRESETS.length - 1] + 5000);
        GRADE_PRESETS.push(suggested);
        // trigger UI refresh
        updateState({});
    };

    const removeGradePreset = () => {
        if (GRADE_PRESETS.length <= DEFAULT_GRADE_PRESETS.length) return;
        GRADE_PRESETS.pop();
        updateState({});
    };

    const t = { ...(TRANSLATIONS[language] || TRANSLATIONS.zh), ...(INTERFACE_COPY[language] || INTERFACE_COPY.zh), ...(PLAYMAT_COPY[language] || PLAYMAT_COPY.zh), ...UNIT_VALUE_COPY[language], ...MATCH_COPY[language] };

    const getUnitPower = (unit) => (unit?.basePower || 0) + (unit?.powerBuff || 0);
    useEffect(() => {
        const resize = () => setWideScreen(window.innerWidth >= 1040);
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, []);
    useEffect(() => {
        if (!triggerFlash) return;
        const timer = setTimeout(() => setTriggerFlash(false), 600);
        return () => clearTimeout(timer);
    }, [triggerFlash]);

    // 计算单位的 G 级别将由 detectGradeFromPower 决定（基于可编辑的 GRADE_PRESETS）

    // --- Local Storage Persistence ---

    // 1. Load state from Local Storage on component mount
    useEffect(() => {
        try {
            const persistedState = localStorage.getItem(STORAGE_KEY);
            if (persistedState) {
                const loadedState = JSON.parse(persistedState);

                const restored = normalizeState(loadedState);
                const savedPresets = loadedState?.gradePresets;
                const usesLegacyDefaults = JSON.stringify(savedPresets) === JSON.stringify(LEGACY_GRADE_PRESETS);
                GRADE_PRESETS = Array.isArray(savedPresets) && savedPresets.length && !usesLegacyDefaults ? savedPresets.slice(0, 32).map(v => Math.max(0, finite(v))) : [...DEFAULT_GRADE_PRESETS];
                stateRef.current = restored;
                setGameState(restored);
                if (restored.pendingTrigger || restored.guardSlots.length) setShowGuard(true);
                setLanguage(TRANSLATIONS[loadedState?.language] ? loadedState.language : 'zh');
            }
        } catch (e) {
            console.error("Could not load state from localStorage", e);
        } finally {
            setLoading(false);
        }

        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        console.log("App initialized locally. ID:", appId);

    }, []);

    // 2. Function to update state and save to Local Storage
    const updateState = (newData, updateLanguage = false, event = null) => {
        const proposed = { ...stateRef.current, ...newData };
        if (event) proposed.match = addMatchEvent(normalizeMatch(proposed.match), event);
        const nextState = normalizeState(proposed);
        stateRef.current = nextState;
        setGameState(nextState);
        const nextLanguage = updateLanguage && TRANSLATIONS[newData.language] ? newData.language : language;
        if (updateLanguage) setLanguage(nextLanguage);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...nextState, language: nextLanguage, gradePresets: GRADE_PRESETS }));
            setStorageWarning(false);
        } catch (e) {
            setStorageWarning(true);
            console.error("Could not save state to localStorage", e);
        }
    };

    const fireEffect = (kind, slots) => {
        if (!stateRef.current.effects || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
        const id=++effectSerial.current;
        setCombatEffects(previous=>[...previous.slice(-5),{id,kind,slots}]);
        const timer=setTimeout(()=>{setCombatEffects(previous=>previous.filter(effect=>effect.id!==id));effectTimers.current.delete(timer);},1650);
        effectTimers.current.add(timer);
    };
    const closePanels = () => {
        setSelectedSlot(null);setShowTools(false);setGradeEditor(null);setShieldEditor(null);setShowAttackAdjust(false);setSwapSource(null);setDragState(null);
        if (gestureRef.current) clearTimeout(gestureRef.current.timer);
        gestureRef.current=null;
    };
    const openMatchDialog = mode => { closePanels();setMatchDialog(mode); };
    const confirmMatchAction = () => {
        const current=stateRef.current;
        if (matchDialog==='restore' && current.resetBackup) {
            const restored=normalizeState(current.resetBackup.state);
            updateState({ ...restored,skin:current.skin,effects:current.effects,resetBackup:null,match:{...restored.match,runningSince:current.resetBackup.resume ? Date.now() : null} });
            setShowGuard(!!restored.pendingTrigger || restored.guardSlots.length>0);
        } else if (matchDialog==='reset') {
            const snapshot=JSON.parse(JSON.stringify({...current,match:pauseMatch(current.match),resetBackup:null}));
            const units=cloneUnits(INITIAL_BOARD);units.front_center.basePower=GRADE_PRESETS[0];
            updateState({...INITIAL_GAME_STATE,units,match:freshMatch(),skin:current.skin,effects:current.effects,resourceCountersMigrated:true,extraCounters:current.extraCounters.map(counter=>({...counter,value:0})),resetBackup:{state:snapshot,savedAt:Date.now(),resume:current.match.runningSince!=null}});
            setShowGuard(false);setShowTopControls(false);
        }
        setMatchDialog(null);setCombatEffects([]);
    };
    const tapBrand = () => {
        const now=Date.now(), taps=secretTaps.current;
        taps.count=now-taps.at<2500 ? taps.count+1 : 1;taps.at=now;
        if (taps.count===7) { taps.count=0;closePanels();setSecretOpen(true); }
    };

    useEffect(() => {
        const modal = selectedSlot || (showTools && !wideScreen);
        const previous = document.body.style.overflow;
        if (modal) document.body.style.overflow = 'hidden';
        const previousFocus = document.activeElement;
        const close = event => {
            if (event.key === 'Escape') {
                setSelectedSlot(null); setShowTools(false); setShowTopControls(false);
                setShowAttackAdjust(false); setSwapSource(null); setDragState(null); setPowerEditor(null);
                if (stateRef.current.pendingTrigger) cancelTrigger();
                if (stateRef.current.isMultiSupportMode) cancelFreeSupport();
                if (gestureRef.current) clearTimeout(gestureRef.current.timer);
                gestureRef.current = null;
            }
            if (modal && event.key === 'Tab') {
                const dialog = document.querySelector(selectedSlot ? '.unit-drawer' : '.tools-panel');
                const controls = [...(dialog?.querySelectorAll('button:not([disabled]), input, select, summary') || [])].filter(control => !control.closest('details:not([open])') || control.tagName === 'SUMMARY');
                const first = controls[0], last = controls[controls.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }
        };
        if (modal) document.querySelector(selectedSlot ? '.unit-drawer [data-testid="unit-close"]' : '.tools-panel button')?.focus();
        document.addEventListener('keydown', close);
        return () => { if (modal) document.body.style.overflow = previous; document.removeEventListener('keydown', close); if (modal) previousFocus?.focus(); };
    }, [selectedSlot, showTools, showTopControls, wideScreen]);

    useEffect(() => () => { if (gestureRef.current) clearTimeout(gestureRef.current.timer); }, []);

    // --- Logic ---
    const vanguardUnit = gameState.units.front_center || INITIAL_UNIT;
    const vanguardPower = getUnitPower(vanguardUnit);
    const interceptShield = gameState.guardSlots.reduce((sum, slot) => sum + getUnitShield(gameState.units[slot]), 0);
    const currentGuard = Math.max(0, finite(gameState.resources.shield)) + interceptShield;

    const { required5kIncrements, currentAttackTarget, isDifferenceMode } = useMemo(() => {
        const isManualInput = opponentAttackPower != null;
        const targetATK = isManualInput ? opponentAttackPower : vanguardPower;
        const effectiveTarget = targetATK - vanguardPower;
        // Equal power hits: defense must be strictly greater than attack.
        const guardNeeded = effectiveTarget - currentGuard;
        const required5kIncrements = gameState.resources.sentinelActive || guardNeeded < 0 ? 0 : Math.floor(guardNeeded / 5000) + 1;

        return {
            required5kIncrements,
            currentAttackTarget: targetATK,
            isDifferenceMode: isManualInput
        };
    }, [vanguardPower, currentGuard, opponentAttackPower, gameState.resources.sentinelActive]);

    const modifyUnit = useCallback((slot, changes, event = null) => {
        const unit = stateRef.current.units[slot];
        let newUnit = { ...unit };

        Object.keys(changes).forEach(key => {
            newUnit[key] = changes[key];
        });

        const isBackRow = slot.startsWith('back');
        const totalPower = getUnitPower(newUnit);

        if (totalPower <= 0) {
            newUnit.isSupporting = false;
            // 顺便把后排攻击一起关掉会更安全
            newUnit.isBackRowAttack = false;
        } else {
            // ✅ 关键修改：如果已经是后排攻击模式，就不要自动开支援
            if (
                isBackRow &&
                changes.isSupporting === undefined &&
                !newUnit.isBackRowAttack && (getUnitPower(unit) <= 0 || changes.grade !== undefined)
            ) {
                if (!newUnit.isSupporting && newUnit.hasBoost && !newUnit.isRested) newUnit.isSupporting = true;
            }
        }

        if (!newUnit.hasBoost) newUnit.isSupporting = false;
        if (newUnit.crit < 0) newUnit.crit = 0;

        const newUnits = { ...stateRef.current.units, [slot]: newUnit };
        const entering = getUnitPower(unit)<=0 && totalPower>0;
        updateState({ units: newUnits },false,event || (entering ? {kind:'call',slot,value:totalPower} : null));
        if (event?.kind==='ride') fireEffect('ride',[slot]);
        else if (entering || event?.kind==='call') fireEffect('call',[slot]);
        else if (event?.kind==='retire') fireEffect('retire',[slot]);
    }, [gameState.units, updateState]);
    // 2. 横置/竖置单位按钮
    const restUnit = useCallback((slot) => {
        // 如果多重支援模式：将该列或所有支援中的单位一并横置
        if (gameState.isMultiSupportMode) {
            const newUnits = cloneUnits(stateRef.current.units);
            // 横置目标槽的整列
            const col = slot.split('_')[1];
            Object.keys(newUnits).forEach(k => {
                // 如果是同列（front/back 中同一列）或者正在支援的单位，横置并取消支援
                if (k.endsWith('_' + col) || newUnits[k].isSupporting) {
                    newUnits[k] = { ...newUnits[k], isRested: true, isSupporting: false };
                }
            });
            updateState({ units: newUnits });
        } else {
            modifyUnit(slot, { isRested: true, isSupporting: false });
        }
    }, [modifyUnit, gameState.isMultiSupportMode, gameState.units, updateState]);

    const standUnit = useCallback((slot) => {
        // 如果多重支援模式：把同一纵列的单位都站起来
        if (gameState.isMultiSupportMode) {
            const newUnits = cloneUnits(stateRef.current.units);
            const col = slot.split('_')[1];
            Object.keys(newUnits).forEach(k => {
                if (k.endsWith('_' + col)) {
                    newUnits[k] = { ...newUnits[k], isRested: false };
                }
            });
            updateState({ units: newUnits });
        } else {
            modifyUnit(slot, { isRested: false });
        }
    }, [modifyUnit, gameState.isMultiSupportMode, gameState.units, updateState]);

    const toggleSupport = slot => {
        if (stateRef.current.isMultiSupportMode) { selectFreeSupport(slot); return; }
        const unit = stateRef.current.units[slot];
        if (unit.isRested || !unit.hasBoost || getUnitPower(unit) <= 0 || stateRef.current.guardSlots.includes(slot)) return;
        if (!slot.startsWith('back') && !stateRef.current.isMultiSupportMode) return;
        modifyUnit(slot, { isSupporting: !unit.isSupporting, isBackRowAttack: false });
    };

    const handleAttackUndo = () => {
        const current = stateRef.current;
        if (current.pendingTrigger || current.isMultiSupportMode || current.attackHistory.length === 0) return;
        const lastState = current.attackHistory[current.attackHistory.length - 1];
        const newHistory = current.attackHistory.slice(0, -1);
        updateState({
            units: lastState.units,
            attackCount: lastState.attackCount,
            attackHistory: newHistory,
            isMultiSupportMode: lastState.isMultiSupportMode, supportSlots: [...lastState.supportSlots]
        },false,{kind:'undo',value:lastState.attackCount});
        setSelectedSlot(null);
    };

    const attackColumn = (frontSlot, backSlot, explicitAttackerSlot) => {
        const current = stateRef.current;
        const attackerSlot = explicitAttackerSlot || frontSlot;
        if (attackerSlot !== frontSlot && attackerSlot !== backSlot) return;
        const attacker = current.units[attackerSlot];
        if (!attacker || current.guardSlots.includes(attackerSlot) || attacker.isRested || getUnitPower(attacker) <= 0 || (attackerSlot === backSlot && !attacker.isBackRowAttack)) return;
        const historyEntry = { units: cloneUnits(current.units), attackCount: current.attackCount, isMultiSupportMode: current.isMultiSupportMode, supportSlots: [...current.supportSlots] };
        const newUnits = cloneUnits(current.units);

        // Mark attacker as rested and cancel its support
        newUnits[attackerSlot] = { ...newUnits[attackerSlot], isRested: true, isSupporting: false };

        if (current.isMultiSupportMode) {
            // Multi-Support Mode: 横置所有当前支援单位（除了已横置的 attacker）
            current.supportSlots.forEach(key => {
                if (key !== attackerSlot && isFreeSupportTarget(key, current)) {
                    newUnits[key] = { ...newUnits[key], isRested: true, isSupporting: false };
                }
            });
        } else {
            // Standard Mode: 横置同列的另一个槽（如果它在支援状态）
            const col = attackerSlot.split('_')[1];
            const otherSlot = (attackerSlot.startsWith('front') ? `back_${col}` : `front_${col}`);
            if (newUnits[otherSlot] && !current.guardSlots.includes(otherSlot) && newUnits[otherSlot].hasBoost && newUnits[otherSlot].isSupporting && !newUnits[otherSlot].isRested) {
                newUnits[otherSlot] = { ...newUnits[otherSlot], isRested: true, isSupporting: false };
            }
        }

        updateState({ units: newUnits, attackCount: current.attackCount + 1, attackHistory: [...current.attackHistory, historyEntry].slice(-100), isMultiSupportMode: false, supportSlots: [] },false,{kind:'attack',slot:attackerSlot,value:getAttackDetails(frontSlot,backSlot,attackerSlot).power});
        fireEffect('attack',[attackerSlot]);
        setSelectedSlot(null);
    };

    // Stand phase / clear prior temporary state; Ride and energy are separate explicit actions.
    const handleTurnStart = () => {
        const newUnits = cloneUnits(stateRef.current.units);

        // 竖置所有单位
        Object.keys(newUnits).forEach(slot => {
            let unit = newUnits[slot];
            if (unit.isStriding && unit.heart) { unit = { ...unit, ...unit.heart, isStriding: false, heart: null }; newUnits[slot] = unit; }
            unit.isRested = false;
            const isBackRow = slot.startsWith('back');
            const totalPower = getUnitPower({ ...unit, powerBuff: 0 });
            if (isBackRow && totalPower > 0 && unit.hasBoost && !unit.isBackRowAttack) {
                unit.isSupporting = true;
            }
        });

        Object.values(newUnits).forEach(unit => { unit.powerBuff = 0; unit.shieldBuff = 0; unit.otActive = false; unit.crit = 1; });
        updateState({ units: newUnits, attackCount: 0, attackHistory: [], opponentPower: null, guardSlots: [], resources: { ...stateRef.current.resources, shield: 0, sentinelActive: false },match:{...stateRef.current.match,turn:stateRef.current.match.turn+1} },false,{kind:'turn'});
        setSelectedSlot(null);
    };

    const rideNextGrade = () => {
        const current = stateRef.current;
        const v = current.units.front_center;
        if (v.grade >= 4 || v.isStriding) return;
        const nextGrade = v.grade + 1;
        const stride = v.grade >= 3;
        const heart = stride ? { grade: v.grade, basePower: v.basePower, shield: v.shield, hasBoost: v.hasBoost, hasDoubleStrike: v.hasDoubleStrike, hasTripleStrike: v.hasTripleStrike } : null;
        updateState({ units: { ...current.units, front_center: {
            ...v, grade: nextGrade, basePower: stride ? v.basePower + 15000 : (GRADE_PRESETS[nextGrade] ?? DEFAULT_GRADE_PRESETS[nextGrade]),
            hasBoost: nextGrade <= 1, hasDoubleStrike: nextGrade === 3, hasTripleStrike: nextGrade === 4,
            shield: gradeShield(nextGrade),
            isStriding: stride, heart,
        } } },false,{kind:'ride',slot:'front_center',value:stride ? v.basePower+15000 : GRADE_PRESETS[nextGrade]});
        fireEffect('ride',['front_center']);
    };

    // 保留：一键竖置（新名称为 standAllUnits，不做 Ride）
    const standAllUnits = () => {
        const newUnits = cloneUnits(stateRef.current.units);
        Object.keys(newUnits).forEach(slot => {
            const unit = newUnits[slot];
            unit.isRested = false;
            const isBackRow = slot.startsWith('back');
            const totalPower = getUnitPower({ ...unit, powerBuff: 0 });
            if (isBackRow && totalPower > 0 && unit.grade <= 1 && !unit.isBackRowAttack) {
                unit.isSupporting = true;
            }
        });
        updateState({ units: newUnits, attackHistory: [] });
        setSelectedSlot(null);
    };

    // 回合结束重置：只清除修正值和暴击等附加状态，不竖置单位
    const roundStateReset = () => {
        const newUnits = cloneUnits(stateRef.current.units);
        Object.keys(newUnits).forEach(slot => {
            let unit = newUnits[slot];
            if (unit.isStriding && unit.heart) { unit = { ...unit, ...unit.heart, isStriding: false, heart: null }; newUnits[slot] = unit; }
            unit.otActive = false;
            unit.powerBuff = 0; // 清空修正值
            unit.shieldBuff = 0;
            unit.crit = 1; // 重置暴击倍数
            // 不修改 isRested 和 isSupporting，保持当前状态
        });
        updateState({ units: newUnits, attackCount: 0, attackHistory: [] },false,{kind:'end'});
        setSelectedSlot(null);
    };

    // 4. 移除伤害上限
    const modifyResource = (key, delta) => {
        let current = gameState.resources[key];
        let newVal = current + delta;

        // OT, 触发器和PG不能为负
        if (key.endsWith('Triggers') || key === 'sentinelsRemaining' || key === 'otTriggers') {
            newVal = Math.max(0, newVal);
        }

        if (key === 'damage' || key === 'soul') {
            newVal = Math.max(0, newVal); // 确保伤害和魂不能为负，但不设上限
        }

        updateState({ resources: { ...gameState.resources, [key]: newVal } });
    };

    const modifyShield = (delta) => {
        const newShield = gameState.resources.shield + delta;
        let newResources = { ...stateRef.current.resources, shield: Math.max(0, newShield) };

        // 如果手动修改了G值，自动取消PG状态
        if (gameState.resources.sentinelActive && delta !== 0) {
            newResources.sentinelActive = false;
        }

        updateState({ resources: newResources });
    };

    const swapSlots = (source, target) => {
        const current = stateRef.current;
        if (source === 'front_center' || target === 'front_center') { setGestureMessage(t.fixed_vanguard); return; }
        if (!current.units[source] || !current.units[target] || current.guardSlots.includes(source) || current.guardSlots.includes(target)) return;
        if (source !== target) {
            const units = cloneUnits(current.units);
            [units[source], units[target]] = [units[target], units[source]];
            units[source].isVanguard = false; units[target].isVanguard = false;
            if (!current.isMultiSupportMode) {
                [source, target].filter(slot => slot.startsWith('front')).forEach(slot => { units[slot].isSupporting = false; });
            }
            updateState({ units, attackHistory: [] });
            setGestureMessage(t.move_done);
        }
        setSwapSource(null); setDragState(null);
    };

    const canIntercept = slot => {
        const current = stateRef.current;
        const unit = current.units[slot];
        const back = slot.startsWith('back');
        return unit && slot !== 'front_center' && getUnitPower(unit) > 0 &&
            (back ? current.allowBackIntercept : unit.hasIntercept);
    };

    const addToGuard = slot => {
        const current = stateRef.current;
        if (!canIntercept(slot)) { setGestureMessage(t.invalid_intercept); return; }
        if (!current.guardSlots.includes(slot)) {
            updateState({ guardSlots: [...current.guardSlots, slot], attackHistory: [] });
            setGestureMessage(t.intercepting);
        }
        setShowGuard(true); setSwapSource(null); setDragState(null);
    };

    const handleSlotClick = slot => {
        if (Date.now() < suppressClickUntil.current) return;
        if (stateRef.current.pendingTrigger) { resolveTriggerTarget(slot); return; }
        if (stateRef.current.isMultiSupportMode) { selectFreeSupport(slot); return; }
        if (swapSource) { swapSlots(swapSource, slot); return; }
        setCustomBasePower(''); setManualInput(''); setPowerEditor(null); setGradeEditor(null); setShieldEditor(null); setUnitValueMode('power');
        setShowTools(false); setShowAttackAdjust(false);
        setSelectedSlot(selectedSlot === slot ? null : slot);
    };

    const startHold = (slot, x, y, pointerId = null) => {
        if (stateRef.current.pendingTrigger || stateRef.current.isMultiSupportMode || stateRef.current.guardSlots.includes(slot)) return;
        if (gestureRef.current) clearTimeout(gestureRef.current.timer);
        const gesture = { slot, x, y, pointerId, active: false, moved: false, timer: null };
        gesture.timer = setTimeout(() => {
            if (gestureRef.current !== gesture) return;
            if (slot === 'front_center') { setGestureMessage(t.fixed_vanguard); return; }
            gesture.active = true; suppressClickUntil.current = Date.now() + 600;
            setSelectedSlot(null); setGradeEditor(null); setShieldEditor(null); setSwapSource(slot);
            setDragState({ slot, x: gesture.x, y: gesture.y, target: null });
            setGestureMessage(t.moving);
        }, 360);
        gestureRef.current = gesture;
    };
    const moveHold = (x, y, event) => {
        const gesture = gestureRef.current;
        if (!gesture) return;
        const distance = Math.hypot(x - gesture.x, y - gesture.y);
        if (!gesture.active && distance > 8) {
            clearTimeout(gesture.timer); gestureRef.current = null; return;
        }
        if (!gesture.active) return;
        event?.preventDefault(); gesture.moved = gesture.moved || distance > 8;
        const target = document.elementFromPoint?.(x, y)?.closest?.('[data-slot], [data-guard-drop]');
        setDragState({ slot: gesture.slot, x, y, target: target?.hasAttribute('data-guard-drop') ? 'guard' : target?.dataset.slot ?? null });
    };
    const endHold = (x, y, cancelled = false) => {
        const gesture = gestureRef.current;
        if (!gesture) return;
        clearTimeout(gesture.timer); gestureRef.current = null;
        if (!gesture.active) return;
        suppressClickUntil.current = Date.now() + 350;
        setDragState(null);
        if (cancelled) { setSwapSource(null); return; }
        const target = document.elementFromPoint?.(x, y)?.closest?.('[data-slot], [data-guard-drop]');
        if (target?.hasAttribute('data-guard-drop')) addToGuard(gesture.slot);
        else if (target?.dataset.slot && target.dataset.slot !== gesture.slot) swapSlots(gesture.slot, target.dataset.slot);
        else if (gesture.moved) setSwapSource(null);
    };
    useEffect(() => {
        const move = e => { if (gestureRef.current?.pointerId != null) moveHold(e.clientX, e.clientY, e); };
        const end = e => { if (gestureRef.current?.pointerId != null) endHold(e.clientX, e.clientY); };
        const cancel = e => { if (gestureRef.current) endHold(e.clientX || 0, e.clientY || 0, true); };
        const touchMove = e => { if (gestureRef.current?.pointerId === null && e.touches[0]) moveHold(e.touches[0].clientX, e.touches[0].clientY, e); };
        const touchEnd = e => { if (gestureRef.current?.pointerId === null && e.changedTouches[0]) endHold(e.changedTouches[0].clientX, e.changedTouches[0].clientY); };
        document.addEventListener('pointermove', move); document.addEventListener('pointerup', end); document.addEventListener('pointercancel', cancel);
        document.addEventListener('touchmove', touchMove, { passive: false }); document.addEventListener('touchend', touchEnd); document.addEventListener('touchcancel', cancel);
        return () => {
            document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', end); document.removeEventListener('pointercancel', cancel);
            document.removeEventListener('touchmove', touchMove); document.removeEventListener('touchend', touchEnd); document.removeEventListener('touchcancel', cancel);
        };
    }, [gameState, language]);

    const handleRetire = useCallback((slot) => {
        modifyUnit(slot, { ...INITIAL_UNIT, isVanguard: slot === 'front_center' },{kind:'retire',slot});
        setSelectedSlot(null);
    }, [modifyUnit]);

    const setEnergy = (val) => {
        if (val === -100) val = 0;
        updateState({ energy: Math.max(0, Math.min(MAX_ENERGY, val)) });
    }

    const handlePerfectGuard = () => {
        const resources = stateRef.current.resources;
        if (resources.sentinelActive) updateState({ resources: { ...resources, sentinelActive: false, sentinelsRemaining: resources.sentinelsRemaining + 1 } });
        else if (resources.sentinelsRemaining > 0) updateState({ resources: { ...resources, sentinelActive: true, sentinelsRemaining: resources.sentinelsRemaining - 1 } });
    };

    const resetDefensePhase = () => {
        const resources = stateRef.current.resources;
        updateState({ guardSlots: [], resources: { ...resources, shield: 0, sentinelActive: false, sentinelsRemaining: resources.sentinelsRemaining + (resources.sentinelActive ? 1 : 0) } });
        setOpponentAttackPower(null); setManualGuardInput('');
    };
    const settleGuard = () => {
        const current = stateRef.current;
        const units = cloneUnits(current.units);
        current.guardSlots.forEach(slot => { units[slot] = { ...INITIAL_UNIT, isVanguard: false }; });
        updateState({ units, guardSlots: [], attackHistory: [], resources: { ...current.resources, shield: 0, sentinelActive: false } },false,{kind:'guard',value:currentGuard});
        setSelectedSlot(null); setOpponentAttackPower(null); setManualGuardInput('');
    };

    const applyFrontRowBuff = (value) => {
        const slots = ['front_left', 'front_center', 'front_right'];
        const newUnits = cloneUnits(stateRef.current.units);
        slots.forEach(slot => {
            const unit = newUnits[slot];
            unit.powerBuff += value;
        });
        updateState({ units: newUnits });
    };

    const handleLanguageChange = (code) => {
        updateState({ language: code }, true);
        setShowTools(false);
    };

    // 新增：OT 按钮的点击处理
    const handleOTBuff = () => {
        if (!selectedSlot) return;
        const unit = stateRef.current.units[selectedSlot] || {};
        const current = unit.powerBuff || 0;
        // Toggle OT buff on the selected slot
        if (unit.otActive) {
            modifyUnit(selectedSlot, { powerBuff: current - OT_BUFF_VALUE, otActive: false });
        } else {
            modifyUnit(selectedSlot, { powerBuff: current + OT_BUFF_VALUE, otActive: true });
            fireEffect('over',[selectedSlot]);
        }
    };


    const setUnitGrade = (slot, grade, baseOverride) => {
        const nextGrade = Math.min(99, Math.max(0, Math.trunc(finite(grade))));
        const isVanguard = slot === 'front_center';
        const special=SPECIAL_UNIT_PRESETS.find(preset=>preset.grade===nextGrade);
        const power = baseOverride ?? special?.power ?? (nextGrade === 0 && !isVanguard ? REAR_GRADE_ZERO_POWER : GRADE_PRESETS[nextGrade]);
        modifyUnit(slot, { grade: nextGrade, shield: gradeShield(nextGrade), hasBoost: nextGrade <= 1, hasIntercept: !isVanguard && nextGrade === 2, hasDoubleStrike:isVanguard && (nextGrade===3 || !!special), hasTripleStrike:isVanguard && nextGrade===4,
            ...(power !== undefined ? { basePower: power, isStriding: false, heart: null } : {}) },{kind:isVanguard?'ride':'call',slot,value:power ?? stateRef.current.units[slot].basePower});
    };

    const stepUnitGrade = (slot, delta) => {
        const current = stateRef.current.units[slot];
        updateState({ units: { ...stateRef.current.units, [slot]: { ...current, grade: Math.min(99, Math.max(0, current.grade + delta)) } } });
    };

    const triggerNames = {
        zh: { critical: '暴击触发', draw: '抽牌触发', front: '前列触发', heal: '治疗触发', over: '超触发', power: '选择力量对象', crit: '选择暴击对象', cancel: '撤销触发' },
        en: { critical: 'Critical trigger', draw: 'Draw trigger', front: 'Front trigger', heal: 'Heal trigger', over: 'Over trigger', power: 'Choose power target', crit: 'Choose critical target', cancel: 'Undo trigger' },
        ja: { critical: 'クリティカルトリガー', draw: 'ドロートリガー', front: 'フロントトリガー', heal: 'ヒールトリガー', over: 'オーバートリガー', power: 'パワー対象を選択', crit: 'クリティカル対象を選択', cancel: 'トリガーを取り消す' },
    }[language];
    const actionCopy = {
        zh: { attack: '攻击', choose_support: '选择支援', cancel_support: '取消支援选择', undo: '撤销攻击' },
        en: { attack: 'Attack', choose_support: 'Choose boosters', cancel_support: 'Cancel booster selection', undo: 'Undo attack' },
        ja: { attack: 'アタック', choose_support: 'ブーストを選択', cancel_support: 'ブースト選択を取消', undo: 'アタック取消' },
    }[language];
    const isFreeSupportTarget = (slot, state = stateRef.current) => canSelectFreeSupport(slot, state.units, state.guardSlots);
    const cancelFreeSupport = () => updateState({ isMultiSupportMode: false, supportSlots: [] });
    const toggleFreeSupport = () => {
        if (stateRef.current.pendingTrigger) return;
        if (stateRef.current.isMultiSupportMode) { cancelFreeSupport(); return; }
        setSelectedSlot(null); setGradeEditor(null); setShieldEditor(null); setShowTools(false); setSwapSource(null);
        updateState({ isMultiSupportMode: true, supportSlots: [] });
    };
    const selectFreeSupport = slot => {
        const current = stateRef.current;
        if (!current.isMultiSupportMode || !isFreeSupportTarget(slot, current)) return;
        updateState({ supportSlots: current.supportSlots.includes(slot) ? current.supportSlots.filter(id => id !== slot) : [...current.supportSlots, slot] });
    };
    const isTriggerTarget = (slot, state = stateRef.current) => getUnitPower(state.units[slot]) !== 0 && !state.guardSlots.includes(slot);
    const cancelTrigger = () => {
        const pending = stateRef.current.pendingTrigger;
        if (pending) updateState({ units: cloneUnits(pending.beforeUnits), pendingTrigger: null });
    };
    const beginTrigger = kind => {
        const current = stateRef.current;
        if (current.pendingTrigger || current.isMultiSupportMode) return;
        setSelectedSlot(null); setShowTools(false); setGradeEditor(null); setShieldEditor(null); setSwapSource(null);
        if (kind === 'front') {
            const units = cloneUnits(current.units);
            ['front_left', 'front_center', 'front_right'].filter(slot => isTriggerTarget(slot, current)).forEach(slot => { units[slot].powerBuff += 10000; });
            updateState({ units }); setTriggerFlash(true);
        } else if (Object.keys(current.units).some(slot => isTriggerTarget(slot, current))) {
            updateState({ pendingTrigger: { kind, stage: 'power', beforeUnits: cloneUnits(current.units) } });
        }
    };
    const resolveTriggerTarget = slot => {
        const current = stateRef.current;
        const pending = current.pendingTrigger;
        if (!pending || !isTriggerTarget(slot, current)) return;
        const units = cloneUnits(current.units);
        if (pending.stage === 'critical') {
            units[slot].crit += 1;
            updateState({ units, pendingTrigger: null },false,{kind:'trigger',slot,value:1});
            fireEffect('trigger',[slot]);
        } else {
            units[slot].powerBuff += pending.kind === 'over' ? OT_BUFF_VALUE : 10000;
            if (pending.kind === 'over') units[slot].otActive = true;
            updateState({ units, pendingTrigger: pending.kind === 'critical' ? { ...pending, stage: 'critical' } : null },false,{kind:'trigger',slot,value:pending.kind==='over' ? OT_BUFF_VALUE : 10000});
            fireEffect(pending.kind==='over'?'over':'trigger',[slot]);
        }
    };
    const togglePanel = panel => {
        if (panel === 'turn') { setShowTopControls(current => !current); return; }
        if (panel === 'guard') { if (showGuard && stateRef.current.pendingTrigger) cancelTrigger(); setShowGuard(current => !current); return; }
        setSelectedSlot(null); setGradeEditor(null); setShieldEditor(null); setShowAttackAdjust(false);
        setShowTools(panel === 'tools' && !showTools);
    };
    const openGrade = (event, slot) => {
        event.stopPropagation();
        setShieldEditor(null);
        setGradeEditor({ slot, anchor: event.currentTarget.getBoundingClientRect() });
    };
    const openShield = (event, slot) => {
        event.stopPropagation();
        setGradeEditor(null);
        setShieldEditor({ slot, anchor: event.currentTarget.getBoundingClientRect() });
    };
    const selectUnitValue = mode => { setUnitValueMode(mode); setPowerEditor(null); };
    const editingShield = unitValueMode === 'shield';
    const baseKey = editingShield ? 'shield' : 'basePower';
    const buffKey = editingShield ? 'shieldBuff' : 'powerBuff';
    const openPowerEditor = key => {
        const unit = stateRef.current.units[selectedSlot];
        setEditValue(String(unit[key])); setPowerEditor(powerEditor === key ? null : key);
    };
    const applyPowerEditor = e => {
        e.preventDefault();
        if (editValue === '' || !Number.isFinite(Number(editValue))) return;
        const val = Number(editValue);
        modifyUnit(selectedSlot, { [powerEditor]: ['powerBuff', 'shieldBuff'].includes(powerEditor) ? val : Math.max(0, val), ...(powerEditor === 'powerBuff' ? { otActive: false } : {}) });
        setPowerEditor(null);
    };

    const modifyCounter = (index, changes) => {
        const counters = stateRef.current.extraCounters.map((counter, i) => i === index ? { ...counter, ...changes } : counter);
        updateState({ extraCounters: counters });
    };
    const columns = ['left', 'center', 'right'];
    const hasBackRowAttack = columns.some(column => gameState.units[`back_${column}`].isBackRowAttack);

    // --- Renderers ---

    const renderUnitSlot = (id, label) => {
        const unit = gameState.units[id];
        const isVanguardSlot = id === 'front_center';
        const power = getUnitPower(unit);
        const reserved = gameState.guardSlots.includes(id);
        const supportable = !isVanguardSlot && unit.hasBoost && (id.startsWith('back') || gameState.isMultiSupportMode);
        const selected = selectedSlot === id;
        const target = dragState?.target === id;
        const source = swapSource === id;
        const triggerStage = gameState.pendingTrigger && isTriggerTarget(id, gameState) ? gameState.pendingTrigger.stage : null;
        const supportTarget = gameState.isMultiSupportMode && isFreeSupportTarget(id, gameState);
        const supportSelected = gameState.isMultiSupportMode && gameState.supportSlots.includes(id);
        const showInterceptShield = !isVanguardSlot && (unit.hasIntercept || (id.startsWith('back') && gameState.allowBackIntercept && power !== 0));
        const activeSupport = gameState.isMultiSupportMode ? supportSelected : unit.isSupporting;
        const border = selected ? 'border-yellow-400' : source || target ? 'border-blue-500' : isVanguardSlot ? 'border-red-500' : 'border-slate-800';
        const tone = selected ? 'bg-slate-800' : source || target ? 'bg-blue-900/20' : unit.isRested ? 'bg-slate-950/90 opacity-40' : unit.isSupporting ? 'bg-green-900/20' : isVanguardSlot ? 'bg-red-950/20' : 'bg-slate-900/80';
        const numberTone = unit.otActive ? 'rainbow-text' : isVanguardSlot ? 'text-blue-400' : power > 0 ? 'text-yellow-400' : power < 0 ? 'text-red-500' : 'text-slate-400';
        return <div key={id} role="group" tabIndex={0} aria-label={label + ' ' + formatNumber(power) + (unit.isRested ? ', ' + t.rest : '')}
            data-testid={'unit-' + id} data-slot={id} data-value={power} data-reserved={reserved}
            data-rested={unit.isRested} data-intercept-shield={showInterceptShield || undefined}
            data-trigger-stage={triggerStage || undefined}
            data-selection={selected || source || target || !!triggerStage || supportTarget ? 'true' : undefined}
            data-support-target={supportTarget || undefined} data-support-selected={supportSelected || undefined}
            onClickCapture={e => { if (stateRef.current.pendingTrigger || stateRef.current.isMultiSupportMode) { e.stopPropagation(); e.preventDefault(); handleSlotClick(id); } }}
            onClick={() => handleSlotClick(id)}
            onKeyDown={e => {
                if (e.target !== e.currentTarget) return;
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSlotClick(id); }
                if (e.key.toLowerCase() === 'm' && id !== 'front_center') { e.preventDefault(); setSwapSource(id); setGestureMessage(t.moving); }
            }}
            onPointerDown={e => { if (e.pointerType === 'touch' || e.button !== 0 || e.target.closest('button,input')) return; startHold(id, e.clientX, e.clientY, e.pointerId ?? 1); }}
            onTouchStart={e => { if (e.target.closest('button,input') || e.touches.length !== 1) return; const point = e.touches[0]; startHold(id, point.clientX, point.clientY); }}
            onContextMenu={e => e.preventDefault()}
            className={'unit-slot relative rounded-lg border-2 select-none ' + border + ' ' + tone + (unit.otActive ? ' rainbow-glow' : '') + (reserved ? ' unit-reserved' : '') + (triggerFlash && id.startsWith('front') && isTriggerTarget(id, gameState) ? ' trigger-flash' : '')}>
            <FieldRing skin={gameState.skin} vanguard={isVanguardSlot}/>
            <div className="slot-topline">
                <div className="slot-abilities">
                    {(unit.hasIntercept || (id.startsWith('back') && gameState.allowBackIntercept && power !== 0)) && <span title={t.intercept}><OfficialSymbol kind="intercept" /></span>}
                    {unit.hasDoubleStrike && <span title={t.double_strike}><OfficialSymbol kind="doubleDrive" /></span>}
                    {unit.hasTripleStrike && <span title={t.triple_strike}><OfficialSymbol kind="tripleDrive" /></span>}
                    {unit.hasBoost && (supportable ? <button type="button" data-testid={'boost-' + id} aria-label={activeSupport ? t.support_off : t.boost} aria-pressed={activeSupport} disabled={unit.isRested || power <= 0 || reserved} className={'slot-symbol-button ' + (activeSupport ? 'is-supporting' : '')} onClick={e => { e.stopPropagation(); toggleSupport(id); }}><OfficialSymbol kind="boost" /></button> : <span title={t.boost}><OfficialSymbol kind="boost" /></span>)}
                </div>
                <button type="button" data-grade-toggle data-testid={'grade-' + id} aria-label={label + ' ' + t.edit_grade} className="slot-grade" onClick={e => openGrade(e, id)}>{unit.grade}</button>
            </div>
            {showInterceptShield && <button type="button" data-shield-toggle data-testid={'shield-' + id} aria-label={label + ' ' + t.shield_value + ' ' + formatNumber(getUnitShield(unit))} className="slot-shield" onClick={e => openShield(e, id)}><Shield size={11} /><span>{formatNumber(getUnitShield(unit))}</span></button>}
            <PowerNumber value={power} maxSize={power.toString().length > 8 ? 22 : 34} resetKey={id} className={'unit-power font-mono ' + numberTone} />
            <div className="slot-critical">{unit.isRested && <span className="unit-rest-label" aria-hidden="true">{t.rest}</span>}{unit.crit !== 1 && <><OfficialSymbol kind="critical" /><span>{unit.crit}</span></>}{reserved && <OfficialSymbol kind="intercept" />}</div>
            <div className={'slot-actions' + (id.startsWith('back') && power > 0 ? ' slot-rear-actions' : '')}>
                {id.startsWith('back') && power > 0 && <button type="button" aria-label={t.rear_attack} aria-pressed={unit.isBackRowAttack} disabled={reserved} className={'slot-symbol-button ' + (unit.isBackRowAttack ? 'is-attacking' : '')} onClick={e => { e.stopPropagation(); modifyUnit(id, { isBackRowAttack: !unit.isBackRowAttack, isSupporting: false }); }}><Sword size={15} /></button>}
                <button type="button" aria-label={t.rest} disabled={unit.isRested || reserved} onClick={e => { e.stopPropagation(); restUnit(id); }}><OfficialSymbol kind="rest" /></button>
                <button type="button" aria-label={t.stand} disabled={!unit.isRested || reserved} onClick={e => { e.stopPropagation(); standUnit(id); }}><OfficialSymbol kind="stand" /></button>
                <button type="button" aria-label={t.retire} disabled={reserved || isVanguardSlot} className="text-red-500" onClick={e => { e.stopPropagation(); handleRetire(id); }}><Trash2 size={14} /></button>
            </div>
        </div>;
    };

    const renderTurnPanel = () => <aside className="turn-panel" role="region" aria-label={t.turn_controls} id="top-controls">
        <button type="button" className="turn-close" aria-label={t.close} onClick={() => setShowTopControls(false)}><X size={14} /></button>
        <div className="turn-actions" inert={gameState.pendingTrigger ? true : undefined}>
            <button type="button" disabled={gameState.isMultiSupportMode} onClick={handleTurnStart} className="bg-green-800/50 text-green-300 border border-green-700"><OfficialSymbol kind="stand" />{t.turn_start}</button>
            <button type="button" data-testid="ride-action" disabled={gameState.isMultiSupportMode || vanguardUnit.grade >= 4 || vanguardUnit.isStriding} onClick={rideNextGrade} className="bg-blue-900/50 text-blue-300 border border-blue-700">{vanguardUnit.grade >= 3 ? t.stride : t.ride_next}</button>
            <button type="button" disabled={gameState.isMultiSupportMode} onClick={() => applyFrontRowBuff(10000)} className="bg-purple-700/50 text-purple-300 border border-purple-600">{t.front_buff}</button>
            <button type="button" disabled={gameState.isMultiSupportMode} onClick={roundStateReset} className="bg-red-800/50 text-red-300 border border-red-700">{t.turn_end}</button>
            <button type="button" data-testid="free-support" aria-pressed={gameState.isMultiSupportMode} onClick={toggleFreeSupport} className={gameState.isMultiSupportMode ? 'bg-orange-600/50 text-white border border-orange-400' : 'bg-slate-900 text-slate-400 border border-slate-700'}><OfficialSymbol kind="boost" />{t.free_support}</button>
            <button type="button" data-testid="back-intercept" aria-pressed={gameState.allowBackIntercept} onClick={() => updateState({ allowBackIntercept: !stateRef.current.allowBackIntercept })} className={gameState.allowBackIntercept ? 'bg-blue-900/50 text-blue-300 border border-blue-700' : 'bg-slate-900 text-slate-400 border border-slate-700'}><OfficialSymbol kind="intercept" />{t.back_intercept}</button>
            <button type="button" data-testid="attack-undo" disabled={gameState.attackHistory.length === 0 || !!gameState.pendingTrigger || gameState.isMultiSupportMode} onClick={handleAttackUndo} className="bg-yellow-800/30 text-yellow-300 border border-yellow-800"><RotateCcw size={14} />{actionCopy.undo}</button>
        </div>
    </aside>;

    const renderGuardCircle = () => <div className={'guard-circle-row ' + (dragState?.target === 'guard' ? 'is-drop-target' : '')}>
        {['critical', 'draw', 'over', 'heal', 'front'].map(kind => <button type="button" key={kind} className={'trigger-button trigger-' + kind} data-testid={'trigger-' + kind} aria-label={triggerNames[kind]} title={triggerNames[kind]} aria-pressed={gameState.pendingTrigger?.kind === kind} disabled={!!gameState.pendingTrigger || gameState.isMultiSupportMode} onClick={() => beginTrigger(kind)}><TriggerSymbol kind={kind} /></button>)}
        <div role="group" tabIndex={0} aria-label={t.guard_circle + ' ' + formatNumber(currentGuard)} data-testid="guard-circle" data-guard-drop data-value={currentGuard}
            className="guard-circle" onClick={() => { if (gameState.pendingTrigger || gameState.isMultiSupportMode) return; setPowerEditor(null); setSelectedSlot('guard'); setGradeEditor(null); setShieldEditor(null); setShowTools(false); }}
            onKeyDown={e => { if (!gameState.pendingTrigger && !gameState.isMultiSupportMode && e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setSelectedSlot('guard'); } }}>
            <span aria-hidden="true" className="unit-circle circle-guard" />
            <span className="guard-emblem" aria-hidden="true">G</span>
            <PowerNumber value={currentGuard} maxSize={30} className="guard-number" />
        </div>
        {gameState.pendingTrigger && <div className="trigger-choice" role="status"><span>{gameState.pendingTrigger.stage === 'critical' ? triggerNames.crit : triggerNames.power}</span><button type="button" data-testid="trigger-cancel" aria-label={triggerNames.cancel} onClick={cancelTrigger}><X size={14} /></button></div>}
        <div className="guard-reservations">{gameState.guardSlots.map(slot => <button type="button" key={slot} disabled={!!gameState.pendingTrigger} data-testid={'guard-reserved-' + slot} aria-label={t.cancel_guard + ' ' + ({ front_left: t.front_l, front_right: t.front_r, back_left: t.back_l, back_center: t.back_c, back_right: t.back_r })[slot]} onClick={() => updateState({ guardSlots: stateRef.current.guardSlots.filter(id => id !== slot) })}><OfficialSymbol kind="intercept" /><span>{formatNumber(getUnitShield(gameState.units[slot]))}</span><X size={12} /></button>)}</div>
    </div>;

    const renderGuardDrawer = () => <div className="drawer-backdrop" onClick={() => setSelectedSlot(null)}><div className="unit-drawer guard-drawer fixed bottom-0 inset-x-0 bg-[#0b1120] border-t border-slate-700 rounded-t-2xl z-50" role="dialog" aria-modal="true" aria-label={t.defense} onClick={e => e.stopPropagation()}>
        <div className="drawer-content p-3 max-w-md mx-auto space-y-3">
            <div className="drawer-heading border-b border-slate-800">
                <div className="drawer-toolbar"><span className="drawer-unit-name">{t.guard_circle}</span><span /><button type="button" data-testid="unit-close" className="drawer-close" aria-label={t.close} onClick={() => setSelectedSlot(null)}><X size={18} /></button></div>
                <div className="drawer-summary"><div className="drawer-number-stack"><LivePowerValue value={vanguardPower + currentGuard} unitKey="guard" className="text-green-400" /><div className="drawer-power-parts"><span>{t.vanguard} <b>{formatNumber(vanguardPower)}</b></span><span>{t.shield_value} <b>{formatNumber(currentGuard)}</b></span></div></div>
                    <button type="button" data-testid="perfect-guard" aria-pressed={gameState.resources.sentinelActive} disabled={!gameState.resources.sentinelActive && gameState.resources.sentinelsRemaining === 0} className={'perfect-guard-button ' + (gameState.resources.sentinelActive ? 'is-active' : '')} onClick={handlePerfectGuard}><Shield size={18} /><span>{gameState.resources.sentinelActive ? t.pg_off : t.pg_button}</span><b>{gameState.resources.sentinelsRemaining}</b></button>
                </div>
            </div>
            <div className="guard-status" data-testid="guard-status" data-safe={required5kIncrements === 0}>{required5kIncrements === 0 ? t.guard_success : <>{t.guard_need}<b>{formatNumber(required5kIncrements * 5000)}</b></>}</div>
            <section className="guard-input-section"><label htmlFor="opponent-power">{t.opponent_atk}</label><input id="opponent-power" type="number" min="0" inputMode="numeric" value={opponentAttackPower ?? ''} placeholder={t.opponent_atk} onChange={e => setOpponentAttackPower(e.target.value === '' ? null : Math.max(0, finite(e.target.value)))} /><div className="guard-presets">{ATTACK_PRESETS.map(power => <button type="button" key={power} aria-pressed={opponentAttackPower === power} onClick={() => setOpponentAttackPower(power)}>{power / 1000}k</button>)}</div></section>
            <section className="guard-input-section"><label htmlFor="manual-shield">{t.manual_shield}</label><input id="manual-shield" type="number" min="0" inputMode="numeric" value={gameState.resources.shield} onChange={e => updateState({ resources: { ...stateRef.current.resources, shield: Math.max(0, finite(e.target.value)) } })} /><div className="guard-presets">{SHIELD_ACTIONS.map(action => <button type="button" key={action.val} onClick={() => updateState({ resources: { ...stateRef.current.resources, shield: Math.max(0, stateRef.current.resources.shield + action.val) } })}>{action['label_' + language]}</button>)}</div></section>
            {gameState.guardSlots.length > 0 && <div className="guard-added-shield"><OfficialSymbol kind="intercept" /><span>{t.intercept} {gameState.guardSlots.length}</span><b>{formatNumber(interceptShield)}</b></div>}
            <div className="guard-finish"><button type="button" onClick={resetDefensePhase}>{t.cancel_guard}</button><button type="button" data-testid="guard-resolve" onClick={settleGuard}>{t.settle_guard}</button></div>
        </div>
    </div></div>;

    const getAttackDetails = (frontId, backId, attackerId) => {
        const attacker = gameState.units[attackerId];
        const otherId = attackerId === frontId ? backId : frontId;
        const supports = gameState.isMultiSupportMode
            ? gameState.supportSlots.filter(id => id !== attackerId && isFreeSupportTarget(id, gameState)).map(id => [id, gameState.units[id]])
            : !gameState.guardSlots.includes(otherId) && gameState.units[otherId].hasBoost && gameState.units[otherId].isSupporting && !gameState.units[otherId].isRested ? [[otherId, gameState.units[otherId]]] : [];
        const supportPower = supports.reduce((sum, [, unit]) => sum + getUnitPower(unit), 0);
        return { power: getUnitPower(attacker) + supportPower, supported: supportPower > 0 };
    };
    const TotalPowerDisplay = ({ frontId, backId, attackerId = frontId }) => {
        const { power, supported } = getAttackDetails(frontId, backId, attackerId);
        return <div className="column-total" data-testid={`total-${attackerId}`} data-value={power} data-rested={gameState.units[attackerId].isRested}>
            <div className="column-total-label">{supported ? t.column_total_supporting : t.column_total_solo}</div>
            <PowerNumber value={power} maxSize={power.toString().length > 8 ? 18 : 22} className={`font-mono ${supported ? 'text-green-400' : 'text-cyan-400'}`} />
        </div>;
    };
    const ColumnAttackButton = ({ frontId, backId, attackerId = frontId, compact = false }) => {
        const attacker = gameState.units[attackerId];
        const isBack = attackerId === backId;
        const disabled = !!gameState.pendingTrigger || gameState.guardSlots.includes(attackerId) || attacker.isRested || getUnitPower(attacker) <= 0 || (isBack && !attacker.isBackRowAttack);
        return <button type="button" data-testid={`attack-${attackerId}`} onClick={() => attackColumn(frontId, backId, attackerId)} disabled={disabled}
            className={`column-attack w-full rounded-lg font-bold text-xs transition-colors border ${compact ? 'attack-between' : 'py-2 mt-1'} ${disabled ? 'bg-slate-900 text-slate-600 border-slate-900 opacity-50' : 'bg-red-800/50 text-red-300 border-red-700 hover:bg-red-700/70 active:scale-[0.98]'}`}>
            {actionCopy.attack}
        </button>;
    };

    if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-cyan-500 font-mono tracking-widest">{t.system_booting}</div>;

    return (
        <div className={'vg-app min-h-screen bg-black text-slate-200 font-sans overflow-x-hidden' + (showTopControls ? ' turn-open' : '') + (showTools ? ' tools-open' : '') + (showGuard ? ' guard-open' : '')} data-skin={gameState.skin} data-effects={gameState.effects}>
            <header className="bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-4 py-2 flex justify-between items-center shadow-xl sticky top-0 z-40">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-5 bg-cyan-500 rounded-sm shadow-[0_0_8px_#06b6d4]"></div>
                    <h1 className="font-bold text-base tracking-widest text-white font-mono"><button type="button" className="brand-title" data-testid="brand-title" onClick={tapBrand}>{t.app_name}</button></h1>
                </div>
                <div className="header-actions flex items-center gap-3">
                    <div className="relative">
                        <button data-testid="attack-count-toggle" onClick={() => setShowAttackAdjust(!showAttackAdjust)} className="attack-count-button flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-full text-xs hover:bg-slate-700 transition-colors">
                            <Sword size={12} className="text-yellow-400" />
                            <span className="text-slate-300 font-bold">{t.attack}: {gameState.attackCount}</span>
                        </button>
                        {showAttackAdjust && (
                            <div className="attack-adjust absolute right-0 mt-1 w-40 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-2 z-50">
                                <div className="flex justify-between items-center text-sm font-mono text-white">
                                    <button onClick={() => updateState({ attackCount: gameState.attackCount - 1 })} className="p-1 bg-slate-800 rounded hover:bg-slate-700"><Minus size={14} /></button>
                                    <span className="text-yellow-400 font-bold">{gameState.attackCount}</span>
                                    <button onClick={() => updateState({ attackCount: gameState.attackCount + 1 })} className="p-1 bg-slate-800 rounded hover:bg-slate-700"><Plus size={14} /></button>
                                </div>
                                <button onClick={() => updateState({ attackCount: 0 })} className="w-full mt-1 text-[10px] text-red-400 bg-red-900/20 py-0.5 rounded">{t.reset}</button>
                            </div>
                        )}
                    </div>
                    <button type="button" className="guard-toggle" data-testid="guard-toggle" aria-label={t.guard_circle} aria-expanded={showGuard} aria-controls="guard-circle-area" onClick={() => togglePanel('guard')}><Shield size={17} /><ChevronDown size={12} className={showGuard ? 'is-open' : ''} /></button>
                    <div className="relative header-settings"><button aria-label={t.settings} data-testid="settings-toggle" onClick={() => togglePanel('tools')} className={`p-2 rounded transition-colors ${showTools ? 'text-cyan-400 bg-cyan-950' : 'text-slate-400'}`}><Settings2 size={18} /></button></div>
                </div>
            </header>
            <PwaUpdateNotice language={language} />
            <button type="button" className="edge-handle edge-left" data-testid="turn-toggle" aria-label={t.turn_controls} aria-expanded={showTopControls} aria-controls="top-controls" onClick={() => togglePanel('turn')}><RefreshCcw size={14} /><span>{language === 'zh' ? '回合' : language === 'ja' ? 'ターン' : 'Turn'}</span></button>
            <button type="button" className="edge-handle edge-right" data-testid="settings-edge" aria-label={t.settings} aria-expanded={showTools} onClick={() => togglePanel('tools')}><Settings2 size={14} /><span>{t.settings}</span></button>
            {showTopControls && renderTurnPanel()}
            {storageWarning && <p role="status" className="p-3 text-amber-300">本地保存失败，当前操作仍可继续；请保持页面打开。</p>}
            {showTools && (
                <div className="drawer-backdrop tools-backdrop" onClick={() => setShowTools(false)}><div role={wideScreen ? 'region' : 'dialog'} aria-modal={wideScreen ? undefined : true} aria-label={t.settings} onClick={e => e.stopPropagation()} className="tools-panel mx-4 mt-2 bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-2xl mb-4">
                    <div className="tools-heading flex justify-between items-center"><span className="text-sm text-slate-300">{t.settings}</span><button aria-label={t.close} onClick={() => setShowTools(false)} className="p-2"><X size={20} /></button></div>
                    <div className="border-b border-slate-800 pb-2 mb-3">
                        <div className="flex justify-between text-[10px] text-cyan-500 mb-2 uppercase tracking-wider items-center"><Globe size={12} className="mr-1" />{t.language}</div>
                        <div className="grid grid-cols-3 gap-2">{LANGUAGES.map(lang => (<button key={lang.code} onClick={() => handleLanguageChange(lang.code)} className={`py-1.5 rounded text-xs font-bold transition-colors border ${language === lang.code ? 'bg-cyan-700/50 text-white border-cyan-500' : 'bg-slate-800/50 text-slate-300 border-slate-700 hover:bg-slate-700/50'}`}>{lang.name}</button>))}</div>
                    </div>
                    <PwaTools language={language} />
                    <AppearanceControls skin={gameState.skin} effects={gameState.effects} t={t} onSkin={skin=>updateState({skin})} onEffects={effects=>updateState({effects})}/>
                    <ChanceTools t={t} />
                    <div className="free-counters">
                        <div className="text-xs text-slate-400 mb-2">{t.counter}</div>
                        {gameState.extraCounters.map((counter, index) => <div key={index} className="free-counter" data-testid={`counter-${index}`}>
                            <input aria-label={t.counter_name} placeholder={t.counter} value={counter.name} onChange={e => modifyCounter(index, { name: e.target.value })} />
                            <button type="button" aria-label={t.decrease} onClick={() => modifyCounter(index, { value: stateRef.current.extraCounters[index].value - 1 })}>−</button>
                            <output aria-live="polite" data-value={counter.value} className="font-mono"><PowerNumber value={counter.value} maxSize={22} /></output>
                            <button type="button" aria-label={t.increase} onClick={() => modifyCounter(index, { value: stateRef.current.extraCounters[index].value + 1 })}>+</button>
                            <button type="button" aria-label={t.remove_counter} className="text-red-400" onClick={() => updateState({ extraCounters: stateRef.current.extraCounters.filter((_, i) => i !== index) })}><X size={12} /></button>
                        </div>)}
                        <button type="button" className="counter-add text-slate-400" onClick={() => updateState({ extraCounters: [...stateRef.current.extraCounters, { name: '', value: 0 }] })}>{t.add_counter}</button>
                    </div>
                    <label className="pg-settings">{t.pg_remaining}<input data-testid="pg-remaining" type="number" min="0" value={gameState.resources.sentinelsRemaining} onChange={e => updateState({ resources: { ...stateRef.current.resources, sentinelsRemaining: Math.max(0, Math.trunc(finite(e.target.value))) } })} /></label>
                    <details className="grade-settings border-t border-slate-800 pt-2 mt-3" inert={gameState.pendingTrigger || gameState.isMultiSupportMode ? true : undefined}>
                        <summary className="text-xs text-slate-400">{t.grade_presets}</summary>
                        <div className="grid grid-cols-4 gap-1.5 mb-3 bg-slate-950 p-2 rounded">
                            {GRADE_PRESETS.map((preset, idx) => (
                                <div key={idx} className="flex flex-col items-center gap-1">
                                    <div className="text-[9px] text-slate-400 font-bold">G{idx}</div>
                                    <input
                                        type="number"
                                        value={preset}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            if (!isNaN(val)) {
                                                const newPresets = [...GRADE_PRESETS];
                                                newPresets[idx] = val;
                                                // Update global state
                                                const newUnits = cloneUnits(stateRef.current.units);
                                                Object.entries(newUnits).forEach(([slot, unit]) => {
                                                    if (unit.grade === idx && unit.basePower === GRADE_PRESETS[idx] && (idx > 0 || slot === 'front_center')) newUnits[slot] = { ...unit, basePower: val };
                                                });
                                                updateState({ units: newUnits });
                                                GRADE_PRESETS.splice(0, GRADE_PRESETS.length, ...newPresets);
                                                updateState({ gradePresets: newPresets });
                                            }
                                        }}
                                        className="w-full bg-slate-800 text-slate-200 text-[10px] px-1 py-0.5 rounded outline-none border border-slate-700 focus:border-cyan-400 text-center font-mono"
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2 justify-end mt-2">
                            <button onClick={() => addGradePreset()} className="px-2 py-1 text-xs bg-cyan-800 text-white rounded">{t.add_grade}</button>
                            <button onClick={() => removeGradePreset()} className="px-2 py-1 text-xs bg-red-800 text-white rounded">{t.remove_grade}</button>
                        </div>
                    </details>
                </div></div>
            )}
            <main className="battle-main p-3 max-w-md mx-auto">
                {showGuard && <section id="guard-circle-area">{renderGuardCircle()}</section>}
                <section className="field-section">
                    <BattleSpells effects={gameState.effects ? combatEffects : []} units={gameState.units} t={t}/>
                    {gameState.isMultiSupportMode && <div className="support-choice" role="status"><span>{actionCopy.choose_support} · {gameState.supportSlots.length}</span><button type="button" data-testid="support-cancel" aria-label={actionCopy.cancel_support} onClick={cancelFreeSupport}><X size={14} /></button></div>}
                    <div className={'battle-board grid grid-cols-3 gap-2' + (hasBackRowAttack ? ' has-back-attack' : '')}>
                        {columns.map(column => renderUnitSlot(`front_${column}`, column === 'center' ? t.vanguard : column === 'left' ? t.front_l : t.front_r))}
                        {hasBackRowAttack && columns.map(column => <ColumnAttackButton key={`front-attack-${column}`} frontId={`front_${column}`} backId={`back_${column}`} attackerId={`front_${column}`} compact />)}
                        {columns.map(column => renderUnitSlot(`back_${column}`, column === 'left' ? t.back_l : column === 'center' ? t.back_c : t.back_r))}
                        {columns.map(column => { const attackerId = `${hasBackRowAttack ? 'back' : 'front'}_${column}`; return <div key={`attack-${column}`} className="attack-lane min-w-0"><TotalPowerDisplay frontId={`front_${column}`} backId={`back_${column}`} attackerId={attackerId} /><ColumnAttackButton frontId={`front_${column}`} backId={`back_${column}`} attackerId={attackerId} /></div>; })}
                    </div>
                </section>
                <section className="energy-section bg-slate-900/50 border border-slate-700 rounded-xl p-3">
                    <div className="flex justify-between items-end mb-2 border-b border-slate-800 pb-2"><h2 className="text-[10px] font-bold text-cyan-500 uppercase tracking-[0.2em] flex items-center gap-1"><Zap size={12} /> {t.energy}</h2><div className="text-2xl font-black text-white font-mono leading-none text-shadow-neon">{gameState.energy} / {MAX_ENERGY}</div></div>
                    <div className="flex justify-between gap-0.5 h-8 items-center px-1 mb-3 relative">
                        <div className="absolute left-1 right-1 h-0.5 bg-slate-800 top-1/2 -translate-y-1/2 z-0"></div>
                        {Array.from({ length: 11 }).map((_, i) => (<button key={i} onClick={() => setEnergy(i)} aria-label={`${t.energy}: ${i}`} aria-pressed={i === gameState.energy} data-energy-state={i === gameState.energy ? 'current' : i < gameState.energy ? 'filled' : 'empty'} className="energy-node relative z-10"/>))}
                    </div>
                    <div className="energy-actions grid grid-cols-6 gap-1.5">{ENERGY_ACTIONS.map(action => (<button key={action.label_zh} onClick={() => setEnergy(gameState.energy + action.value)} className={`${action.color} border border-cyan-800/50 rounded py-1 text-[10px] font-bold`}>{action[`label_${language}`]}</button>))}</div>
                </section>

                <MatchPanel match={gameState.match} resources={gameState.resources} canRestore={!!gameState.resetBackup} t={t} onTimer={()=>updateState({match:toggleMatchTimer(stateRef.current.match)},false,{kind:'timer'})} onReset={()=>openMatchDialog('reset')} onRestore={()=>openMatchDialog('restore')} onCounter={(key,delta)=>updateState({resources:{...stateRef.current.resources,[key]:Math.max(0,stateRef.current.resources[key]+delta)}})}/>
            </main>
            <div className="field-horizon" aria-hidden="true"><i/><i/><i/></div>
            {selectedSlot && selectedSlot !== 'guard' && (
                <div className="drawer-backdrop" onClick={() => setSelectedSlot(null)}>
                    <div role="dialog" aria-modal="true" aria-label={t.unit_adj} onClick={e => e.stopPropagation()} className="unit-drawer fixed bottom-0 inset-x-0 bg-[#0b1120] border-t border-slate-700 rounded-t-2xl shadow-[0_-5px_50px_rgba(0,0,0,0.9)] z-50">
                        <div className="drawer-content p-3 max-w-md mx-auto space-y-3">
                            <div className="drawer-heading border-b border-slate-800">
                                <div className="drawer-toolbar">
                                    <span className="drawer-unit-name text-white">{({ front_left: t.front_l, front_center: t.vanguard, front_right: t.front_r, back_left: t.back_l, back_center: t.back_c, back_right: t.back_r })[selectedSlot]}</span>
                                    <button type="button" data-grade-toggle data-testid="drawer-grade" className="drawer-grade" aria-label={t.edit_grade} onClick={e => openGrade(e, selectedSlot)}><span>G</span><b>{gameState.units[selectedSlot].grade}</b><ChevronDown size={12} /></button>
                                    <button type="button" data-testid="unit-close" aria-label={t.close} onClick={() => setSelectedSlot(null)} className="drawer-close bg-slate-800 rounded-full text-slate-400 hover:bg-slate-700"><X size={18} /></button>
                                </div>
                                <div className="drawer-summary">
                                    <div className="drawer-number-stack">
                                        <div className="drawer-value-switch" data-mode={unitValueMode}>
                                            <button type="button" data-testid="edit-mode-power" aria-pressed={!editingShield} className={'drawer-value-button power-value-button ' + (!editingShield ? 'is-active' : '')} onClick={() => selectUnitValue('power')}><span className="drawer-value-label">{t.power_value}</span><LivePowerValue unitKey={selectedSlot} value={getUnitPower(gameState.units[selectedSlot])} className={selectedSlot === 'front_center' ? 'text-blue-400' : getUnitPower(gameState.units[selectedSlot]) < 0 ? 'text-red-500' : 'text-yellow-400'} /></button>
                                            <button type="button" data-testid="edit-mode-shield" aria-pressed={editingShield} className={'drawer-value-button shield-value-button ' + (editingShield ? 'is-active' : '')} onClick={() => selectUnitValue('shield')}><span className="drawer-value-label"><Shield size={10} />{t.shield_value}</span><LivePowerValue unitKey={selectedSlot + '-shield'} value={getUnitShield(gameState.units[selectedSlot])} testId="drawer-shield" maxSize={26} className="text-green-400" /></button>
                                        </div>
                                        <div className="drawer-power-parts">
                                            <button type="button" data-testid="edit-base" aria-expanded={powerEditor === baseKey} onClick={() => openPowerEditor(baseKey)}>{t.base_short} <b>{formatNumber(gameState.units[selectedSlot][baseKey])}</b></button>
                                            <button type="button" data-testid="edit-buff" aria-expanded={powerEditor === buffKey} onClick={() => openPowerEditor(buffKey)}>{t.buff_short} <b>{gameState.units[selectedSlot][buffKey] >= 0 ? '+' : ''}{formatNumber(gameState.units[selectedSlot][buffKey])}</b></button>
                                        </div>
                                    </div>
                                    <div className="drawer-critical">
                                        <button type="button" aria-label={t.critical_down} disabled={gameState.units[selectedSlot].crit === 0} onClick={() => modifyUnit(selectedSlot, { crit: stateRef.current.units[selectedSlot].crit - 1 })} className="bg-slate-800 text-slate-400 rounded">−</button>
                                        <output aria-label={t.crit_full} aria-live="polite" data-testid="critical-value" data-value={gameState.units[selectedSlot].crit} className="text-yellow-500 font-mono"><OfficialSymbol kind="critical" /><RollingDigits value={gameState.units[selectedSlot].crit} resetKey={selectedSlot} /></output>
                                        <button type="button" aria-label={t.critical_up} onClick={() => modifyUnit(selectedSlot, { crit: stateRef.current.units[selectedSlot].crit + 1 })} className="bg-slate-800 text-slate-400 rounded">+</button>
                                    </div>
                                </div>
                            </div>
                            {powerEditor && <form className="inline-power-editor" onSubmit={applyPowerEditor}>
                                <label htmlFor="power-edit">{powerEditor === 'basePower' ? t.base_power_setup : powerEditor === 'shield' ? t.shield_base : powerEditor === 'shieldBuff' ? t.shield_buff : t.power_buff_adj}</label>
                                <input id="power-edit" autoFocus type="number" inputMode="numeric" aria-label={powerEditor === 'basePower' ? t.custom_value : powerEditor === 'shield' ? t.shield_value : powerEditor === 'shieldBuff' ? t.shield_buff : t.manual_buff} value={editValue} onChange={e => setEditValue(e.target.value)} />
                                <button type="submit">{t.set_base}</button><button type="button" aria-label={t.close} onClick={() => setPowerEditor(null)}><X size={16} /></button>
                            </form>}
                            <section className="power-section" data-testid="base-section">
                                <div className="power-section-heading"><span>{editingShield ? t.shield_base : t.base_power_setup}</span><button type="button" onClick={() => modifyUnit(selectedSlot, { [baseKey]: 0 })}>{t.reset_base}</button></div>
                                <div className={'base-presets grid grid-cols-5 gap-1.5' + (editingShield ? ' shield-base-presets' : '')}>{(editingShield ? SHIELD_PRESETS : BASE_PRESETS).map(preset => <button type="button" key={preset.val} onClick={() => modifyUnit(selectedSlot, { [baseKey]: preset.val })} className="bg-slate-900 border border-slate-700 text-slate-300 text-xs font-mono rounded hover:border-blue-500/50">{preset.label}</button>)}</div>
                            </section>
                            <section className="power-section" data-testid="buff-section">
                                <div className="power-section-heading"><span>{editingShield ? t.shield_buff : t.power_buff_adj}</span><button type="button" onClick={() => modifyUnit(selectedSlot, { [buffKey]: 0, ...(!editingShield ? { otActive: false } : {}) })}>{t.reset_buff}</button></div>
                                <div className="grid grid-cols-3 gap-2">{POS_NEG_BUFF_BUTTONS.map((button, index) => <button type="button" key={index} onClick={() => modifyUnit(selectedSlot, { [buffKey]: stateRef.current.units[selectedSlot][buffKey] + button.value })} className={button.color + ' border py-2 rounded font-bold text-xs active:scale-95 transition-transform'}>{button['label_' + language]}</button>)}</div>
                                <button type="button" data-testid="unit-ot" disabled={editingShield} title={editingShield ? t.power_only : undefined} aria-pressed={gameState.units[selectedSlot].otActive} onClick={handleOTBuff} className={'ot-button-style w-full mt-2 py-2 rounded text-xs ' + (gameState.units[selectedSlot].otActive ? 'ot-active' : 'ot-inactive')}>{t.ot} ({formatNumber(OT_BUFF_VALUE)})</button>
                            </section>
                            <div className="border-t border-slate-700 pt-2">
                                <span className="block text-[11px] text-slate-500 mb-2">{t.unit_status}</span>
                                <div className="ability-controls">
                                    <button type="button" data-testid="ability-boost" aria-pressed={gameState.units[selectedSlot].hasBoost} onClick={() => modifyUnit(selectedSlot, { hasBoost: !stateRef.current.units[selectedSlot].hasBoost, isSupporting: false })} className={gameState.units[selectedSlot].hasBoost ? 'is-active' : ''}><OfficialSymbol kind="boost" />{t.boost}</button>
                                    <button type="button" data-testid="ability-intercept" aria-pressed={gameState.units[selectedSlot].hasIntercept} onClick={() => modifyUnit(selectedSlot, { hasIntercept: !gameState.units[selectedSlot].hasIntercept })} className={`py-2 rounded text-xs border ${gameState.units[selectedSlot].hasIntercept ? 'bg-blue-700/50 text-white border-blue-500' : 'bg-slate-800 text-slate-400 border-slate-700'}`}><OfficialSymbol kind="intercept" />{t.intercept}</button>
                                    <button type="button" onClick={() => modifyUnit(selectedSlot, { hasDoubleStrike: !gameState.units[selectedSlot].hasDoubleStrike, hasTripleStrike: false })} className={`py-2 rounded text-xs border ${gameState.units[selectedSlot].hasDoubleStrike ? 'bg-purple-700/50 text-white border-purple-500' : 'bg-slate-800 text-slate-400 border-slate-700'}`}><OfficialSymbol kind="doubleDrive" />{t.double_strike}</button>
                                    <button type="button" onClick={() => modifyUnit(selectedSlot, { hasTripleStrike: !gameState.units[selectedSlot].hasTripleStrike, hasDoubleStrike: false })} className={`py-2 rounded text-xs border ${gameState.units[selectedSlot].hasTripleStrike ? 'bg-red-700/50 text-white border-red-500' : 'bg-slate-800 text-slate-400 border-slate-700'}`}><OfficialSymbol kind="tripleDrive" />{t.triple_strike}</button>
                                </div>
                                {selectedSlot !== 'front_center' && gameState.units[selectedSlot].hasIntercept && <button type="button" className="intercept-shield-edit" data-testid="edit-intercept-shield" onClick={() => { setUnitValueMode('shield'); openPowerEditor('shield'); }}><OfficialSymbol kind="intercept" /><span>{t.shield_value}</span><b>{formatNumber(getUnitShield(gameState.units[selectedSlot]))}</b></button>}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {selectedSlot === 'guard' && renderGuardDrawer()}
            {gradeEditor && <GradePicker key={gradeEditor.slot} slot={gradeEditor.slot} unit={gameState.units[gradeEditor.slot]} anchor={gradeEditor.anchor} t={t} onSelect={setUnitGrade} onStep={stepUnitGrade} onClose={() => setGradeEditor(null)} />}
            {shieldEditor && <ShieldPicker key={shieldEditor.slot} slot={shieldEditor.slot} unit={gameState.units[shieldEditor.slot]} anchor={shieldEditor.anchor} t={t} onSelect={(slot, shield) => modifyUnit(slot, { shield })} onClose={() => setShieldEditor(null)} />}
            {matchDialog && <MatchResetDialog key={matchDialog} mode={matchDialog} t={t} onClose={()=>setMatchDialog(null)} onConfirm={confirmMatchAction}/>}
            {secretOpen && <RizenSecret t={t} onClose={()=>setSecretOpen(false)}/>}
            {dragState && <div className="drag-unit-preview" aria-hidden="true" style={{ left: dragState.x, top: dragState.y }}><OfficialSymbol kind="intercept" /><span>{formatNumber(getUnitPower(gameState.units[dragState.slot]))}</span></div>}
            <output className="sr-only" aria-live="polite">{gestureMessage}</output>
            <style>{`
                /* 霓虹阴影效果 */
                .text-shadow-neon { text-shadow: 0 0 8px rgba(6,182,212, 0.6); }

                /* OT animation follows this unit only. */
                .ot-button-style { background: #0f1724; color: #e6eef8; border: 1px solid rgba(255,255,255,0.03); }
                .ot-button-style.ot-active { background: linear-gradient(45deg, #FF0000, #FF7F00, #FFFF00, #00FF00, #0000FF, #4B0082, #9400D3); background-size: 300% 300%; animation: gradientShift 4s ease infinite; box-shadow: 0 0 18px rgba(255,255,255,0.6); color: white; border: none; }
                .ot-button-style.ot-inactive:hover { box-shadow: 0 0 6px rgba(255,255,255,0.04); }
                @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
            `}</style>
        </div>
    );
}

import ReactDOM from 'react-dom/client'

// Render the App defined in this file
class RecoveryBoundary extends React.Component {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    componentDidCatch(error) { console.error('VG render failed', error); }
    render() {
        if (this.state.failed) return <main className="p-6 text-white"><h1>页面遇到了错误</h1><p>已保存的对局记录会保留。请重新载入以恢复。</p><button className="mt-4 p-3 bg-blue-700 rounded" onClick={() => location.reload()}>重新载入</button></main>;
        return this.props.children;
    }
}
ReactDOM.createRoot(document.getElementById('root')).render(<RecoveryBoundary><App /></RecoveryBoundary>);
