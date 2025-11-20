import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Sword, Zap, RotateCcw, X, Settings2, Dices, CircleDollarSign,
    Trash2, Move, Shield, Ghost, AlertTriangle, Layers, Crown, CornerUpLeft, Anchor, Plus, Minus, Globe, Users, ChevronsUp,
    RefreshCcw, // 新增的图标，用于回合重置
} from 'lucide-react';

// --- Constants & Data ---
const MAX_ENERGY = 10;
const STORAGE_KEY = 'VG_COMBAT_STATE_V20_LOCAL'; // 本地存储使用的键


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
    { label_zh: '+3 (Ride)', label_en: '+3 (Ride)', label_ja: '+3 (Ride)', value: 3, color: 'bg-cyan-900/40 text-cyan-400' },
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
    frontTriggers: 4,
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
};

const formatNumber = (num) => {
    if (num === 0) return '0';
    // 检查是否是 OT 力量值，如果是则显示完整的 100,000,000
    if (num === OT_BUFF_VALUE) return (100000000).toLocaleString();
    return num.toLocaleString();
};

const LANGUAGES = [
    { code: 'zh', name: '中文' },
    { code: 'ja', name: '日本語' },
    { code: 'en', name: 'English' },
];

const TRANSLATIONS = {
    zh: {
        app_name: '先导者 OS',
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
    const [selectedSlot, setSelectedSlot] = useState(null);
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
    const [unitModes, setUnitModes] = useState({});

    // 新增：存储单位的 G 级别（可手动调整）
    const [unitGrades, setUnitGrades] = useState({});

    // 新增：G 标签编辑模式
    const [editingGradeSlot, setEditingGradeSlot] = useState(null);
    const [editingGradeValue, setEditingGradeValue] = useState("");

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

    const t = TRANSLATIONS[language];

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
        const gradeNum = detectGradeFromPower(unit.basePower);
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

                // 确保所有必要的资源键都存在，以处理从旧版本状态的迁移
                const loadedResources = { ...INITIAL_RESOURCES, ...loadedState.resources };
                // 移除旧的 triggersRemaining 键
                delete loadedResources.triggersRemaining;

                setGameState({
                    ...INITIAL_GAME_STATE,
                    ...loadedState,
                    resources: loadedResources
                });
                setLanguage(loadedState.language || 'zh'); // Load language preference
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
    const updateState = async (newData, updateLanguage = false) => {
        const nextState = { ...gameState, ...newData };

        if (updateLanguage && newData.language) {
            nextState.language = newData.language;
            setLanguage(newData.language);
        }

        setGameState(nextState);

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...nextState, language: updateLanguage ? newData.language : language }));
        } catch (e) {
            console.error("Could not save state to localStorage", e);
        }
    };

    // --- Logic ---
    const vanguardUnit = gameState.units.front_center || INITIAL_UNIT;
    const vanguardPower = getUnitPower(vanguardUnit);
    const currentGuard = gameState.resources.shield;

    const { required5kIncrements, currentAttackTarget, isDifferenceMode } = useMemo(() => {
        let targetATK = 0;
        let effectiveTarget = 0;
        const isManualInput = (opponentAttackPower != null && opponentAttackPower > 0);

        if (isManualInput) {
            targetATK = opponentAttackPower;
            effectiveTarget = Math.max(0, targetATK - vanguardPower);
        } else {
            targetATK = vanguardPower;
            effectiveTarget = targetATK;
        }

        const guardNeeded = effectiveTarget - currentGuard;
        let required5kIncrements = 0;
        if (guardNeeded > 0) {
            required5kIncrements = Math.ceil(guardNeeded / 5000);
        }

        return {
            required5kIncrements,
            currentAttackTarget: targetATK,
            isDifferenceMode: isManualInput
        };
    }, [vanguardPower, currentGuard, opponentAttackPower]);

    const modifyUnit = useCallback((slot, changes) => {
        const unit = gameState.units[slot];
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
                if (!newUnit.isSupporting) newUnit.isSupporting = true;
            }
        }

        if (newUnit.crit < 0) newUnit.crit = 0;

        const newUnits = { ...gameState.units, [slot]: newUnit };
        updateState({ units: newUnits });
    }, [gameState.units, updateState]);
    // 2. 横置/竖置单位按钮  
    const restUnit = useCallback((slot) => {
        // 如果多重支援模式：将该列或所有支援中的单位一并横置
        if (gameState.isMultiSupportMode) {
            const newUnits = { ...gameState.units };
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
            const newUnits = { ...gameState.units };
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

        const historyEntry = { units: { ...gameState.units }, attackCount: gameState.attackCount };
        const newUnits = { ...gameState.units };

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

        updateState({ units: newUnits, attackCount: gameState.attackCount + 1, attackHistory: [...gameState.attackHistory, historyEntry] });
        setSelectedSlot(null);
    };

    // 2. "回合开始" 按钮：自动识别 Vanguard 当前 GRADE，逐级 Ride 到下一等级（仅 G0-G3），+3EN
    const handleTurnStart = () => {
        const newUnits = { ...gameState.units };

        // 竖置所有单位
        Object.keys(newUnits).forEach(slot => {
            const unit = newUnits[slot];
            unit.isRested = false;
            const isBackRow = slot.startsWith('back');
            const totalPower = getUnitPower({ ...unit, powerBuff: 0 });
            if (isBackRow && totalPower > 0) {
                unit.isSupporting = true;
            }
        });

        // Vanguard Ride：根据当前 basePower 识别 GRADE，升到下一等级（孜限在 G0-G3 范围内）
        const v = newUnits.front_center;
        if (v) {
            const currentGradeIdx = detectGradeFromPower(v.basePower);
            const maxGradeIdx = GRADE_PRESETS.length - 1;
            if (currentGradeIdx < maxGradeIdx) {
                const nextGrade = currentGradeIdx + 1;
                const nextBasePower = GRADE_PRESETS[nextGrade];
                newUnits.front_center = { ...v, basePower: nextBasePower };
            }
        }

        // +3 EN
        const addedEnergy = Math.min(MAX_ENERGY, (gameState.energy || 0) + 3);
        updateState({ units: newUnits, attackHistory: [], energy: addedEnergy });
        setSelectedSlot(null);
    };

    // 保留：一键竖置（新名称为 standAllUnits，不做 Ride）
    const standAllUnits = () => {
        const newUnits = { ...gameState.units };
        Object.keys(newUnits).forEach(slot => {
            const unit = newUnits[slot];
            unit.isRested = false;
            const isBackRow = slot.startsWith('back');
            const totalPower = getUnitPower({ ...unit, powerBuff: 0 });
            if (isBackRow && totalPower > 0) {
                unit.isSupporting = true;
            }
        });
        updateState({ units: newUnits, attackHistory: [] });
        setSelectedSlot(null);
    };

    // 回合结束重置：只清除修正值和暴击等附加状态，不竖置单位
    const roundStateReset = () => {
        const newUnits = { ...gameState.units };
        Object.keys(newUnits).forEach(slot => {
            const unit = newUnits[slot];
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
                const newUnits = { ...gameState.units };
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
            setSelectedSlot(selectedSlot === slot ? null : slot);
        }
    };

    const handleRetire = useCallback((slot) => {
        modifyUnit(slot, { basePower: 0, powerBuff: 0, crit: 1, isRested: false, isSupporting: false });
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
                    shield: 0 // 取消时清零 G 值
                }
            });
            setOpponentAttackPower(null);
        } else if (gameState.resources.sentinelsRemaining > 0) {
            // PG 未激活且有剩余，点击则激活
            const newShield = 99999999;
            const newSentinels = gameState.resources.sentinelsRemaining - 1;
            updateState({
                resources: {
                    ...gameState.resources,
                    sentinelActive: true,
                    sentinelsRemaining: newSentinels,
                    shield: newShield
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
        const newUnits = { ...gameState.units };
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
        const unit = gameState.units[selectedSlot] || {};
        const current = unit.powerBuff || 0;
        // Toggle OT buff on the selected slot
        if (current === OT_BUFF_VALUE) {
            modifyUnit(selectedSlot, { powerBuff: 0 });
        } else {
            modifyUnit(selectedSlot, { powerBuff: OT_BUFF_VALUE });
        }
    };

    // 是否任意单位处于 OT 状态（用于 OT 按钮发光）
    const hasAnyOT = Object.values(gameState.units).some(u => (u && u.powerBuff === OT_BUFF_VALUE));

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
        const totalPowerDisplay = formatNumber(totalPower);

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
        const isOTPower = totalPower === OT_BUFF_VALUE;

        let powerTextColor = isOTPower
            ? "rainbow-text" // Use the rainbow class for OT
            : (isVanguardSlot
                ? "text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.6)]"
                : (totalPower > 0 ? "text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]" : (totalPower < 0 ? "text-red-500" : "text-slate-400"))
            );

        return (
            <div
                onClick={() => handleSlotClick(id)}
                className={`
                    relative flex flex-col items-center justify-center p-1 pt-4 rounded-lg border-2 
                    transition-all duration-200 h-[140px] sm:h-[150px] select-none backdrop-blur-sm overflow-hidden
                    ${isOTPower ? 'rainbow-glow' : ''} ${borderClass} ${bgClass}
                `}
            >
                {unit.isRested && <Anchor size={16} className="absolute top-1 right-1 text-slate-500" />}
                {unit.isSupporting && totalPower > 0 && <Layers size={16} className="absolute top-1 right-1 text-green-400" />}

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
                {editingGradeSlot === id ? (
                    <input
                        type="number"
                        value={editingGradeValue}
                        onChange={(e) => setEditingGradeValue(e.target.value)}
                        onBlur={() => {
                            const gradeNum = parseInt(editingGradeValue);
                            if (!isNaN(gradeNum) && gradeNum >= 0) {
                                setUnitGrades({ ...unitGrades, [id]: gradeNum });
                            }
                            setEditingGradeSlot(null);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                const gradeNum = parseInt(editingGradeValue);
                                if (!isNaN(gradeNum) && gradeNum >= 0) {
                                    setUnitGrades({ ...unitGrades, [id]: gradeNum });
                                }
                                setEditingGradeSlot(null);
                            }
                        }}
                        autoFocus
                        className="absolute top-1 right-2 w-12 h-6 bg-yellow-900/70 text-white text-xs px-1 rounded border border-yellow-600 font-mono"
                    />
                ) : (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setEditingGradeSlot(id);
                            setEditingGradeValue(String(unitGrades[id] ?? detectGradeFromPower(unit.basePower)));
                        }}
                        className="absolute top-1 right-2 text-[9px] bg-slate-900/60 px-2 py-0.5 rounded text-xs font-mono border border-slate-800 hover:border-yellow-400 hover:bg-slate-800/80 cursor-pointer transition-colors whitespace-nowrap"
                    >
                        {getGradeLabel(unit)}
                    </button>
                )}

                <div className="z-10 flex flex-col items-center mt-3 w-full px-1">
                    <span className={`${powerTextClass} font-black tracking-tighter font-mono ${powerTextColor} break-all text-center leading-none whitespace-nowrap`}>
                        {totalPowerDisplay}
                    </span>
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

    const TotalPowerDisplay = ({ frontId, backId }) => {
        const frontUnit = gameState.units[frontId] || INITIAL_UNIT;
        const backUnit = gameState.units[backId] || INITIAL_UNIT;
        const frontPower = getUnitPower(frontUnit);

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
            if (frontUnit.isSupporting && !frontUnit.isRested) {
                supportPower = Math.max(0, supportPower - frontPower);
            }

        } else {
            // Standard Mode: Only back unit
            if (backUnit.isSupporting && !backUnit.isRested) {
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
                <div className={`font-mono text-lg font-black leading-none ${powerClass}`}>{formatNumber(totalPower)}</div>
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
        <div className="min-h-screen bg-black text-slate-200 font-sans pb-20 overflow-x-hidden" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #1e293b 0%, #020617 100%)' }}>
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
                            <div className="absolute right-0 mt-1 w-24 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-2 z-50">
                                <div className="flex justify-between items-center text-sm font-mono text-white">
                                    <button onClick={() => updateState({ attackCount: gameState.attackCount - 1 })} className="p-1 bg-slate-800 rounded hover:bg-slate-700"><Minus size={14} /></button>
                                    <span className="text-yellow-400 font-bold">{gameState.attackCount}</span>
                                    <button onClick={() => updateState({ attackCount: gameState.attackCount + 1 })} className="p-1 bg-slate-800 rounded hover:bg-slate-700"><Plus size={14} /></button>
                                </div>
                                <button onClick={() => updateState({ attackCount: 0 })} className="w-full mt-1 text-[10px] text-red-400 bg-red-900/20 py-0.5 rounded">{t.reset}</button>
                            </div>
                        )}
                    </div>
                    <div className="relative"><button onClick={() => setShowTools(!showTools)} className={`p-2 rounded transition-colors ${showTools ? 'text-cyan-400 bg-cyan-950' : 'text-slate-400'}`}><Settings2 size={18} /></button></div>
                </div>
            </header>
            {showTools && (
                <div className="mx-4 mt-2 bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-2xl mb-4">
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
                                                const newUnits = { ...gameState.units };
                                                if (newUnits.front_center && newUnits.front_center.basePower === GRADE_PRESETS[idx]) {
                                                    newUnits.front_center = { ...newUnits.front_center, basePower: val };
                                                }
                                                updateState({ units: newUnits });
                                                GRADE_PRESETS.splice(0, GRADE_PRESETS.length, ...newPresets);
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
            <main className="p-3 max-w-md mx-auto space-y-4">
                <section>
                    {/* Top Controls Grid: 2 Rows */}
                    <div className="flex flex-col gap-2 mb-2">
                        {/* Row 1: Attack Actions */}
                        <div className="grid grid-cols-3 gap-2">
                            {/* 回合状态重置 (Round Reset) */}
                            <button onClick={roundStateReset} className="py-1.5 bg-red-800/50 text-red-300 border border-red-700 rounded-lg font-bold text-xs hover:bg-red-700/70 transition-colors flex items-center justify-center gap-1"><RefreshCcw size={12} /> {t.round_reset}</button>
                            {/* 回合开始 (Turn Start - Ride + 3 EN) */}
                            <button onClick={handleTurnStart} className="py-1.5 bg-green-800/50 text-green-300 border border-green-700 rounded-lg font-bold text-xs hover:bg-green-700/70 transition-colors flex items-center justify-center gap-1"><ChevronsUp size={12} /> 回合开始</button>
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
                            <button onClick={() => { setSwapMode(!swapMode); setSwapSource(null); setSelectedSlot(null); }} className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${swapMode ? 'bg-blue-600 text-white border-blue-400 shadow-[0_0_10px_rgba(37,99,235,0.5)]' : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-500'}`}><Move size={12} /> {swapMode ? t.move_on : t.move_mode}</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        <div className="flex flex-col gap-2">{renderUnitSlot('front_left', t.front_l)}{renderUnitSlot('back_left', t.back_l)}<TotalPowerDisplay frontId="front_left" backId="back_left" /><ColumnAttackButton frontId="front_left" backId="back_left" attackHandler={attackColumn} /></div>
                        <div className="flex flex-col gap-2">{renderUnitSlot('front_center', t.vanguard)}{renderUnitSlot('back_center', t.back_c)}<TotalPowerDisplay frontId="front_center" backId="back_center" /><ColumnAttackButton frontId="front_center" backId="back_center" attackHandler={attackColumn} /></div>
                        <div className="flex flex-col gap-2">{renderUnitSlot('front_right', t.front_r)}{renderUnitSlot('back_right', t.back_r)}<TotalPowerDisplay frontId="front_right" backId="back_right" /><ColumnAttackButton frontId="front_right" backId="back_right" attackHandler={attackColumn} /></div>
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
                <section className="grid grid-cols-2 gap-2">
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
                                    className="flex-grow bg-blue-950/30 text-white text-[10px] px-1 py-0.5 rounded outline-none font-mono border border-blue-800 focus:border-cyan-400 text-center"
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
                    <div className="grid grid-rows-3 gap-2">
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
                </section>
            </main>
            {selectedSlot && !swapMode && (
                <div className="fixed bottom-0 inset-x-0 bg-[#0b1120] border-t border-slate-700 rounded-t-2xl shadow-[0_-5px_50px_rgba(0,0,0,0.9)] z-50 animate-in slide-in-from-bottom duration-200">
                    <div className="p-4 max-w-md mx-auto space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-2"><div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{t.unit_adj}</span><span className="text-lg text-white font-bold capitalize">{selectedSlot.replace('front', t.front_l.split(' ')[0]).replace('back', t.back_l.split(' ')[0]).replace('_', ' ')}</span></div><button onClick={() => setSelectedSlot(null)} className="bg-slate-800 p-1.5 rounded-full text-slate-400 hover:bg-slate-700"><X size={18} /></button></div>
                        <div><div className="flex justify-between items-center mb-1.5"><div className="text-[10px] text-slate-500 uppercase font-bold">{t.base_power_setup}</div><button onClick={() => modifyUnit(selectedSlot, { basePower: 0 })} className="px-2 py-0.5 bg-red-900/30 border border-red-800 text-red-400 text-[10px] font-bold rounded hover:bg-red-800/50"><RotateCcw size={10} className="inline mr-1" />{t.reset_base}</button></div><div className="flex flex-wrap gap-1.5">{BASE_PRESETS.map(preset => (<button key={preset.val} onClick={() => modifyUnit(selectedSlot, { basePower: preset.val })} className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 text-slate-300 text-xs font-mono rounded hover:bg-blue-900/30 hover:border-blue-500/50 hover:text-white transition-colors">{preset.label}</button>))}</div></div>
                        <div className="flex items-center gap-2"><input type="number" value={customBasePower} onChange={(e) => setCustomBasePower(e.target.value)} className="w-full bg-black/50 text-white text-sm px-2 py-1 rounded outline-none font-mono border border-slate-700 focus:border-blue-500" placeholder={t.custom_value} /><button onClick={() => { const val = parseInt(customBasePower); if (!isNaN(val) && val >= 0) { modifyUnit(selectedSlot, { basePower: val }); } setCustomBasePower(""); }} className="flex-shrink-0 bg-yellow-900/30 text-yellow-400 text-xs font-bold rounded py-1 px-3 border border-yellow-900/50">{t.set_base}</button></div>

                        <div>
                            <div className="flex justify-between items-center mb-1.5">
                                <div className="text-[10px] text-slate-500 uppercase font-bold">{t.power_buff_adj}</div>
                                <button onClick={() => modifyUnit(selectedSlot, { powerBuff: 0 })} className="px-2 py-0.5 bg-red-900/30 border border-red-800 text-red-400 text-[10px] font-bold rounded hover:bg-red-800/50"><RotateCcw size={10} className="inline mr-1" />{t.reset_buff}</button>
                            </div>

                            {/* 增益/减益按钮网格 (3列 x 2行) */}
                            <div className="grid grid-cols-3 gap-2">
                                {/* Positive Buffs */}
                                {POS_NEG_BUFF_BUTTONS.slice(0, 3).map((btn, i) => (
                                    <button key={i} onClick={() => modifyUnit(selectedSlot, { powerBuff: gameState.units[selectedSlot].powerBuff + btn.value })} className={`${btn.color} border py-2.5 rounded font-bold text-xs shadow-sm active:scale-95 transition-transform`}>{btn[`label_${language}`]}</button>
                                ))}
                                {/* Negative Buffs */}
                                {POS_NEG_BUFF_BUTTONS.slice(3).map((btn, i) => (
                                    <button key={i + 3} onClick={() => modifyUnit(selectedSlot, { powerBuff: gameState.units[selectedSlot].powerBuff + btn.value })} className={`${btn.color} border py-2.5 rounded font-bold text-xs shadow-sm active:scale-95 transition-transform`}>{btn[`label_${language}`]}</button>
                                ))}
                            </div>

                            {/* 独立的 OT 按钮 - 炫酷彩色效果 */}
                            <button
                                onClick={handleOTBuff}
                                className={`ot-button-style w-full mt-3 py-3 rounded font-black text-sm uppercase tracking-widest active:scale-[0.98] transition-all ${hasAnyOT ? 'ot-active' : 'ot-inactive'}`}
                            >
                                {t.ot} ({formatNumber(OT_BUFF_VALUE)})
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-900 p-2 rounded border border-slate-800 flex flex-col justify-between">
                                <div className="text-[9px] text-slate-500 uppercase font-bold mb-1">{t.manual_buff}</div>
                                <div className="flex gap-1">
                                    <input type="number" value={manualInput} onChange={(e) => setManualInput(e.target.value)} className="w-full bg-black/50 text-white text-sm px-2 py-1 rounded outline-none font-mono border border-slate-700 focus:border-blue-500" placeholder="e.g. 10000" />
                                </div>
                                <div className="grid grid-cols-2 gap-1 mt-1">
                                    <button onClick={() => { const val = parseInt(manualInput); if (manualInput && !isNaN(val)) { modifyUnit(selectedSlot, { powerBuff: gameState.units[selectedSlot].powerBuff + val }); } setManualInput(""); }} className="bg-cyan-900/30 text-cyan-400 text-xs font-bold rounded py-1 border border-cyan-900/50">+</button>
                                    <button onClick={() => { const val = parseInt(manualInput); if (manualInput && !isNaN(val)) { modifyUnit(selectedSlot, { powerBuff: gameState.units[selectedSlot].powerBuff - val }); } setManualInput(""); }} className="bg-red-900/30 text-red-400 text-xs font-bold rounded py-1 border border-red-900/50">-</button>
                                </div>
                            </div>
                            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded p-1">
                                <button onClick={() => modifyUnit(selectedSlot, { crit: gameState.units[selectedSlot].crit - 1 })} className="w-8 h-8 bg-slate-800 text-slate-400 hover:text-red-400 rounded">-</button>
                                <div className="flex flex-col items-center leading-none">
                                    <span className="text-[8px] text-slate-500 uppercase">{t.crit_full}</span>
                                    <span className="text-yellow-500 font-bold text-lg">★{gameState.units[selectedSlot].crit}</span>
                                </div>
                                <button onClick={() => modifyUnit(selectedSlot, { crit: gameState.units[selectedSlot].crit + 1 })} className="w-8 h-8 bg-slate-800 text-slate-400 hover:text-yellow-400 rounded">+</button>
                            </div>
                        </div>

                        {/* 新增：状态标记切换按钮 */}
                        <div className="border-t border-slate-700 pt-3">
                            <div className="text-[10px] text-slate-500 uppercase font-bold mb-2">状态标记</div>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => modifyUnit(selectedSlot, { hasIntercept: !gameState.units[selectedSlot].hasIntercept })}
                                    className={`py-2 rounded font-bold text-xs border transition-all ${gameState.units[selectedSlot].hasIntercept ? 'bg-blue-700/50 text-white border-blue-500' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
                                >
                                    {t.intercept}
                                </button>
                                <button
                                    onClick={() => modifyUnit(selectedSlot, { hasDoubleStrike: !gameState.units[selectedSlot].hasDoubleStrike })}
                                    className={`py-2 rounded font-bold text-xs border transition-all ${gameState.units[selectedSlot].hasDoubleStrike ? 'bg-purple-700/50 text-white border-purple-500' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
                                >
                                    {t.double_strike}
                                </button>
                                <button
                                    onClick={() => modifyUnit(selectedSlot, { hasTripleStrike: !gameState.units[selectedSlot].hasTripleStrike })}
                                    className={`py-2 rounded font-bold text-xs border transition-all ${gameState.units[selectedSlot].hasTripleStrike ? 'bg-red-700/50 text-white border-red-500' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
                                >
                                    {t.triple_strike}
                                </button>
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
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
