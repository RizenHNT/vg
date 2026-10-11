export const STORAGE_KEY = 'VG_COMBAT_STATE_V20_LOCAL';
export const SLOTS = ['front_left', 'front_center', 'front_right', 'back_left', 'back_center', 'back_right'];
export const OT_POWER = 100000000;
export const DEFAULT_PRESETS = [5000, 8000, 10000, 13000];
export const TRIGGERS = { crit: 'critTriggers', draw: 'drawTriggers', front: 'frontTriggers', heal: 'healTriggers', ot: 'otTriggers' };
const numeric = (v, fallback = 0) => (typeof v === 'number' || typeof v === 'string') && v !== '' && Number.isFinite(Number(v)) ? Number(v) : fallback;
const integer = (v, fallback = 0) => Math.max(0, Math.trunc(numeric(v, fallback)));
export const emptyUnit = () => ({ basePower: 0, powerBuff: 0, crit: 1, grade: 0, present: false, isRested: false, isSupporting: false, isBackRowAttack: false, hasIntercept: false, hasDoubleStrike: false, hasTripleStrike: false, otActive: false });
export function initialState() {
  return {
    version: 3,
    units: Object.fromEntries(SLOTS.map(slot => [slot, slot === 'front_center' ? { ...emptyUnit(), basePower: 5000, present: true, isVanguard: true } : emptyUnit()])),
    energy: 0, resources: { soul: 0, damage: 0, shield: 0, sentinelActive: false, sentinelsRemaining: 4, critTriggers: 4, drawTriggers: 4, frontTriggers: 3, healTriggers: 4, otTriggers: 1 },
    opponentDamage: null, opponentAttack: '', personaBonus: 0, attackCount: 0, extraCounters: [], isMultiSupportMode: false,
    gradePresets: [...DEFAULT_PRESETS], triggerPower: 10000, language: 'zh', history: [],
  };
}
export function normalizeState(raw) {
  const init = initialState();
  if (!raw || typeof raw !== 'object') return init;
  const units = Object.fromEntries(SLOTS.map(slot => {
    const source = raw.units?.[slot] || {};
    const unit = { ...init.units[slot] };
    for (const key of ['basePower', 'powerBuff']) unit[key] = numeric(source[key], unit[key]);
    for (const key of ['crit', 'grade']) unit[key] = integer(source[key], unit[key]);
    for (const key of ['isRested', 'isSupporting', 'isBackRowAttack', 'hasIntercept', 'hasDoubleStrike', 'hasTripleStrike', 'otActive']) unit[key] = source[key] === true;
    unit.present = typeof source.present === 'boolean' ? source.present : unit.basePower !== 0 || unit.powerBuff !== 0 || slot === 'front_center';
    unit.isVanguard = slot === 'front_center';
    return [slot, unit];
  }));
  const resources = { ...init.resources };
  for (const key of Object.keys(resources)) resources[key] = key === 'sentinelActive' ? raw.resources?.[key] === true : integer(raw.resources?.[key], resources[key]);
  return {
    ...init, units, resources, energy: Math.min(10, integer(raw.energy)), attackCount: integer(raw.attackCount),
    opponentDamage: raw.opponentDamage == null || raw.opponentDamage === '' ? null : integer(raw.opponentDamage),
    opponentAttack: raw.opponentAttack == null || raw.opponentAttack === '' ? '' : String(integer(raw.opponentAttack)),
    personaBonus: integer(raw.personaBonus), triggerPower: raw.triggerPower === 5000 ? 5000 : 10000,
    gradePresets: Array.isArray(raw.gradePresets) && raw.gradePresets.length ? raw.gradePresets.slice(0, 20).map(v => integer(v)) : [...DEFAULT_PRESETS],
    language: ['zh', 'ja', 'en'].includes(raw.language) ? raw.language : 'zh', isMultiSupportMode: raw.isMultiSupportMode === true,
    extraCounters: Array.isArray(raw.extraCounters) ? raw.extraCounters.filter(v => v && typeof v === 'object').map(v => ({ name: String(v.name || ''), value: Math.trunc(numeric(v.value)) })) : [],
    history: Array.isArray(raw.history) ? raw.history.filter(v => v?.state?.units).slice(-40) : [],
  };
}
export function unitPower(state, slot) {
  const unit = state.units[slot];
  return !unit?.present ? 0 : unit.basePower + unit.powerBuff + (slot.startsWith('front') ? state.personaBonus : 0);
}
export function patchUnit(state, slot, patch) {
  const unit = { ...state.units[slot], ...patch };
  if ('basePower' in patch && patch.basePower > 0) unit.present = true;
  return { ...state, units: { ...state.units, [slot]: unit } };
}
export function columnInfo(state, column) {
  const front = `front_${column}`, back = `back_${column}`;
  const useBack = state.units[back].present && state.units[back].isBackRowAttack && !state.units[back].isRested;
  const attacker = useBack ? back : front;
  const unit = state.units[attacker];
  const supporters = state.isMultiSupportMode ? SLOTS.filter(s => s !== attacker && state.units[s].present && state.units[s].isSupporting && !state.units[s].isRested) : !useBack && state.units[back].present && state.units[back].isSupporting && !state.units[back].isRested ? [back] : [];
  const power = unitPower(state, attacker) + supporters.reduce((total, slot) => total + unitPower(state, slot), 0);
  return { attacker, supporters, power, canAttack: unit.present && !unit.isRested };
}
export function attack(state, column) {
  const info = columnInfo(state, column);
  if (!info.canAttack) return state;
  const units = { ...state.units };
  for (const slot of [info.attacker, ...info.supporters]) units[slot] = { ...units[slot], isRested: true };
  return { ...state, units, attackCount: state.attackCount + 1 };
}
export function startTurn(state) {
  const units = Object.fromEntries(SLOTS.map(slot => [slot, { ...state.units[slot], isRested: false, powerBuff: 0, crit: 1, otActive: false }]));
  return { ...state, units, personaBonus: 0, attackCount: 0, opponentAttack: '', resources: { ...state.resources, shield: 0, sentinelActive: false } };
}
export function clearTurnBuffs(state) {
  return { ...state, units: Object.fromEntries(SLOTS.map(slot => [slot, { ...state.units[slot], powerBuff: 0, crit: 1, otActive: false }])), personaBonus: 0, attackCount: 0 };
}
export function togglePersona(state) { return { ...state, personaBonus: state.personaBonus ? 0 : 10000 }; }
export function applyTrigger(state, type, powerSlot, critSlot = powerSlot) {
  const counter = TRIGGERS[type];
  if (!counter || state.resources[counter] <= 0) return state;
  if (type !== 'front' && !state.units[powerSlot]?.present) return state;
  if (type === 'crit' && !state.units[critSlot]?.present) return state;
  let next = { ...state, resources: { ...state.resources, [counter]: state.resources[counter] - 1 } };
  const targets = type === 'front' ? SLOTS.filter(slot => slot.startsWith('front') && state.units[slot].present) : [powerSlot];
  for (const slot of targets) next = patchUnit(next, slot, { powerBuff: next.units[slot].powerBuff + (type === 'ot' ? OT_POWER : state.triggerPower), ...(type === 'ot' ? { otActive: true } : {}) });
  if (type === 'crit') next = patchUnit(next, critSlot, { crit: next.units[critSlot].crit + 1 });
  if (type === 'heal' && state.opponentDamage != null && state.resources.damage >= state.opponentDamage && state.resources.damage > 0) next.resources.damage -= 1;
  return next;
}
export function guardInfo(state) {
  if (state.resources.sentinelActive) return { blocked: true, required: 0, remaining: 0 };
  if (state.opponentAttack === '') return null;
  const gap = Number(state.opponentAttack) - unitPower(state, 'front_center') - state.resources.shield;
  const required = gap < 0 ? 0 : Math.floor(gap / 5000) + 1;
  return { blocked: gap < 0, required, remaining: required * 5000 };
}
export function record(state, next, label) {
  if (next === state) return state;
  const { history, ...snapshot } = state;
  return { ...next, history: [...history, { label, state: snapshot }].slice(-40) };
}
export function undo(state) {
  if (!state.history.length) return state;
  const entry = state.history[state.history.length - 1];
  return { ...normalizeState(entry.state), history: state.history.slice(0, -1) };
}
