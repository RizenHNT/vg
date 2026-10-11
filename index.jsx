import './styles.css';
import './compact.css';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    Sword, Zap, RotateCcw, X, Settings2, Dices, CircleDollarSign,
    Trash2, Move, Shield, Ghost, AlertTriangle, Layers, Crown, CornerUpLeft, Anchor, Plus, Minus, Globe, Users, ChevronsUp,
    RefreshCcw, // 新增的图标，用于回合重置
} from 'lucide-react';

// --- Constants & Data ---
const MAX_ENERGY = 10;
const STORAGE_KEY = 'VG_OFFICIAL_PREVIEW_V1'; // 本地存储使用的键


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
    hasIntercept: false,      // 截击
    hasDoubleStrike: false,   // 双判
    hasTripleStrike: false,   // 三判
};

// 新增：定义 OT 修正值
const OT_BUFF_VALUE = 100000000;

// GRADE presets for Vanguard (G0..G3, extensible for dragon decks with G10 etc)
// Default: [G0, G1, G2, G3] = [5k, 8k, 10k, 13k], but can be modified by user
const DEFAULT_GRADE_PRESETS = [5000, 8000, 10000, 13000];
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
    { val: 8000, label: '8k' },
    { val: 10000, label: '10k' },
    { val: 13000, label: '13k' },
    { val: 15000, label: '15k' },
    { val: 23000, label: '23k' },
    { val: 26000, label: '26k' },
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
    extraCounters: [],
    attackCount: 0,
    attackHistory: [],
    isMultiSupportMode: false,
    personaBonus: 0,
};

// Sanitize legacy saves before rendering. Every slot must have numeric fields.
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) && value !== null ? Number(value) : fallback;
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
        for (const key of ['basePower', 'powerBuff', 'crit', 'grade']) unit[key] = finite(unit[key], initial[key]);
        unit.grade = Math.max(0, Math.trunc(unit.grade));
        unit.crit = Math.max(0, unit.crit);
        for (const key of ['isRested', 'isSupporting', 'isBackRowAttack', 'hasIntercept', 'hasDoubleStrike', 'hasTripleStrike', 'otActive']) unit[key] = unit[key] === true;
        unit.isVanguard = slot === 'front_center';
        unit.isFrontRow = slot.startsWith('front');
        return [slot, unit];
    }));
    const resources = { ...INITIAL_RESOURCES, ...raw.resources };
    for (const key of Object.keys(INITIAL_RESOURCES)) {
        resources[key] = key === 'sentinelActive' ? !!resources[key] : Math.max(0, finite(resources[key], INITIAL_RESOURCES[key]));
    }
    return { ...INITIAL_GAME_STATE, ...raw, units, resources,
        personaBonus: Math.max(0, finite(raw.personaBonus)),
        energy: Math.max(0, Math.min(MAX_ENERGY, finite(raw.energy))),
        attackCount: Math.max(0, finite(raw.attackCount)),
        extraCounters: Array.isArray(raw.extraCounters) ? raw.extraCounters.filter(c => c && typeof c === 'object').map(c => ({ name: String(c.name ?? ''), value: finite(c.value) })) : [],
        attackHistory: Array.isArray(raw.attackHistory) ? raw.attackHistory.filter(h => h && h.units).slice(-100).map(h => ({ ...h, units: normalizeState({ units: h.units }).units, attackCount: finite(h.attackCount) })) : [],
    };
};
const cloneUnits = (units) => Object.fromEntries(Object.entries(units).map(([key, unit]) => [key, { ...unit }]));

const formatNumber = (num) => {
    if (num === 0) return '0';
    // 检查是否是 OT 力量值，如果是则显示完整的 100,000,000
    if (num === OT_BUFF_VALUE) return (100000000).toLocaleString();
    return num.toLocaleString();
};

// Fit real glyph widths, including a late-loading web font and large OT totals.
function PowerNumber({ value, className = '', maxSize = 34 }) {
    const box = useRef(null);
    const text = useRef(null);
    useEffect(() => {
        const fit = () => {
            if (!box.current || !text.current) return;
            const available = box.current.clientWidth - 2;
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
        return () => { mounted = false; observer?.disconnect(); };
    }, [value, maxSize]);
    return <span ref={box} className={`power-fit ${className}`}><span ref={text} className="power-value" style={{ fontSize: maxSize }}>{formatNumber(value)}</span></span>;
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

export default function App() {
    const [loading, setLoading] = useState(true);
    const [gameState, setGameState] = useState(INITIAL_GAME_STATE);
    const [selectedSlot, setSelectedSlot] = useState('front_center');
    const [editorTab, setEditorTab] = useState('power');
    const [swapMode, setSwapMode] = useState(false);
    const [swapSource, setSwapSource] = useState(null);
    const [showTools, setShowTools] = useState(false);
    const [manualInput, setManualInput] = useState("");
    const [diceResult, setDiceResult] = useState(null);
    const [coinResult, setCoinResult] = useState(null);
    const [customBasePower, setCustomBasePower] = useState("");
    const [opponentAttackPower, setOpponentAttackPower] = useState(null);
    const [showAttackAdjust, setShowAttackAdjust] = useState(false);
    const [language, setLanguage] = useState('zh');

    // 新增：手动设置 G 盾值的输入状态
    const [manualGuardInput, setManualGuardInput] = useState("");

    // 新增：存储单位的特殊模式（后排支援/后排攻击）


    // 新增：存储单位的 G 级别（可手动调整）

    const stateRef = useRef(gameState);
    const [storageWarning, setStorageWarning] = useState(false);

    // 新增：G 标签编辑模式


    // 操作 G 预设（增加/删除）
    const addGradePreset = (val) => {
        const suggested = typeof val === 'number' ? val : (GRADE_PRESETS[GRADE_PRESETS.length - 1] + 5000);
        GRADE_PRESETS.push(suggested);
        // trigger UI refresh
        updateState({});
    };

    const removeGradePreset = () => {
        if (GRADE_PRESETS.length <= 1) return;
        GRADE_PRESETS.pop();
        updateState({});
    };

    const t = TRANSLATIONS[language] || TRANSLATIONS.zh;

    const getUnitPower = (unit) => (unit?.basePower || 0) + (unit?.powerBuff || 0) + (unit?.isFrontRow && (unit.basePower || unit.powerBuff) ? gameState.personaBonus : 0);

    // 计算单位的 G 级别将由 detectGradeFromPower 决定（基于可编辑的 GRADE_PRESETS）

    // 新增：获取单位的状态标签（截击、双判、三判、支援）
    const getUnitStatusLabel = (unit) => {
        if (unit.hasDoubleStrike) return t.double_strike;
        if (unit.hasTripleStrike) return t.triple_strike;
        if (unit.hasIntercept) return t.intercept;
        if (unit.isSupporting) return t.boost;
        return null;
    };

    // 新增：获取右上角显示的 G 标签（如"G0-支援"、"G1-截击"）
    const getGradeLabel = (unit) => {
        const gradeNum = unit.grade;
        const statusLabel = getUnitStatusLabel(unit);
        if (statusLabel) {
            return `G${gradeNum}-${statusLabel}`;
        }
        return `G${gradeNum}`;
    };

    // --- Local Storage Persistence ---

    // 1. Load state from Local Storage on component mount
    useEffect(() => {
        try {
            const persistedState = localStorage.getItem(STORAGE_KEY);
            if (persistedState) {
                const loadedState = JSON.parse(persistedState);

                const restored = normalizeState(loadedState);
                GRADE_PRESETS = Array.isArray(loadedState.gradePresets) && loadedState.gradePresets.length ? loadedState.gradePresets.map(v => Math.max(0, finite(v))) : [...DEFAULT_GRADE_PRESETS];
                stateRef.current = restored;
                setGameState(restored);
                setLanguage(TRANSLATIONS[loadedState.language] ? loadedState.language : 'zh');
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
    const updateState = (newData, updateLanguage = false) => {
        const nextState = normalizeState({ ...stateRef.current, ...newData });
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

    useEffect(() => {
        const close = (event) => {
            if (event.key === 'Escape') { setShowTools(false); setShowAttackAdjust(false); }
        };
        document.addEventListener('keydown', close);
        return () => document.removeEventListener('keydown', close);
    }, []);

    // Quick actions use the latest state and share undo snapshots with attacks.
    const commitQuickAction = (changes) => {
        const current = stateRef.current;
        const snapshot = { units: cloneUnits(current.units), resources: { ...current.resources }, personaBonus: current.personaBonus, attackCount: current.attackCount };
        updateState({ ...changes, attackHistory: [...current.attackHistory, snapshot].slice(-100) });
    };
    const slotLabel = (slot) => ({ front_left: t.front_l, front_center: t.vanguard, front_right: t.front_r, back_left: t.back_l, back_center: t.back_c, back_right: t.back_r })[slot];
    const quickPower = (slot, value, call = false) => {
        const current = stateRef.current;
        const unit = current.units[slot];
        const next = call ? { ...unit, basePower: value, grade: value === 8000 ? 1 : 2, isSupporting: slot.startsWith('back') && value === 8000 && !unit.isRested } : { ...unit, powerBuff: unit.powerBuff + value };
        commitQuickAction({ units: { ...current.units, [slot]: next } });
        setSelectedSlot(slot);
    };
    const activatePersona = () => {
        if (stateRef.current.personaBonus) return;
        commitQuickAction({ personaBonus: 10000 });
    };
    const applyTrigger = (kind, target = selectedSlot || 'front_center') => {
        const current = stateRef.current;
        const units = cloneUnits(current.units);
        if (kind !== 'front' && !(units[target].basePower || units[target].powerBuff)) return;
        if (kind === 'front') {
            for (const slot of ['front_left', 'front_center', 'front_right']) {
                if (units[slot].basePower || units[slot].powerBuff) units[slot].powerBuff += 10000;
            }
        } else {
            units[target].powerBuff += kind === 'ot' ? OT_BUFF_VALUE : 10000;
            if (kind === 'crit') units[target].crit += 1;
            if (kind === 'ot') units[target].otActive = true;
        }
        // These are calculation shortcuts. Physical zones are not tracked automatically.
        commitQuickAction({ units });
    };

    // --- Logic ---
    const vanguardUnit = gameState.units.front_center || INITIAL_UNIT;
    const vanguardPower = getUnitPower(vanguardUnit);
    const currentGuard = gameState.resources.shield;

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

    const modifyUnit = useCallback((slot, changes) => {
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
                !newUnit.isBackRowAttack
            ) {
                if (!newUnit.isSupporting && newUnit.grade <= 1 && !newUnit.isRested) newUnit.isSupporting = true;
            }
        }

        if (newUnit.crit < 0) newUnit.crit = 0;

        const newUnits = { ...stateRef.current.units, [slot]: newUnit };
        updateState({ units: newUnits });
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

    // 3. 后排支援按钮：支援 ↔ 后排攻击 切换
    const toggleSupport = useCallback((slot) => {
        const unit = gameState.units[slot];
        if (unit.isRested) return;
        const totalPower = getUnitPower(unit);

        const isFrontRow = slot.startsWith('front');
        const isBackRow = slot.startsWith('back');

        // 没力量不能支持/攻击
        if (totalPower === 0) return;
        // ✅ 兜底：如果两个状态都 true，就先统一成“后排攻击”
        if (isBackRow && unit.isSupporting && unit.isBackRowAttack) {
            modifyUnit(slot, { isSupporting: false, isBackRowAttack: true });
            return;
        }

        // 后排单位：支援 ↔ 后排攻击 循环切换
        if (isBackRow) {
            // 循环切换：无 → 支援 → 后排攻击 → 无
            if (!unit.isSupporting && !unit.isBackRowAttack) {
                // 当前无状态，切换到支援
                modifyUnit(slot, { isSupporting: true, isBackRowAttack: false });
            } else if (unit.isSupporting && !unit.isBackRowAttack) {
                // 当前支援状态，切换到后排攻击
                modifyUnit(slot, { isSupporting: false, isBackRowAttack: true });
            } else if (!unit.isSupporting && unit.isBackRowAttack) {
                // 当前后排攻击状态，切换回无状态
                modifyUnit(slot, { isSupporting: false, isBackRowAttack: false });
            }
            return;
        }

        // 前列：多重支援模式下可以手动切换支援状态
        if (isFrontRow && gameState.isMultiSupportMode) {
            modifyUnit(slot, { isSupporting: !unit.isSupporting });
        }
    }, [gameState.units, gameState.isMultiSupportMode, modifyUnit]);

    const handleAttackUndo = () => {
        if (gameState.attackHistory.length === 0) return;
        const lastState = gameState.attackHistory[gameState.attackHistory.length - 1];
        const newHistory = gameState.attackHistory.slice(0, -1);
        updateState({
            units: lastState.units,
            attackCount: lastState.attackCount,
            attackHistory: newHistory,
            ...(lastState.resources ? { resources: lastState.resources } : {}),
            ...(lastState.personaBonus !== undefined ? { personaBonus: lastState.personaBonus } : {}),
        });
       
    };

    const attackColumn = (frontSlot, backSlot, explicitAttackerSlot) => {
        // Determine attacker: prefer explicitAttackerSlot if provided and valid
        const frontUnit = gameState.units[frontSlot];
        const backUnit = gameState.units[backSlot];
        let attackerSlot = frontSlot;
        if (explicitAttackerSlot && gameState.units[explicitAttackerSlot] && !gameState.units[explicitAttackerSlot].isRested && getUnitPower(gameState.units[explicitAttackerSlot]) > 0) {
            attackerSlot = explicitAttackerSlot;
        } else {
            const canBackAttack = backUnit && backUnit.isBackRowAttack && !backUnit.isRested && getUnitPower(backUnit) > 0;
            attackerSlot = canBackAttack ? backSlot : frontSlot;
        }

        // If attacker is rested or has no power, abort
        const attacker = gameState.units[attackerSlot];
        if (!attacker || attacker.isRested || getUnitPower(attacker) === 0) return;

        const historyEntry = { units: cloneUnits(gameState.units), attackCount: gameState.attackCount };
        const newUnits = cloneUnits(stateRef.current.units);

        // Mark attacker as rested and cancel its support
        newUnits[attackerSlot] = { ...newUnits[attackerSlot], isRested: true, isSupporting: false };

        if (gameState.isMultiSupportMode) {
            // Multi-Support Mode: 横置所有当前支援单位（除了已横置的 attacker）
            Object.keys(newUnits).forEach(key => {
                if (key !== attackerSlot && newUnits[key].isSupporting && !newUnits[key].isRested) {
                    newUnits[key] = { ...newUnits[key], isRested: true, isSupporting: false };
                }
            });
        } else {
            // Standard Mode: 横置同列的另一个槽（如果它在支援状态）
            const col = attackerSlot.split('_')[1];
            const otherSlot = (attackerSlot.startsWith('front') ? `back_${col}` : `front_${col}`);
            if (newUnits[otherSlot] && newUnits[otherSlot].isSupporting && !newUnits[otherSlot].isRested) {
                newUnits[otherSlot] = { ...newUnits[otherSlot], isRested: true, isSupporting: false };
            }
        }

        updateState({ units: newUnits, attackCount: gameState.attackCount + 1, attackHistory: [...gameState.attackHistory, historyEntry].slice(-100) });
        setSelectedSlot('front_center');
    };

    // Stand phase / clear prior temporary state; Ride and energy are separate explicit actions.
    const handleTurnStart = () => {
        const newUnits = cloneUnits(stateRef.current.units);

        // 竖置所有单位
        Object.keys(newUnits).forEach(slot => {
            const unit = newUnits[slot];
            unit.isRested = false;
            const isBackRow = slot.startsWith('back');
            const totalPower = getUnitPower({ ...unit, powerBuff: 0 });
            if (isBackRow && totalPower > 0 && unit.grade <= 1 && !unit.isBackRowAttack) {
                unit.isSupporting = true;
            }
        });

        Object.values(newUnits).forEach(unit => { unit.powerBuff = 0; unit.otActive = false; unit.crit = 1; });
        updateState({ units: newUnits, personaBonus: 0, attackCount: 0, attackHistory: [], resources: { ...gameState.resources, shield: 0, sentinelActive: false } });
        setSelectedSlot('front_center');
    };

    const rideNextGrade = () => {
        const newUnits = cloneUnits(stateRef.current.units);
        // Ride to the next configured grade, using the unit’s explicit grade.
        const v = newUnits.front_center;
        if (v) {
            const currentGradeIdx = v.grade;
            const maxGradeIdx = GRADE_PRESETS.length - 1;
            if (currentGradeIdx < maxGradeIdx) {
                const nextGrade = currentGradeIdx + 1;
                const nextBasePower = GRADE_PRESETS[nextGrade];
                newUnits.front_center = { ...v, grade: nextGrade, basePower: nextBasePower };
            }
        }

        updateState({ units: newUnits });
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
        setSelectedSlot('front_center');
    };

    // 回合结束重置：只清除修正值和暴击等附加状态，不竖置单位
    const roundStateReset = () => {
        const newUnits = cloneUnits(stateRef.current.units);
        Object.keys(newUnits).forEach(slot => {
            const unit = newUnits[slot];
            unit.otActive = false;
            unit.powerBuff = 0; // 清空修正值
            unit.crit = 1; // 重置暴击倍数
            // 不修改 isRested 和 isSupporting，保持当前状态
        });
        updateState({ units: newUnits, personaBonus: 0, attackCount: 0, attackHistory: [] });
        setSelectedSlot('front_center');
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
        let newResources = { ...gameState.resources, shield: Math.max(0, newShield) };

        // 如果手动修改了G值，自动取消PG状态
        if (gameState.resources.sentinelActive && delta !== 0) {
            newResources.sentinelActive = false;
        }

        updateState({ resources: newResources });
    };

    const handleSlotClick = (slot) => {
        if (swapMode) {
            if (!swapSource) {
                setSwapSource(slot);
            } else {
                const newUnits = cloneUnits(stateRef.current.units);
                const temp = { ...newUnits[swapSource] };
                newUnits[swapSource] = { ...newUnits[slot] };
                newUnits[slot] = temp;
                // Normalize: ensure only front_center is flagged as vanguard
                Object.keys(newUnits).forEach(k => {
                    if (k === 'front_center') {
                        newUnits[k] = { ...newUnits[k], isVanguard: true, isSupporting: false };
                    } else if (k.startsWith('front')) {
                        // Other front slots should not be marked as supporting
                        newUnits[k] = { ...newUnits[k], isVanguard: false, isSupporting: false };
                    } else {
                        // back slots keep their isSupporting/isBackRowAttack as-is
                        newUnits[k] = { ...newUnits[k], isVanguard: false };
                    }
                });
                updateState({ units: newUnits });
                setSwapSource(null);
                setSwapMode(false);
            }
        } else {
            setCustomBasePower(''); setManualInput('');
            setShowTools(false); setShowAttackAdjust(false);
            setSelectedSlot(slot); if (!(stateRef.current.units[slot].basePower || stateRef.current.units[slot].powerBuff)) setEditorTab('base');
        }
    };

    const handleRetire = useCallback((slot) => {
        modifyUnit(slot, { ...INITIAL_UNIT, isVanguard: slot === 'front_center' });
        setSelectedSlot(slot); setEditorTab('base');
    }, [modifyUnit]);

    const setEnergy = (val) => {
        if (val === -100) val = 0;
        updateState({ energy: Math.max(0, Math.min(MAX_ENERGY, val)) });
    }

    // 5. PG 按钮优化成开关
    const handlePerfectGuard = () => {
        if (gameState.resources.sentinelActive) {
            // PG 激活中，点击则取消
            updateState({
                resources: {
                    ...gameState.resources,
                    sentinelActive: false,
                    sentinelsRemaining: gameState.resources.sentinelsRemaining + 1,
                    shield: 0 // 取消时清零 G 值
                }
            });
            setOpponentAttackPower(null);
        } else if (gameState.resources.sentinelsRemaining > 0) {
            // PG 未激活且有剩余，点击则激活

            const newSentinels = gameState.resources.sentinelsRemaining - 1;
            updateState({
                resources: {
                    ...gameState.resources,
                    sentinelActive: true,
                    sentinelsRemaining: newSentinels,
                    shield: 0
                }
            });
            setOpponentAttackPower(null);
        } else {
            console.warn("No Sentinels (PGs) remaining!");
        }
    };

    const resetDefensePhase = () => {
        updateState({
            resources: { ...gameState.resources, shield: 0, sentinelActive: false }
        });
        setOpponentAttackPower(null);
    }

    const handleLanguageChange = (code) => {
        updateState({ language: code }, true);
        setShowTools(false);
    };

    // 新增：OT 按钮的点击处理
    const handleOTBuff = () => {
        if (!selectedSlot) return;
        const unit = gameState.units[selectedSlot] || {};
        const current = unit.powerBuff || 0;
        // Toggle OT buff on the selected slot
        if (unit.otActive) {
            modifyUnit(selectedSlot, { powerBuff: current - OT_BUFF_VALUE, otActive: false });
        } else {
            modifyUnit(selectedSlot, { powerBuff: current + OT_BUFF_VALUE, otActive: true });
        }
    };

    // --- Renderers ---

    const renderUnitSlot = (id, label) => {
        const unit = gameState.units[id];
        const power = getUnitPower(unit);
        const occupied = !!(unit.basePower || unit.powerBuff);
        const isVanguard = id === 'front_center';
        const isSupportable = !isVanguard && (id.startsWith('back') || gameState.isMultiSupportMode);
        const persona = unit.isFrontRow && occupied ? gameState.personaBonus : 0;
        return (
            <article data-testid={`unit-${id}`} className={`field-unit ${isVanguard ? 'vanguard-unit' : 'rear-unit'} ${selectedSlot === id ? 'unit-selected' : ''} ${unit.isRested ? 'unit-rested' : ''} ${swapSource === id ? 'swap-source' : ''}`}>
                <span className="official-circle" aria-hidden="true" />
                <div className="unit-heading"><span>{label}</span><button aria-label={`${label} ${t.edit_grade}`} onClick={() => { setSelectedSlot(id); setEditorTab('base'); setShowTools(false); }} className="grade-button">G{unit.grade}{persona > 0 && <span className="persona-marker" aria-label="Persona 生效">P</span>}</button></div>
                <button type="button" className="unit-select" aria-label={`选择${label}`} aria-pressed={selectedSlot === id} onClick={() => handleSlotClick(id)}>
                    <PowerNumber value={power} className={`unit-power ${unit.otActive ? 'ot-power' : ''}`} maxSize={String(Math.abs(power)).length > 7 ? 25 : 34} />
                    <span className="unit-meta"><span>{t.base_short}<PowerNumber value={unit.basePower} maxSize={14} /></span><span>{t.buff_short}<PowerNumber value={unit.powerBuff + persona} maxSize={14} /></span></span>
                </button>
                <div className="unit-status">
                    {isSupportable ? <button aria-label={`${label} 支援模式`} onClick={() => toggleSupport(id)} disabled={unit.isRested || !occupied}>{unit.isRested ? '横置' : unit.isBackRowAttack ? '后排攻' : unit.isSupporting ? '支援中' : '支援'}</button> : <span>{[unit.isRested ? '横置' : '',unit.hasTripleStrike ? '三判' : unit.hasDoubleStrike ? '双判' : '',unit.hasIntercept ? '截' : ''].filter(Boolean).join('·')}</span>}
                    <span className="unit-critical">★{unit.crit}{isSupportable && unit.hasIntercept && <small> 截</small>}</span>
                </div>
            </article>
        );
    };

    const TotalPowerDisplay = ({ frontId, backId }) => {
        const frontUnit = gameState.units[frontId] || INITIAL_UNIT;
        const backUnit = gameState.units[backId] || INITIAL_UNIT;
        const useBack = backUnit.isBackRowAttack && !backUnit.isRested && getUnitPower(backUnit) > 0;
        const attackerUnit = useBack ? backUnit : frontUnit;
        const frontPower = getUnitPower(attackerUnit);

        let supportPower = 0;
        if (gameState.isMultiSupportMode) {
            // Multi Mode: Sum all active supporting units (front and back)
            Object.values(gameState.units).forEach(u => {
                if (u.isSupporting && !u.isRested) {
                    supportPower += getUnitPower(u);
                }
            });
            // The front unit of this column is the attacker, it shouldn't be counted as support power for its own column.
            // Subtract its power if it was somehow marked as supporting in this total calculation
            if (attackerUnit.isSupporting && !attackerUnit.isRested) {
                supportPower = Math.max(0, supportPower - frontPower);
            }

        } else {
            // Standard Mode: Only back unit
            if (!useBack && backUnit.isSupporting && !backUnit.isRested) {
                supportPower = getUnitPower(backUnit);
            }
        }

        const totalPower = frontPower + supportPower;

        let label = t.column_total_solo;
        let powerClass = 'text-cyan-400';
        if (supportPower > 0) { label = t.column_total_supporting; powerClass = 'text-green-400'; }
        else if (frontPower > 0 && getUnitPower(backUnit) > 0 && !backUnit.isSupporting) { label = t.column_total_unsupported; powerClass = 'text-slate-500'; }
        else if (gameState.isMultiSupportMode && supportPower === 0 && frontPower > 0) { label = t.column_total_unsupported; powerClass = 'text-slate-500'; }


        if (frontPower === 0 && supportPower === 0 && getUnitPower(backUnit) === 0) {
            return (<div className="h-10 bg-slate-950/50 border border-slate-900 rounded-lg p-1.5 flex items-center justify-center"><span className="text-[8px] text-slate-700 uppercase tracking-widest">{t.no_unit}</span></div>);
        }
        return (
            <div className="h-10 bg-slate-900/50 border border-slate-700 rounded-lg p-1.5 flex flex-col items-center justify-center">
                <div className="text-[9px] text-slate-500 uppercase tracking-widest">{label}</div>
                <PowerNumber value={totalPower} className={`column-power ${powerClass}`} maxSize={String(Math.abs(totalPower)).length > 7 ? 21 : 25} />
            </div>
        );
    };

    const ColumnAttackButton = ({ frontId, backId, attackHandler }) => {
        const frontUnit = gameState.units[frontId] || INITIAL_UNIT;
        const backUnit = gameState.units[backId] || INITIAL_UNIT;
        const isVanguardSlot = frontId === 'front_center';

        // If back unit is in back-row-attack mode, use it as attacker
        const useBackAsAttacker = backUnit.isBackRowAttack && !backUnit.isRested && getUnitPower(backUnit) > 0;
        const attackerUnit = useBackAsAttacker ? backUnit : frontUnit;

        let isSupported = false;
        if (gameState.isMultiSupportMode) {
            Object.values(gameState.units).forEach(u => {
                if (u.isSupporting && !u.isRested) isSupported = true;
            });
        } else {
            if (backUnit && backUnit.isSupporting && !backUnit.isRested) isSupported = true;
        }

        let label = t.attack_solo;
        if (isSupported) label = t.attack_support;
        else if (isVanguardSlot) label = t.attack_vanguard;

        // If using back as attacker, adjust label to indicate back attack
        if (useBackAsAttacker) label = `${label} (${t.back_row_attack_mode})`;

        return (
            <button
                onClick={() => attackHandler(frontId, backId, useBackAsAttacker ? backId : frontId)}
                disabled={attackerUnit.isRested || getUnitPower(attackerUnit) === 0}
                className={`w-full py-2 rounded-lg font-bold text-xs transition-colors border mt-1 ${attackerUnit.isRested || getUnitPower(attackerUnit) === 0 ? 'bg-slate-900 text-slate-600 border-slate-900 cursor-not-allowed opacity-50' : 'bg-red-800/50 text-red-300 border-red-700 hover:bg-red-700/70 active:scale-[0.98]'}`}
            >
                <Sword size={14} className="inline mr-1" /> {label}
            </button>
        );
    }

    if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-cyan-500 font-mono tracking-widest">{t.system_booting}</div>;

    return (
        <div className="vg-app min-h-screen bg-black text-slate-200 font-sans pb-20 overflow-x-hidden" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #1e293b 0%, #020617 100%)' }}>
            <header className="bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-4 py-2 flex justify-between items-center shadow-xl sticky top-0 z-40">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-5 bg-cyan-500 rounded-sm shadow-[0_0_8px_#06b6d4]"></div>
                    <h1 className="font-bold text-base tracking-widest text-white">先导者<span className="brand-os">OS</span></h1>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <button onClick={() => setShowAttackAdjust(!showAttackAdjust)} className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-full text-xs hover:bg-slate-700 transition-colors">
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
                    <div className="relative"><button aria-label={t.unit_adj + " / " + t.language} onClick={() => { setSelectedSlot('front_center'); setShowTools(!showTools); setShowAttackAdjust(false); }} className={`p-2 rounded transition-colors ${showTools ? 'text-cyan-400 bg-cyan-950' : 'text-slate-400'}`}><Settings2 size={18} /></button></div>
                </div>
            </header>
            {storageWarning && <p role="status" className="p-3 text-amber-300">本地保存失败，当前操作仍可继续；请保持页面打开。</p>}
            {showTools && (
                <div role="region" aria-label={t.language} className="tools-panel mx-4 mt-2 bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-2xl mb-4">
                    <div className="tools-heading flex justify-end"><button aria-label="Close settings" onClick={() => setShowTools(false)} className="p-2"><X size={20} /></button></div>
                    <div className="settings-actions"><button aria-pressed={gameState.isMultiSupportMode} onClick={() => updateState({isMultiSupportMode:!gameState.isMultiSupportMode})}>{gameState.isMultiSupportMode ? t.multi_support : t.std_support}</button><button onClick={roundStateReset}>{t.round_reset}</button></div>
                    <div className="border-b border-slate-800 pb-2 mb-3">
                        <div className="flex justify-between text-[10px] text-cyan-500 mb-2 uppercase tracking-wider items-center"><Globe size={12} className="mr-1" />{t.language}</div>
                        <div className="grid grid-cols-3 gap-2">{LANGUAGES.map(lang => (<button key={lang.code} onClick={() => handleLanguageChange(lang.code)} className={`py-1.5 rounded text-xs font-bold transition-colors border ${language === lang.code ? 'bg-cyan-700/50 text-white border-cyan-500' : 'bg-slate-800/50 text-slate-300 border-slate-700 hover:bg-slate-700/50'}`}>{lang.name}</button>))}</div>
                    </div>
                    <div className="flex gap-3 mb-3">
                        <div className="flex-1 bg-slate-950 border border-slate-800 p-2 rounded flex flex-col items-center gap-1"><div className="text-2xl font-bold text-cyan-400 h-8">{diceResult || <Dices className="opacity-50" size={20} />}</div><button onClick={() => { setDiceResult(null); setTimeout(() => setDiceResult(Math.floor(Math.random() * 6) + 1), 200); }} className="text-[10px] bg-slate-800 w-full py-1 rounded hover:bg-slate-700">D6 {t.attack}</button></div>
                        <div className="flex-1 bg-slate-950 border border-slate-800 p-2 rounded flex flex-col items-center gap-1"><div className="text-lg font-bold text-yellow-500 h-8 flex items-center">{coinResult || <CircleDollarSign className="opacity-50" size={20} />}</div><button onClick={() => { setCoinResult(null); setTimeout(() => setCoinResult(Math.random() > 0.5 ? "HEADS" : "TAILS"), 200); }} className="text-[10px] bg-slate-800 w-full py-1 rounded hover:bg-slate-700">Coin Flip</button></div>
                    </div>
                    <div className="border-t border-slate-800 pt-2 mb-3">
                        <div className="flex justify-between text-[10px] text-slate-500 mb-2 uppercase tracking-wider">GRADE 预设</div>
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
                                                if (newUnits.front_center && newUnits.front_center.basePower === GRADE_PRESETS[idx]) {
                                                    newUnits.front_center = { ...newUnits.front_center, basePower: val };
                                                }
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
                    </div>
                    <div className="border-t border-slate-800 pt-2">
                        <div className="flex justify-between text-[10px] text-slate-500 mb-2 uppercase tracking-wider">{t.extra_counters}</div>
                        {gameState.extraCounters.map((c, idx) => (
                            <div key={idx} className="flex items-center justify-between mb-2 bg-slate-950 p-1.5 rounded border border-slate-800">
                                <input value={c.name} onChange={(e) => { const nc = [...gameState.extraCounters]; nc[idx].name = e.target.value; updateState({ extraCounters: nc }); }} className="bg-transparent w-20 text-xs outline-none text-slate-300" />
                                <div className="flex items-center gap-1">
                                    <button onClick={() => { const nc = [...gameState.extraCounters]; nc[idx].value--; updateState({ extraCounters: nc }); }} className="px-2 bg-slate-800 rounded text-xs h-6">-</button>
                                    <span className="w-6 text-center text-cyan-400 font-bold text-sm">{c.value}</span>
                                    <button onClick={() => { const nc = [...gameState.extraCounters]; nc[idx].value++; updateState({ extraCounters: nc }); }} className="px-2 bg-slate-800 rounded text-xs h-6">+</button>
                                    <button onClick={() => { const nc = gameState.extraCounters.filter((_, i) => i !== idx); updateState({ extraCounters: nc }); }} className="text-red-900 ml-2"><X size={12} /></button>
                                </div>
                            </div>
                        ))}
                        <button onClick={() => updateState({ extraCounters: [...gameState.extraCounters, { name: '计数器', value: 0 }] })} className="w-full py-1.5 text-[10px] border border-dashed border-slate-700 text-slate-500 rounded hover:bg-slate-900"> {t.add_counter} </button>
                    </div>
                </div>
            )}
            <main id="fight-field" className="fight-main p-3 max-w-md mx-auto space-y-4">
                <section className="battle-field">
                    <div className="turn-controls">
                        <button onClick={handleTurnStart}><ChevronsUp size={13} />{t.turn_start}</button>
                        <button onClick={rideNextGrade}>{t.ride_next}</button>
                        <button className={`persona-button ${gameState.personaBonus ? 'persona-on' : ''}`} aria-pressed={!!gameState.personaBonus} onClick={activatePersona} disabled={!!gameState.personaBonus}>Persona Ride{gameState.personaBonus > 0 && <span aria-hidden="true">✓</span>}</button>
                    </div>
                    <div className="field-selection"><span>{swapMode ? (swapSource ? '选择换位目标' : '选择换位单位') : gameState.isMultiSupportMode ? '多重支援' : '标准支援'}</span><button aria-pressed={swapMode} onClick={() => { setSwapMode(!swapMode); setSwapSource(null); }}>{swapMode ? '取消换位' : '换位'}</button></div>
                    <div className="grid grid-cols-3 gap-2">
                        <div className="flex flex-col gap-2">{renderUnitSlot('front_left', t.front_l)}{renderUnitSlot('back_left', t.back_l)}<TotalPowerDisplay frontId="front_left" backId="back_left" /><ColumnAttackButton frontId="front_left" backId="back_left" attackHandler={attackColumn} /></div>
                        <div className="flex flex-col gap-2">{renderUnitSlot('front_center', t.vanguard)}{renderUnitSlot('back_center', t.back_c)}<TotalPowerDisplay frontId="front_center" backId="back_center" /><ColumnAttackButton frontId="front_center" backId="back_center" attackHandler={attackColumn} /></div>
                        <div className="flex flex-col gap-2">{renderUnitSlot('front_right', t.front_r)}{renderUnitSlot('back_right', t.back_r)}<TotalPowerDisplay frontId="front_right" backId="back_right" /><ColumnAttackButton frontId="front_right" backId="back_right" attackHandler={attackColumn} /></div>
                    </div>
                    <section className="unit-editor" aria-label={t.unit_adj}>
                        <div className="editor-heading"><strong>{slotLabel(selectedSlot || 'front_center')}</strong><button className="undo-button" onClick={handleAttackUndo} disabled={gameState.attackHistory.length === 0}><CornerUpLeft size={13} />{t.undo_attack}</button></div>
                        <div className="editor-tabs" role="tablist" aria-label="单位编辑分类">
                            {[['power','修正'],['base','基础 / G'],['status','状态']].map(([key,label]) => <button key={key} id={`edit-tab-${key}`} role="tab" aria-selected={editorTab === key} aria-controls={`edit-panel-${key}`} onClick={() => setEditorTab(key)}>{label}</button>)}
                        </div>
                        {(() => {
                            const slot = selectedSlot || 'front_center';
                            const unit = gameState.units[slot];
                            const change = (patch) => modifyUnit(slot, patch);
                            return <>
                                <div id="edit-panel-power" role="tabpanel" aria-labelledby="edit-tab-power" hidden={editorTab !== 'power'}>
                                    <div className="buff-actions">{POS_NEG_BUFF_BUTTONS.map(btn => <button key={btn.value} className={btn.value < 0 ? 'negative' : ''} onClick={() => quickPower(slot, btn.value)}>{btn[`label_${language}`]}</button>)}</div>
                                    <div className="trigger-buttons" aria-label="判定快捷操作">
                                        {[['crit','暴击','★'],['draw','抽判','↥'],['front','前判','↑↑'],['heal','治判','✚'],['ot','超判','OT']].map(([kind,label,icon]) => <button key={kind} className={`trigger-${kind}`} disabled={kind !== 'front' && !(unit.basePower || unit.powerBuff)} onClick={() => applyTrigger(kind)}><span aria-hidden="true">{icon}</span>{label}</button>)}
                                    </div>
                                    <div className="crit-actions"><button aria-label="暴击减1" onClick={() => change({crit: Math.max(0,unit.crit-1)})}>−</button><span>★ {unit.crit}</span><button aria-label="暴击加1" onClick={() => change({crit: unit.crit+1})}>+</button><button className="quiet-button" onClick={() => change({powerBuff:0,otActive:false})}>{t.reset_buff}</button><details className="custom-power"><summary>自定义</summary><div><input type="number" inputMode="numeric" aria-label={t.manual_buff} placeholder="修正值" value={manualInput} onChange={e => setManualInput(e.target.value)} /><button aria-label="增加自定义修正" onClick={() => {if(manualInput !== '') quickPower(slot,finite(manualInput));setManualInput('');}}>+</button><button aria-label="减少自定义修正" onClick={() => {if(manualInput !== '') quickPower(slot,-finite(manualInput));setManualInput('');}}>−</button><button aria-pressed={unit.otActive} onClick={handleOTBuff}>OT 开关</button></div></details></div>
                                </div>
                                <div id="edit-panel-base" role="tabpanel" aria-labelledby="edit-tab-base" hidden={editorTab !== 'base'}>
                                    <div className="base-actions">{BASE_PRESETS.map(preset => <button key={preset.val} onClick={() => change({basePower:preset.val})}>{preset.label}</button>)}</div>
                                    <div className="grade-actions"><label htmlFor="unit-grade">G</label><input id="unit-grade" type="number" min="0" value={unit.grade} onChange={e => change({grade:Math.max(0,finite(e.target.value))})} />{[0,1,2,3].map(grade => <button key={grade} onClick={() => change({grade})}>G{grade}</button>)}</div>
                                    <div className="base-custom"><input type="number" inputMode="numeric" aria-label={t.custom_value} placeholder={t.custom_value} value={customBasePower} onChange={e => setCustomBasePower(e.target.value)} /><button onClick={() => {if(customBasePower !== '') change({basePower:Math.max(0,finite(customBasePower))});setCustomBasePower('');}}>{t.set_base}</button><button onClick={() => change({basePower:0})}>{t.reset_base}</button></div>
                                </div>
                                <div id="edit-panel-status" role="tabpanel" aria-labelledby="edit-tab-status" hidden={editorTab !== 'status'}>
                                    <div className="state-actions">
                                        <button aria-pressed={unit.isRested} onClick={() => unit.isRested ? standUnit(slot) : restUnit(slot)}>{unit.isRested ? t.stand : t.rest}</button>
                                        <button aria-pressed={unit.hasIntercept} onClick={() => change({hasIntercept:!unit.hasIntercept})}>{t.intercept}</button>
                                        <button aria-pressed={unit.hasDoubleStrike} onClick={() => change({hasDoubleStrike:!unit.hasDoubleStrike,hasTripleStrike:false})}>{t.double_strike}</button>
                                        <button aria-pressed={unit.hasTripleStrike} onClick={() => change({hasTripleStrike:!unit.hasTripleStrike,hasDoubleStrike:false})}>{t.triple_strike}</button>
                                        <button disabled={slot === 'front_center' || unit.isRested || !(unit.basePower || unit.powerBuff)} aria-pressed={unit.isSupporting || unit.isBackRowAttack} onClick={() => toggleSupport(slot)}>{unit.isBackRowAttack ? t.back_row_attack_mode : unit.isSupporting ? t.support_off : t.support_on}</button>
                                        <button className="retire-button" onClick={() => handleRetire(slot)}><Trash2 size={13} />{t.retire}</button>
                                    </div>
                                </div>
                            </>;
                        })()}
                    </section>
                </section>
                <section className="energy-panel bg-slate-900/50 border border-slate-700 rounded-xl p-3">
                    <div className="flex justify-between items-end mb-2 border-b border-slate-800 pb-2"><h2 className="text-[10px] font-bold text-cyan-500 uppercase tracking-[0.2em] flex items-center gap-1"><Zap size={12} /> {t.energy}</h2><div className="text-2xl font-black text-white font-mono leading-none text-shadow-neon">{gameState.energy} / {MAX_ENERGY}</div></div>
                    <div className="energy-rail">
                        {Array.from({length:11}).map((_,i) => <button key={i} aria-label={`能量 ${i}`} aria-pressed={i === gameState.energy} onClick={() => setEnergy(i)}><span className={`energy-dot ${i <= gameState.energy ? 'energy-filled' : ''}`} aria-hidden="true">{i === gameState.energy && <i />}</span></button>)}
                    </div>
                    <div className="grid grid-cols-6 gap-1.5">{ENERGY_ACTIONS.map(action => (<button key={action.label_zh} onClick={() => setEnergy(action.value === -100 ? 0 : stateRef.current.energy + action.value)} className={`${action.color} border border-cyan-800/50 rounded py-1 text-[10px] font-bold`}>{action[`label_${language}`]}</button>))}</div>
                </section>
                <section className="guard-panel">
                    <div className="bg-slate-900/60 border border-blue-900/30 rounded-lg p-2 flex flex-col">
                        <div className="flex justify-between items-center mb-1"><div className="text-[10px] text-blue-400 uppercase font-bold flex items-center gap-1"><Shield size={10} /> {t.g_shield}</div><div className="text-2xl font-mono font-black text-white">{formatNumber(currentGuard)}</div></div>
                        {/* Opponent ATK Input (Existing) */}
                        <div className="mb-2"><input type="number" value={opponentAttackPower === null ? '' : opponentAttackPower} onChange={(e) => { const val = e.target.value; if (val === '') { setOpponentAttackPower(null); } else { const parsedVal = parseInt(val); setOpponentAttackPower(!isNaN(parsedVal) && parsedVal >= 0 ? parsedVal : 0); } }} aria-label={t.opponent_atk} placeholder={t.opponent_atk} className="w-full bg-blue-950/30 text-white text-sm px-2 py-1 rounded outline-none font-mono border border-blue-800 focus:border-cyan-400" /></div>

                        {/* 差异计算区域 */}
                        {currentAttackTarget > 0 && (<div className="bg-blue-950/20 border-b border-blue-800/50 p-1 mb-2"><div className="text-[9px] text-slate-400 flex justify-between"><span>{isDifferenceMode ? `${t.base_diff} (${t.opponent_atk} ${formatNumber(currentAttackTarget)} - ${t.vanguard} ${formatNumber(vanguardPower)}):` : `${t.base_diff} (${t.vanguard} ATK):`}</span><span className="font-mono text-yellow-400">{formatNumber(Math.max(0, currentAttackTarget - vanguardPower))}</span></div><div className="text-[9px] text-slate-400 flex justify-between border-t border-slate-800/50 mt-1 pt-1"><span>{t.current_g}</span><span className="font-mono text-blue-300 font-bold">{formatNumber(currentGuard)}</span></div>{required5kIncrements > 0 ? (<div className="text-[11px] text-red-400 font-bold flex justify-between mt-1 pt-1 border-t border-red-900/30"><span>{t.required_g_inc}</span><span className="font-mono">{required5kIncrements}</span></div>) : (<div className="text-[11px] text-green-400 font-bold flex justify-center mt-1 pt-1 border-t border-green-900/30"><span>{t.guard_success}</span></div>)}</div>)}

                        {/* G 盾值操作网格 (4列) - 包含快速调整按钮和手动设置区域 */}
                        <div className="grid grid-cols-4 gap-1 mt-auto">
                            {/* 快速调整按钮 (已新增 -15k) */}
                            {SHIELD_ACTIONS.map(p => (
                                <button key={p.val} onClick={() => modifyShield(p.val)} className={`${p.color} border border-blue-900/30 text-[9px] rounded py-1.5 font-bold`}>
                                    {p[`label_${language}`]}
                                </button>
                            ))}

                            {/* 手动设置 G 值区域 (占满 4 列) */}
                            <div className="col-span-4 flex items-center gap-1 mt-1">
                                <button
                                    onClick={() => modifyShield(-1000)}
                                    className="w-6 h-6 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 flex items-center justify-center text-xs"
                                >
                                    <Minus size={10} />
                                </button>
                                <input
                                    type="number"
                                    value={manualGuardInput}
                                    onChange={(e) => setManualGuardInput(e.target.value)}
                                    placeholder={t.set_shield_manual}
                                    className="flex-grow min-w-0 bg-blue-950/30 text-white text-[10px] px-1 py-0.5 rounded outline-none font-mono border border-blue-800 focus:border-cyan-400 text-center"
                                />
                                <button
                                    onClick={() => modifyShield(1000)}
                                    className="w-6 h-6 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 flex items-center justify-center text-xs"
                                >
                                    <Plus size={10} />
                                </button>
                                <button
                                    onClick={() => {
                                        const val = parseInt(manualGuardInput);
                                        if (!isNaN(val) && val >= 0) {
                                            modifyShield(val - currentGuard); // 传入差值
                                        }
                                        setManualGuardInput("");
                                    }}
                                    className="flex-shrink-0 bg-yellow-800/50 text-yellow-300 border border-yellow-700 rounded text-[9px] font-bold px-1.5 py-0.5 hover:bg-yellow-700/70"
                                >
                                    {t.set_shield_button}
                                </button>
                            </div>

                            {/* G 值清零按钮 */}
                            <button onClick={resetDefensePhase} className="bg-slate-700/50 text-slate-300 rounded p-1 flex items-center justify-center text-[9px] font-bold col-span-4 hover:bg-slate-600/50 transition-colors"><RotateCcw size={10} className="mr-1" /> {t.g_reset}</button>
                        </div>
                        {/* 5. PG 按钮优化成开关 */}
                        <button onClick={handlePerfectGuard} disabled={!gameState.resources.sentinelActive && gameState.resources.sentinelsRemaining === 0} className={`mt-2 w-full text-[10px] font-bold py-1 rounded flex items-center justify-center gap-1 transition-colors border ${gameState.resources.sentinelActive ? 'bg-green-600/70 text-white border-green-500/50 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-800 text-slate-500 hover:bg-green-900/50 border-slate-700'} ${!gameState.resources.sentinelActive && gameState.resources.sentinelsRemaining === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <Crown size={10} />
                            {gameState.resources.sentinelActive ? t.pg_off : `${t.pg_button} (${gameState.resources.sentinelsRemaining})`}
                        </button>
                    </div>
                </section>
                <details className="optional-counters"><summary>计数工具</summary>                    <div className="grid grid-rows-3 gap-2">
                        <div className="bg-slate-900/60 border border-purple-900/30 rounded-lg px-3 py-1 flex justify-between items-center"><span className="text-[10px] text-purple-400 uppercase font-bold flex items-center gap-1"><Ghost size={10} /> {t.soul}</span><div className="flex items-center gap-2"><button onClick={() => modifyResource('soul', -1)} className="text-slate-500 hover:text-white">-</button><span className="font-mono font-black w-4 text-center text-white">{gameState.resources.soul}</span><button onClick={() => modifyResource('soul', 1)} className="text-slate-500 hover:text-white">+</button></div></div>
                        <div className="bg-slate-900/60 border border-red-900/30 rounded-lg px-3 py-1 flex justify-between items-center"><span className="text-[10px] text-red-400 uppercase font-bold flex items-center gap-1"><AlertTriangle size={10} /> {t.damage}</span><div className="flex items-center gap-2"><button onClick={() => modifyResource('damage', -1)} className="text-slate-500 hover:text-white">-</button><span className="font-mono font-black w-4 text-center text-red-500">{gameState.resources.damage}</span><button onClick={() => modifyResource('damage', 1)} className="text-slate-500 hover:text-white">+</button></div></div>
                        {/* 详细触发器计数 */}
                        <div className="grid grid-cols-6 gap-1">
                            {/* Crit Trigger */}
                            <div className="bg-slate-900/60 border border-yellow-900/30 rounded-lg px-1 py-1 flex flex-col justify-center items-center col-span-1"><span className="text-[8px] text-yellow-500 uppercase font-bold">{t.crit}</span><div className="font-mono font-black text-sm text-white flex gap-1"><button onClick={() => modifyResource('critTriggers', -1)} className="text-slate-500 hover:text-white text-base leading-none">-</button>{gameState.resources.critTriggers}<button onClick={() => modifyResource('critTriggers', 1)} className="text-slate-500 hover:text-white text-base leading-none">+</button></div></div>
                            {/* Draw Trigger */}
                            <div className="bg-slate-900/60 border border-blue-900/30 rounded-lg px-1 py-1 flex flex-col justify-center items-center col-span-1"><span className="text-[8px] text-blue-500 uppercase font-bold">{t.draw}</span><div className="font-mono font-black text-sm text-white flex gap-1"><button onClick={() => modifyResource('drawTriggers', -1)} className="text-slate-500 hover:text-white text-base leading-none">-</button>{gameState.resources.drawTriggers}<button onClick={() => modifyResource('drawTriggers', 1)} className="text-slate-500 hover:text-white text-base leading-none">+</button></div></div>
                            {/* Front Trigger */}
                            <div className="bg-slate-900/60 border border-green-900/30 rounded-lg px-1 py-1 flex flex-col justify-center items-center col-span-1"><span className="text-[8px] text-green-500 uppercase font-bold">{t.front}</span><div className="font-mono font-black text-sm text-white flex gap-1"><button onClick={() => modifyResource('frontTriggers', -1)} className="text-slate-500 hover:text-white text-base leading-none">-</button>{gameState.resources.frontTriggers}<button onClick={() => modifyResource('frontTriggers', 1)} className="text-slate-500 hover:text-white text-base leading-none">+</button></div></div>
                            {/* Heal Trigger */}
                            <div className="bg-slate-900/60 border border-red-900/30 rounded-lg px-1 py-1 flex flex-col justify-center items-center col-span-1"><span className="text-[8px] text-red-500 uppercase font-bold">{t.heal}</span><div className="font-mono font-black text-sm text-white flex gap-1"><button onClick={() => modifyResource('healTriggers', -1)} className="text-slate-500 hover:text-white text-base leading-none">-</button>{gameState.resources.healTriggers}<button onClick={() => modifyResource('healTriggers', 1)} className="text-slate-500 hover:text-white text-base leading-none">+</button></div></div>
                            {/* OT Trigger */}
                            <div className="bg-slate-900/60 border border-orange-900/30 rounded-lg px-1 py-1 flex flex-col justify-center items-center col-span-1">
                                <span className="text-[8px] text-orange-400 uppercase font-bold">{t.ot}</span>
                                <div className="font-mono font-black text-sm text-white flex gap-1">
                                    <button onClick={() => modifyResource('otTriggers', -1)} className="text-slate-500 hover:text-white text-base leading-none">-</button>
                                    {gameState.resources.otTriggers}
                                    <button onClick={() => modifyResource('otTriggers', 1)} className="text-slate-500 hover:text-white text-base leading-none">+</button>
                                </div>
                            </div>
                            {/* PG/Sentinel Counter */}
                            <div className="bg-slate-900/60 border border-cyan-900/30 rounded-lg px-1 py-1 flex flex-col justify-center items-center col-span-1"><span className="text-[8px] text-cyan-400 uppercase font-bold">{t.pg_remaining}</span><div className="font-mono font-black text-sm text-white flex gap-1"><button onClick={() => modifyResource('sentinelsRemaining', -1)} className="text-slate-500 hover:text-white text-base leading-none">-</button>{gameState.resources.sentinelsRemaining}<button onClick={() => modifyResource('sentinelsRemaining', 1)} className="text-slate-500 hover:text-white text-base leading-none">+</button></div></div>
                        </div>
                    </div>
                </details>
            </main>
            <style>{`
                /* 霓虹阴影效果 */
                .text-shadow-neon { text-shadow: 0 0 8px rgba(6,182,212, 0.6); }

                /* 🌈 七彩文本效果 - 用于 OT 力量值 文本 */
                .rainbow-text {
                    background: linear-gradient(90deg, #FF0000, #FF7F00, #FFFF00, #00FF00, #0000FF, #4B0082, #9400D3);
                    -webkit-background-clip: text;
                    background-clip: text;
                    color: transparent;
                    animation: colorShift 5s infinite linear;
                    background-size: 200% 100%;
                    text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
                }
                @keyframes colorShift { 0% { background-position: 100% 0%; } 100% { background-position: 0% 0%; } }

                /* slot rainbow glow when OT applied */
                .rainbow-glow { box-shadow: 0 0 14px rgba(255,255,255,0.04), 0 0 24px currentColor; animation: hueShift 1.5s linear infinite; }
                @keyframes hueShift { 0%{filter:hue-rotate(0deg)}50%{filter:hue-rotate(180deg)}100%{filter:hue-rotate(360deg)} }

                /* OT 按钮：默认不发光，只有在任一单位处于 OT 时才启用渐变动画 */
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
