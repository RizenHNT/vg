import './styles.css';
import './drawer-enhancements.css';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    Sword, Zap, RotateCcw, X, Settings2, Dices, CircleDollarSign,
    Trash2, Move, Shield, Ghost, AlertTriangle, Layers, Crown, CornerUpLeft, Anchor, Plus, Minus, Globe, Users, ChevronsUp,
    RefreshCcw, // 新增的图标，用于回合重置
} from 'lucide-react';

// --- Constants & Data ---
const MAX_ENERGY = 10;
const STORAGE_KEY = 'VG_DRAWER_PREVIEW_V1'; // 隔离审阅，不写正式站存档


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

// Editable shortcuts for this calculator, not universal printed card powers.
const DEFAULT_GRADE_PRESETS = [6000, 8000, 10000, 13000, 28000];
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
        energy: Math.max(0, Math.min(MAX_ENERGY, finite(raw.energy))),
        attackCount: Math.max(0, finite(raw.attackCount)),
        extraCounters, resourceCountersMigrated: true,
        attackHistory: Array.isArray(raw.attackHistory) ? raw.attackHistory.filter(h => h && h.units).slice(-100).map(h => ({ units: normalizeState({ units: h.units }).units, attackCount: finite(h.attackCount) })) : [],
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
            const before = previous[index];
            const rolling = /\d/.test(digit) && before !== digit;
            return rolling ? <span key={`${index}-${frame.serial}`} className="digit-window" data-rolling="true"><span className={`digit-track roll-${frame.direction}`}>
                <span>{frame.direction === 'up' ? before : digit}</span><span>{frame.direction === 'up' ? digit : before}</span>
            </span></span> : <span key={`${index}-${digit}`} className="digit-static">{digit}</span>;
        })}
    </span></>;
}

function PowerNumber({ value, className = '', maxSize = 34, resetKey = '' }) {
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
    return <span ref={box} className={`power-fit ${className}`}><span ref={text} className="power-value" style={{ fontSize: maxSize }}><RollingDigits value={value} resetKey={resetKey} /></span></span>;
}

function LivePowerValue({ value, unitKey, className }) {
    return <output data-testid="drawer-power" data-value={value} aria-live="polite" className={`drawer-live-power ${className}`}><PowerNumber value={value} resetKey={unitKey} maxSize={32} /></output>;
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

const OFFICIAL_SYMBOLS = { critical: '/symbols/critical.jpg', boost: '/symbols/boost.jpg', intercept: '/symbols/intercept.jpg', doubleDrive: '/symbols/double-drive.jpg', tripleDrive: '/symbols/triple-drive.jpg' };
function OfficialSymbol({ kind }) { return <img className="official-symbol" src={OFFICIAL_SYMBOLS[kind]} alt="" aria-hidden="true" />; }

const INTERFACE_COPY = {"zh":{"turn_controls":"回合操作","defense":"防御计算","settings":"设置","close":"关闭","roll_dice":"掷骰子","flip_coin":"抛硬币","heads":"正面","tails":"反面","rolling":"投掷中","counter":"自由计数器","counter_name":"计数器名称","decrease":"减少","increase":"增加","remove_counter":"删除计数器","grade_presets":"先导者力量预设","unit_status":"状态标记","front_attack":"前排攻击","back_attack":"后排攻击","critical_down":"减少暴击","critical_up":"增加暴击"},"en":{"turn_controls":"Turn controls","defense":"Guard calculator","settings":"Settings","close":"Close","roll_dice":"Roll die","flip_coin":"Flip coin","heads":"Heads","tails":"Tails","rolling":"Rolling","counter":"Custom counter","counter_name":"Counter name","decrease":"Decrease","increase":"Increase","remove_counter":"Remove counter","grade_presets":"Vanguard power presets","unit_status":"Abilities","front_attack":"Front attack","back_attack":"Back attack","critical_down":"Decrease critical","critical_up":"Increase critical"},"ja":{"turn_controls":"ターン操作","defense":"ガード計算","settings":"設定","close":"閉じる","roll_dice":"サイコロを振る","flip_coin":"コイントス","heads":"表","tails":"裏","rolling":"抽選中","counter":"フリーカウンター","counter_name":"カウンター名","decrease":"減らす","increase":"増やす","remove_counter":"カウンターを削除","grade_presets":"ヴァンガードのパワー設定","unit_status":"能力","front_attack":"前列アタック","back_attack":"後列アタック","critical_down":"クリティカルを減らす","critical_up":"クリティカルを増やす"}};
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
    const [loading, setLoading] = useState(true);
    const [gameState, setGameState] = useState(INITIAL_GAME_STATE);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [showTopControls, setShowTopControls] = useState(false);
    const [showGuard, setShowGuard] = useState(false);
    const [swapMode, setSwapMode] = useState(false);
    const [swapSource, setSwapSource] = useState(null);
    const [showTools, setShowTools] = useState(false);
    const [manualInput, setManualInput] = useState("");
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

    const t = { ...(TRANSLATIONS[language] || TRANSLATIONS.zh), ...(INTERFACE_COPY[language] || INTERFACE_COPY.zh) };

    const getUnitPower = (unit) => (unit?.basePower || 0) + (unit?.powerBuff || 0);

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
                const savedPresets = loadedState?.gradePresets;
                const usesLegacyDefaults = JSON.stringify(savedPresets) === JSON.stringify(LEGACY_GRADE_PRESETS);
                GRADE_PRESETS = Array.isArray(savedPresets) && savedPresets.length && !usesLegacyDefaults ? savedPresets.slice(0, 32).map(v => Math.max(0, finite(v))) : [...DEFAULT_GRADE_PRESETS];
                stateRef.current = restored;
                setGameState(restored);
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
        if (!selectedSlot && !showTools && !showTopControls && !showGuard) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const close = (event) => {
            if (event.key === 'Escape') { setSelectedSlot(null); setShowTools(false); setShowTopControls(false); setShowGuard(false); setShowAttackAdjust(false); }
            if (event.key === 'Tab') {
                const dialog = document.querySelector(selectedSlot ? '.unit-drawer' : showTools ? '.tools-panel' : showTopControls ? '.turn-panel' : '.guard-panel');
                const controls = [...(dialog?.querySelectorAll('button:not([disabled]), input, select') || [])];
                const first = controls[0], last = controls[controls.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }
        };
        const previousFocus = document.activeElement;
        document.querySelector(selectedSlot ? '.unit-drawer button[data-testid="unit-close" aria-label={t.close}]' : showTools ? '.tools-panel button' : showTopControls ? '.turn-panel button' : '.guard-panel button')?.focus();
        document.addEventListener('keydown', close);
        return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', close); previousFocus?.focus(); };
    }, [selectedSlot, showTools, showTopControls, showGuard]);

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
            attackHistory: newHistory
        });
        setSelectedSlot(null);
    };

    const attackColumn = (frontSlot, backSlot, explicitAttackerSlot) => {
        const current = stateRef.current;
        const attackerSlot = explicitAttackerSlot || frontSlot;
        if (attackerSlot !== frontSlot && attackerSlot !== backSlot) return;
        const attacker = current.units[attackerSlot];
        if (!attacker || attacker.isRested || getUnitPower(attacker) <= 0 || (attackerSlot === backSlot && !attacker.isBackRowAttack)) return;
        const historyEntry = { units: cloneUnits(current.units), attackCount: current.attackCount };
        const newUnits = cloneUnits(current.units);

        // Mark attacker as rested and cancel its support
        newUnits[attackerSlot] = { ...newUnits[attackerSlot], isRested: true, isSupporting: false };

        if (current.isMultiSupportMode) {
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

        updateState({ units: newUnits, attackCount: current.attackCount + 1, attackHistory: [...current.attackHistory, historyEntry].slice(-100) });
        setSelectedSlot(null);
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
        updateState({ units: newUnits, attackCount: 0, attackHistory: [], resources: { ...gameState.resources, shield: 0, sentinelActive: false } });
        setSelectedSlot(null);
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
        setSelectedSlot(null);
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
        updateState({ units: newUnits, attackCount: 0, attackHistory: [] });
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
            setShowTools(false); setShowTopControls(false); setShowGuard(false); setShowAttackAdjust(false);
            setSelectedSlot(selectedSlot === slot ? null : slot);
        }
    };

    const handleRetire = useCallback((slot) => {
        modifyUnit(slot, { ...INITIAL_UNIT, isVanguard: slot === 'front_center' });
        setSelectedSlot(null);
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
        }
    };


    const setUnitGrade = (slot, grade) => {
        const nextGrade = Math.max(0, Math.trunc(finite(grade)));
        modifyUnit(slot, { grade: nextGrade, ...(slot === 'front_center' && GRADE_PRESETS[nextGrade] !== undefined ? { basePower: GRADE_PRESETS[nextGrade] } : {}) });
    };
    const togglePanel = panel => {
        setSelectedSlot(null); setShowAttackAdjust(false);
        setShowTopControls(panel === 'turn' && !showTopControls);
        setShowGuard(panel === 'guard' && !showGuard);
        setShowTools(panel === 'tools' && !showTools);
    };
    const modifyCounter = (index, changes) => {
        const counters = stateRef.current.extraCounters.map((counter, i) => i === index ? { ...counter, ...changes } : counter);
        updateState({ extraCounters: counters });
    };
    const columns = ['left', 'center', 'right'];
    const hasBackRowAttack = columns.some(column => gameState.units[`back_${column}`].isBackRowAttack);

    // --- Renderers ---

    const renderUnitSlot = (id, label) => {
        const unit = gameState.units[id] || INITIAL_UNIT;
        const isSelected = selectedSlot === id;
        const isSwapSource = swapSource === id;
        const isVanguardSlot = id === 'front_center';

        // 3. 检查是否可支援：后列 或 (前列 且 多重支援开启)
        const isFrontRow = id.startsWith('front');
        // Vanguard (front_center) cannot be supported manually — remove its support button
        const isSupportable = !isVanguardSlot && (id.startsWith('back') || (isFrontRow && gameState.isMultiSupportMode));

        const totalPower = getUnitPower(unit);

        let borderClass = "border-slate-800";
        let bgClass = "bg-slate-900/80";

        if (isVanguardSlot) {
            borderClass = "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]";
            bgClass = "bg-red-950/20";
        }

        if (unit.isRested) {
            bgClass = "bg-slate-950/90 opacity-40";
            borderClass = "border-slate-900";
        } else if (unit.isSupporting && totalPower > 0) {
            bgClass = "bg-green-900/20 border-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.3)]";
        }

        if (swapMode) {
            if (isSwapSource) {
                borderClass = "border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)]";
                bgClass = "bg-blue-900/20";
            } else {
                borderClass = "border-dashed border-slate-600 hover:border-blue-400 cursor-crosshair";
            }
        } else if (isSelected) {
            bgClass = "bg-slate-800";
            borderClass = "border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.3)]";
        }

        let powerTextClass = "text-3xl";
        if (totalPower.toString().length > 6) powerTextClass = "text-xl";
        if (totalPower.toString().length > 8) powerTextClass = "text-lg";

        // NEW: Apply rainbow class for OT
        const isOTPower = !!unit.otActive;

        let powerTextColor = isOTPower
            ? "rainbow-text" // Use the rainbow class for OT
            : (isVanguardSlot
                ? "text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.6)]"
                : (totalPower > 0 ? "text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]" : (totalPower < 0 ? "text-red-500" : "text-slate-400"))
            );

        return (
            <div
                key={id}
                data-testid={`unit-${id}`}
                onClick={() => handleSlotClick(id)}
                className={`
                    unit-slot relative flex flex-col items-center justify-center p-1 pt-4 rounded-lg border-2
                    transition-all duration-200 h-[140px] sm:h-[150px] select-none backdrop-blur-sm overflow-hidden
                    ${isOTPower ? 'rainbow-glow' : ''} ${borderClass} ${bgClass}
                `}
            >
                <span aria-hidden="true" className={`unit-circle ${isVanguardSlot ? 'circle-vanguard' : 'circle-rearguard'}`} />
                {unit.isRested && <Anchor size={16} className="absolute top-1 right-1 text-slate-500" />}
                {unit.isSupporting && totalPower > 0 && <span className="absolute top-1 right-1"><OfficialSymbol kind="boost" /></span>}

                {isSupportable && (
                    <button
                        onClick={(e) => { e.stopPropagation(); toggleSupport(id); }}
                        disabled={unit.isRested || totalPower === 0}
                        className={`absolute top-1 left-1 px-2 py-0.5 rounded text-[10px] font-bold transition-colors z-10
                    ${unit.isRested || totalPower === 0
                                ? 'bg-slate-900 text-slate-700 cursor-not-allowed'
                                : unit.isBackRowAttack
                                    ? 'bg-red-700/70 text-white hover:bg-red-600/90'
                                    : unit.isSupporting
                                        ? 'bg-green-700/70 text-white hover:bg-green-600/90'
                                        : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/70'
                            }
                `}
                    >
                        <Layers size={10} className="inline mr-1" />
                        {unit.isRested || totalPower === 0
                            ? ''
                            : unit.isBackRowAttack
                                ? t.back_row_attack_mode
                                : (unit.isSupporting ? t.support_off : t.support_on)}
                    </button>
                )}

                <span className={`absolute top-1 left-2 text-[9px] uppercase font-bold tracking-widest opacity-70 ${isVanguardSlot ? 'text-red-400' : 'text-slate-500'}`}>
                    {label}
                </span>
                <button
                    onClick={(e) => { e.stopPropagation(); handleSlotClick(id); }}
                    aria-label={`${label} ${t.edit_grade}`}
                    className="absolute top-1 right-2 text-[9px] bg-slate-900/60 px-2 py-1 rounded text-xs font-mono border border-slate-800 hover:border-yellow-400"
                >{getGradeLabel(unit)}</button>

                <div className="z-10 flex flex-col items-center mt-3 w-full px-1">
                    <PowerNumber value={totalPower} maxSize={totalPower.toString().length > 8 ? 22 : totalPower.toString().length > 6 ? 28 : 34} className={`unit-power font-mono ${powerTextColor}`} />
                    {/* Improved Layout for Base/Buff Details: Stacked vertically */}
                    <div className="flex flex-col items-center w-full mt-1">
                        <div className="flex items-center gap-1 text-[9px] text-slate-500 leading-tight">
                            <span>{t.base_short}:</span>
                            <span className="font-mono">{formatNumber(unit.basePower)}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[9px] text-slate-400 leading-tight">
                            <span>{t.buff_short}:</span>
                            <span className="font-mono">{unit.powerBuff >= 0 ? '+' : ''}{formatNumber(unit.powerBuff)}</span>
                        </div>
                    </div>
                </div>

                {(unit.crit !== 1) && (
                    <div className="absolute bottom-10 right-2 flex items-center gap-1 bg-slate-950 border border-yellow-600/50 px-2 py-0.5 rounded text-xs shadow-lg">
                        <span className="text-yellow-500">★</span>
                        <span className="font-bold text-white">{unit.crit}</span>
                    </div>
                )}

                {/* 状态标记：支援、截击、双判、三判 */}
                <div className="absolute bottom-10 left-2 flex items-center gap-1 text-[9px] leading-none">
                    {unit.isSupporting && <span className="bg-green-700/70 text-white px-1 py-0.5 rounded">{t.boost}</span>}
                    {unit.hasIntercept && <span className="bg-blue-700/70 text-white px-1 py-0.5 rounded">{t.intercept}</span>}
                    {unit.hasDoubleStrike && <span className="bg-purple-700/70 text-white px-1 py-0.5 rounded">{t.double_strike}</span>}
                    {unit.hasTripleStrike && <span className="bg-red-700/70 text-white px-1 py-0.5 rounded">{t.triple_strike}</span>}
                </div>

                <div className="absolute bottom-0 inset-x-0 grid grid-cols-3 divide-x divide-slate-800 rounded-b-lg overflow-hidden bg-slate-950/70 h-8">
                    <button onClick={(e) => { e.stopPropagation(); restUnit(id); }} disabled={unit.isRested} className={`text-[9px] font-bold flex items-center justify-center ${unit.isRested ? 'text-slate-700' : 'text-slate-400 hover:bg-slate-800'}`}><Anchor size={10} /></button>
                    <button onClick={(e) => { e.stopPropagation(); standUnit(id); }} disabled={!unit.isRested} className={`text-[9px] font-bold flex items-center justify-center ${!unit.isRested ? 'text-slate-700' : 'text-slate-400 hover:bg-slate-800'}`}><CornerUpLeft size={10} /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleRetire(id); }} className="text-[9px] font-bold flex items-center justify-center text-red-500 hover:bg-red-900/30"><Trash2 size={10} /></button>
                </div>
            </div>
        );
    };

    const getAttackDetails = (frontId, backId, attackerId) => {
        const attacker = gameState.units[attackerId];
        const otherId = attackerId === frontId ? backId : frontId;
        const supports = gameState.isMultiSupportMode
            ? Object.entries(gameState.units).filter(([id, unit]) => id !== attackerId && unit.isSupporting && !unit.isRested)
            : gameState.units[otherId].isSupporting && !gameState.units[otherId].isRested ? [[otherId, gameState.units[otherId]]] : [];
        const supportPower = supports.reduce((sum, [, unit]) => sum + getUnitPower(unit), 0);
        return { power: getUnitPower(attacker) + supportPower, supported: supportPower > 0 };
    };
    const TotalPowerDisplay = ({ frontId, backId, attackerId = frontId }) => {
        const { power, supported } = getAttackDetails(frontId, backId, attackerId);
        return <div className="column-total h-10 bg-slate-900/50 border border-slate-700 rounded-lg p-1.5 flex flex-col items-center justify-center" data-testid={`total-${attackerId}`} data-value={power}>
            <div className="text-[9px] text-slate-500 uppercase tracking-widest">{supported ? t.column_total_supporting : t.column_total_solo}</div>
            <PowerNumber value={power} maxSize={power.toString().length > 8 ? 18 : 22} className={`font-mono ${supported ? 'text-green-400' : 'text-cyan-400'}`} />
        </div>;
    };
    const ColumnAttackButton = ({ frontId, backId, attackerId = frontId, compact = false }) => {
        const attacker = gameState.units[attackerId];
        const isBack = attackerId === backId;
        const { power, supported } = getAttackDetails(frontId, backId, attackerId);
        const disabled = attacker.isRested || getUnitPower(attacker) <= 0 || (isBack && !attacker.isBackRowAttack);
        const label = hasBackRowAttack ? isBack ? t.back_attack : t.front_attack : supported ? t.attack_support : frontId === 'front_center' ? t.attack_vanguard : t.attack_solo;
        return <button type="button" data-testid={`attack-${attackerId}`} onClick={() => attackColumn(frontId, backId, attackerId)} disabled={disabled}
            className={`column-attack w-full rounded-lg font-bold text-xs transition-colors border ${compact ? 'attack-between' : 'py-2 mt-1'} ${disabled ? 'bg-slate-900 text-slate-600 border-slate-900 opacity-50' : 'bg-red-800/50 text-red-300 border-red-700 hover:bg-red-700/70 active:scale-[0.98]'}`}>
            {compact && <PowerNumber value={power} maxSize={20} className="font-mono attack-inline-power" />}
            <span><Sword size={12} className="inline mr-1" />{label}</span>
        </button>;
    };

    if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-cyan-500 font-mono tracking-widest">{t.system_booting}</div>;

    return (
        <div className="vg-app min-h-screen bg-black text-slate-200 font-sans pb-20 overflow-x-hidden" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #1e293b 0%, #020617 100%)' }}>
            <header className="bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-4 py-2 flex justify-between items-center shadow-xl sticky top-0 z-40">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-5 bg-cyan-500 rounded-sm shadow-[0_0_8px_#06b6d4]"></div>
                    <h1 className="font-bold text-base tracking-widest text-white font-mono">{t.app_name}<span className="text-cyan-500 text-xs ml-1">OS</span></h1>
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
                    <div className="relative"><button aria-label={t.settings} data-testid="settings-toggle" onClick={() => togglePanel('tools')} className={`p-2 rounded transition-colors ${showTools ? 'text-cyan-400 bg-cyan-950' : 'text-slate-400'}`}><Settings2 size={18} /></button></div>
                </div>
            </header>
            <button type="button" className="edge-handle edge-left" data-testid="turn-toggle" aria-label={t.turn_controls} aria-expanded={showTopControls} aria-controls="top-controls" onClick={() => togglePanel('turn')}><RefreshCcw size={14} /><span>{language === 'zh' ? '回合' : language === 'ja' ? 'ターン' : 'Turn'}</span></button>
            <button type="button" className="edge-handle edge-right" data-testid="guard-toggle" aria-label={t.defense} aria-expanded={showGuard} aria-controls="guard-controls" onClick={() => togglePanel('guard')}><Shield size={14} /><span>{language === 'zh' ? '防御' : language === 'ja' ? 'ガード' : 'Guard'}</span></button>
            {showTopControls && <div className="side-menu-backdrop" onClick={() => setShowTopControls(false)}><aside role="dialog" aria-modal="true" aria-label={t.turn_controls} className="side-panel turn-panel" onClick={e => e.stopPropagation()}><div className="side-panel-heading"><span>{t.turn_controls}</span><button type="button" aria-label={t.close} onClick={() => setShowTopControls(false)}><X size={18} /></button></div>
                    <div id="top-controls" className="top-controls flex flex-col gap-2 mb-2">
                        {/* Row 1: Attack Actions */}
                        <div className="grid grid-cols-2 gap-2">
                            {/* 回合状态重置 (Round Reset) */}
                            <button onClick={roundStateReset} className="py-1.5 bg-red-800/50 text-red-300 border border-red-700 rounded-lg font-bold text-xs hover:bg-red-700/70 transition-colors flex items-center justify-center gap-1"><RefreshCcw size={12} /> {t.round_reset}</button>
                            {/* 回合开始 (Turn Start - Ride + 3 EN) */}
                            <button onClick={rideNextGrade} className="py-1.5 bg-blue-900/50 text-blue-300 border border-blue-700 rounded-lg font-bold text-xs">{t.ride_next}</button>
                            <button onClick={handleTurnStart} className="py-1.5 bg-green-800/50 text-green-300 border border-green-700 rounded-lg font-bold text-xs hover:bg-green-700/70 transition-colors flex items-center justify-center gap-1"><ChevronsUp size={12} /> {t.turn_start}</button>
                            <button onClick={handleAttackUndo} disabled={gameState.attackHistory.length === 0} className={`py-1.5 rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-1 border ${gameState.attackHistory.length === 0 ? 'bg-slate-900 text-slate-700 border-slate-800 cursor-not-allowed opacity-50' : 'bg-yellow-800/50 text-yellow-300 border-yellow-700 hover:bg-yellow-700/70'}`}><CornerUpLeft size={12} /> {t.undo_attack}</button>
                        </div>
                        {/* NEW Row 2: Support Mode & Front Buff */}
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => updateState({ isMultiSupportMode: !gameState.isMultiSupportMode })}
                                className={`py-1.5 rounded-lg font-bold text-xs transition-all border flex items-center justify-center gap-1 ${gameState.isMultiSupportMode
                                        ? 'bg-orange-600/50 text-white border-orange-400 shadow-[0_0_10px_rgba(234,88,12,0.5)]'
                                        : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-500'
                                    }`}
                            >
                                <Users size={14} /> {gameState.isMultiSupportMode ? t.multi_support : t.std_support}
                            </button>
                            <button onClick={() => applyFrontRowBuff(10000)} className="py-1.5 bg-purple-700/50 text-purple-300 border border-purple-600 rounded-lg font-bold text-xs hover:bg-purple-600/70 transition-colors flex items-center justify-center gap-1"><ChevronsUp size={14} /> {t.front_buff}</button>
                        </div>
                        {/* Row 3: Formation */}
                        <div className="grid grid-cols-1">
                            <button onClick={() => { setSwapMode(!swapMode); setSwapSource(null); setSelectedSlot(null); setShowTopControls(false); }} className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${swapMode ? 'bg-blue-600 text-white border-blue-400 shadow-[0_0_10px_rgba(37,99,235,0.5)]' : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-500'}`}><Move size={12} /> {swapMode ? t.move_on : t.move_mode}</button>
                        </div>
                    </div>


            </aside></div>}
            {showGuard && <div className="side-menu-backdrop" onClick={() => setShowGuard(false)}><aside id="guard-controls" role="dialog" aria-modal="true" aria-label={t.defense} className="side-panel guard-panel" onClick={e => e.stopPropagation()}><div className="side-panel-heading"><span>{t.defense}</span><button type="button" aria-label={t.close} onClick={() => setShowGuard(false)}><X size={18} /></button></div>
                    <div className="bg-slate-900/60 border border-blue-900/30 rounded-lg p-2 flex flex-col">
                        <div className="flex justify-between items-center mb-1"><div className="text-[10px] text-blue-400 uppercase font-bold flex items-center gap-1"><Shield size={10} /> {t.g_shield}</div><div className="text-2xl font-mono font-black text-white">{formatNumber(currentGuard)}</div></div>
                        {/* Opponent ATK Input (Existing) */}
                        <div className="mb-2"><input type="number" value={opponentAttackPower === null ? '' : opponentAttackPower} onChange={(e) => { const val = e.target.value; if (val === '') { setOpponentAttackPower(null); } else { const parsedVal = parseInt(val); setOpponentAttackPower(!isNaN(parsedVal) && parsedVal >= 0 ? parsedVal : 0); } }} placeholder={t.opponent_atk} className="w-full bg-blue-950/30 text-white text-sm px-2 py-1 rounded outline-none font-mono border border-blue-800 focus:border-cyan-400" /></div>

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
                        <label className="flex justify-between items-center gap-2 mt-2 text-xs text-slate-400">{t.pg_remaining}<input data-testid="pg-remaining" type="number" min="0" value={gameState.resources.sentinelsRemaining} onChange={e => updateState({resources:{...stateRef.current.resources,sentinelsRemaining:Math.max(0,Math.trunc(finite(e.target.value)))}})} className="w-16 bg-slate-800 text-slate-200 rounded border border-slate-700 text-center" /></label>
                    </div>

            </aside></div>}
            {storageWarning && <p role="status" className="p-3 text-amber-300">本地保存失败，当前操作仍可继续；请保持页面打开。</p>}
            {showTools && (
                <div className="drawer-backdrop" onClick={() => setShowTools(false)}><div role="dialog" aria-modal="true" aria-label={t.settings} onClick={e => e.stopPropagation()} className="tools-panel mx-4 mt-2 bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-2xl mb-4">
                    <div className="tools-heading flex justify-between items-center"><span className="text-sm text-slate-300">{t.settings}</span><button aria-label={t.close} onClick={() => setShowTools(false)} className="p-2"><X size={20} /></button></div>
                    <div className="border-b border-slate-800 pb-2 mb-3">
                        <div className="flex justify-between text-[10px] text-cyan-500 mb-2 uppercase tracking-wider items-center"><Globe size={12} className="mr-1" />{t.language}</div>
                        <div className="grid grid-cols-3 gap-2">{LANGUAGES.map(lang => (<button key={lang.code} onClick={() => handleLanguageChange(lang.code)} className={`py-1.5 rounded text-xs font-bold transition-colors border ${language === lang.code ? 'bg-cyan-700/50 text-white border-cyan-500' : 'bg-slate-800/50 text-slate-300 border-slate-700 hover:bg-slate-700/50'}`}>{lang.name}</button>))}</div>
                    </div>
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
                    <details className="grade-settings border-t border-slate-800 pt-2 mt-3">
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
                    </details>
                </div></div>
            )}
            <main className="battle-main p-3 max-w-md mx-auto space-y-4">
                <section>
                    <div className="battle-board grid grid-cols-3 gap-2">
                        {columns.map(column => renderUnitSlot(`front_${column}`, column === 'center' ? t.vanguard : column === 'left' ? t.front_l : t.front_r))}
                        {hasBackRowAttack && columns.map(column => <ColumnAttackButton key={`front-attack-${column}`} frontId={`front_${column}`} backId={`back_${column}`} attackerId={`front_${column}`} compact />)}
                        {columns.map(column => renderUnitSlot(`back_${column}`, column === 'left' ? t.back_l : column === 'center' ? t.back_c : t.back_r))}
                        {columns.map(column => { const attackerId = `${hasBackRowAttack ? 'back' : 'front'}_${column}`; return <div key={`attack-${column}`} className="min-w-0"><TotalPowerDisplay frontId={`front_${column}`} backId={`back_${column}`} attackerId={attackerId} /><ColumnAttackButton frontId={`front_${column}`} backId={`back_${column}`} attackerId={attackerId} /></div>; })}
                    </div>
                </section>
                <section className="bg-slate-900/50 border border-slate-700 rounded-xl p-3">
                    <div className="flex justify-between items-end mb-2 border-b border-slate-800 pb-2"><h2 className="text-[10px] font-bold text-cyan-500 uppercase tracking-[0.2em] flex items-center gap-1"><Zap size={12} /> {t.energy}</h2><div className="text-2xl font-black text-white font-mono leading-none text-shadow-neon">{gameState.energy} / {MAX_ENERGY}</div></div>
                    <div className="flex justify-between gap-0.5 h-8 items-center px-1 mb-3 relative">
                        <div className="absolute left-1 right-1 h-0.5 bg-slate-800 top-1/2 -translate-y-1/2 z-0"></div>
                        {Array.from({ length: 11 }).map((_, i) => (<button key={i} onClick={() => setEnergy(i)} className={`relative z-10 rounded-full flex items-center justify-center transition-all ${i <= gameState.energy ? 'w-4 h-4 bg-cyan-500 shadow-[0_0_8px_#06b6d4]' : 'w-2 h-2 bg-slate-800 hover:bg-slate-700'}`}>{i <= gameState.energy && <div className="w-1 h-1 bg-white rounded-full"></div>}</button>))}
                    </div>
                    <div className="grid grid-cols-6 gap-1.5">{ENERGY_ACTIONS.map(action => (<button key={action.label_zh} onClick={() => setEnergy(gameState.energy + action.value)} className={`${action.color} border border-cyan-800/50 rounded py-1 text-[10px] font-bold`}>{action[`label_${language}`]}</button>))}</div>
                </section>

            </main>
            {selectedSlot && !swapMode && (
                <div className="drawer-backdrop" onClick={() => setSelectedSlot(null)}>
                    <div role="dialog" aria-modal="true" aria-label={t.unit_adj} onClick={e => e.stopPropagation()} className="unit-drawer fixed bottom-0 inset-x-0 bg-[#0b1120] border-t border-slate-700 rounded-t-2xl shadow-[0_-5px_50px_rgba(0,0,0,0.9)] z-50">
                        <div className="drawer-content p-3 max-w-md mx-auto space-y-3">
                            <div className="drawer-heading border-b border-slate-800">
                                <div className="drawer-toolbar">
                                    <span className="drawer-unit-name text-white">{({ front_left: t.front_l, front_center: t.vanguard, front_right: t.front_r, back_left: t.back_l, back_center: t.back_c, back_right: t.back_r })[selectedSlot]}</span>
                                    <label className="drawer-grade" htmlFor="unit-grade"><span>G</span><select id="unit-grade" aria-label={t.edit_grade} value={gameState.units[selectedSlot].grade} onChange={e => setUnitGrade(selectedSlot, e.target.value)}>
                                        {[...new Set([0, 1, 2, 3, 4, ...GRADE_PRESETS.map((_, index) => index), gameState.units[selectedSlot].grade])].map(grade => <option key={grade} value={grade}>{grade}</option>)}
                                    </select></label>
                                    <button type="button" aria-label="Close unit" onClick={() => setSelectedSlot(null)} className="drawer-close bg-slate-800 rounded-full text-slate-400 hover:bg-slate-700"><X size={18} /></button>
                                </div>
                                <div className="drawer-summary">
                                    <div className="drawer-number-stack">
                                        <LivePowerValue unitKey={selectedSlot} value={getUnitPower(gameState.units[selectedSlot])} className={selectedSlot === 'front_center' ? 'text-blue-400' : getUnitPower(gameState.units[selectedSlot]) < 0 ? 'text-red-500' : 'text-yellow-400'} />
                                        <div className="drawer-power-parts"><span>{t.base_short} <b className="font-mono">{formatNumber(gameState.units[selectedSlot].basePower)}</b></span><span>{t.buff_short} <b className="font-mono">{gameState.units[selectedSlot].powerBuff >= 0 ? '+' : ''}{formatNumber(gameState.units[selectedSlot].powerBuff)}</b></span></div>
                                    </div>
                                    <div className="drawer-critical">
                                        <button type="button" aria-label={t.critical_down} disabled={gameState.units[selectedSlot].crit === 0} onClick={() => modifyUnit(selectedSlot, { crit: stateRef.current.units[selectedSlot].crit - 1 })} className="bg-slate-800 text-slate-400 rounded">−</button>
                                        <output aria-label={t.crit_full} aria-live="polite" data-testid="critical-value" data-value={gameState.units[selectedSlot].crit} className="text-yellow-500 font-mono"><OfficialSymbol kind="critical" /><RollingDigits value={gameState.units[selectedSlot].crit} resetKey={selectedSlot} /></output>
                                        <button type="button" aria-label={t.critical_up} onClick={() => modifyUnit(selectedSlot, { crit: stateRef.current.units[selectedSlot].crit + 1 })} className="bg-slate-800 text-slate-400 rounded">+</button>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1.5"><span className="text-[11px] text-slate-500">{t.power_buff_adj}</span><button type="button" onClick={() => modifyUnit(selectedSlot, { powerBuff: 0, otActive: false })} className="px-2 bg-red-900/30 border border-red-800 text-red-400 text-[11px] rounded"><RotateCcw size={10} className="inline mr-1" />{t.reset_buff}</button></div>
                                <div className="grid grid-cols-3 gap-2">
                                    {POS_NEG_BUFF_BUTTONS.map((button, index) => <button type="button" key={index} onClick={() => modifyUnit(selectedSlot, { powerBuff: stateRef.current.units[selectedSlot].powerBuff + button.value })} className={`${button.color} border py-2 rounded font-bold text-xs active:scale-95 transition-transform`}>{button[`label_${language}`]}</button>)}
                                </div>
                                <button type="button" data-testid="unit-ot" aria-pressed={gameState.units[selectedSlot].otActive} onClick={handleOTBuff} className={`ot-button-style w-full mt-2 py-2 rounded text-xs active:scale-[0.98] transition-all ${gameState.units[selectedSlot].otActive ? 'ot-active' : 'ot-inactive'}`}>{t.ot} ({formatNumber(OT_BUFF_VALUE)})</button>
                            </div>
                            <div className="manual-power-row">
                                <input aria-label={t.manual_buff} type="number" value={manualInput} onChange={e => setManualInput(e.target.value)} className="bg-black/50 text-white px-2 rounded font-mono border border-slate-700 focus:border-blue-500" placeholder={t.manual_buff} />
                                <button type="button" aria-label={`${t.increase} ${t.power_buff_adj}`} onClick={() => { const value = parseInt(manualInput); if (manualInput && !isNaN(value)) modifyUnit(selectedSlot, { powerBuff: stateRef.current.units[selectedSlot].powerBuff + value }); setManualInput(''); }} className="bg-cyan-900/30 text-cyan-400 border border-cyan-900/50 rounded">+</button>
                                <button type="button" aria-label={`${t.decrease} ${t.power_buff_adj}`} onClick={() => { const value = parseInt(manualInput); if (manualInput && !isNaN(value)) modifyUnit(selectedSlot, { powerBuff: stateRef.current.units[selectedSlot].powerBuff - value }); setManualInput(''); }} className="bg-red-900/30 text-red-400 border border-red-900/50 rounded">−</button>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1.5"><span className="text-[11px] text-slate-500">{t.base_power_setup}</span><button type="button" onClick={() => modifyUnit(selectedSlot, { basePower: 0 })} className="px-2 bg-red-900/30 border border-red-800 text-red-400 text-[11px] rounded"><RotateCcw size={10} className="inline mr-1" />{t.reset_base}</button></div>
                                <div className="base-presets grid grid-cols-5 gap-1.5">{BASE_PRESETS.map(preset => <button type="button" key={preset.val} onClick={() => modifyUnit(selectedSlot, { basePower: preset.val })} className="bg-slate-900 border border-slate-700 text-slate-300 text-xs font-mono rounded hover:border-blue-500/50">{preset.label}</button>)}</div>
                            </div>
                            <div className="custom-base-row"><input aria-label={t.custom_value} type="number" value={customBasePower} onChange={e => setCustomBasePower(e.target.value)} className="min-w-0 bg-black/50 text-white px-2 rounded font-mono border border-slate-700 focus:border-blue-500" placeholder={t.custom_value} /><button type="button" onClick={() => { const value = parseInt(customBasePower); if (!isNaN(value) && value >= 0) modifyUnit(selectedSlot, { basePower: value }); setCustomBasePower(''); }} className="bg-yellow-900/30 text-yellow-400 text-xs rounded px-3 border border-yellow-900/50">{t.set_base}</button></div>
                            <div className="border-t border-slate-700 pt-2">
                                <span className="block text-[11px] text-slate-500 mb-2">{t.unit_status}</span>
                                <div className="grid grid-cols-3 gap-2">
                                    <button type="button" onClick={() => modifyUnit(selectedSlot, { hasIntercept: !gameState.units[selectedSlot].hasIntercept })} className={`py-2 rounded text-xs border ${gameState.units[selectedSlot].hasIntercept ? 'bg-blue-700/50 text-white border-blue-500' : 'bg-slate-800 text-slate-400 border-slate-700'}`}><OfficialSymbol kind="intercept" />{t.intercept}</button>
                                    <button type="button" onClick={() => modifyUnit(selectedSlot, { hasDoubleStrike: !gameState.units[selectedSlot].hasDoubleStrike, hasTripleStrike: false })} className={`py-2 rounded text-xs border ${gameState.units[selectedSlot].hasDoubleStrike ? 'bg-purple-700/50 text-white border-purple-500' : 'bg-slate-800 text-slate-400 border-slate-700'}`}><OfficialSymbol kind="doubleDrive" />{t.double_strike}</button>
                                    <button type="button" onClick={() => modifyUnit(selectedSlot, { hasTripleStrike: !gameState.units[selectedSlot].hasTripleStrike, hasDoubleStrike: false })} className={`py-2 rounded text-xs border ${gameState.units[selectedSlot].hasTripleStrike ? 'bg-red-700/50 text-white border-red-500' : 'bg-slate-800 text-slate-400 border-slate-700'}`}><OfficialSymbol kind="tripleDrive" />{t.triple_strike}</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
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
