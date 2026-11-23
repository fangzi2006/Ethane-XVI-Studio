export const KV_REPORT = 234;
export const KV_LOOP = 235;
export const KV_MOVE = 236;
export const KV_PRESS = 237;
export const KV_VOL_NEXT = 238;
export const KV_VOL_PREV = 239;
export const KV_WHEEL_UP = 240;
export const KV_WHEEL_DOWN = 241;
export const KV_VOL_UP = 242;
export const KV_VOL_DOWN = 243;
export const KV_VOL_MUTE = 244;
export const KV_VOL_STOP = 245;
export const KV_MOUSE_L = 246;
export const KV_MOUSE_M = 247;
export const KV_MOUSE_R = 248;
export const KV_CTRL = 249;
export const KV_SHIFT = 250;
export const KV_ALT = 251;
export const KV_WIN = 252;
export const KV_SHORTCUT = 253;
export const KV_DELAY = 254;

export interface SpecialKeyItem {
  code: number;
  label: string;
  short: string;
  group: 'mouse' | 'media' | 'modifier' | 'other';
}

export const SPECIAL_KEYS: SpecialKeyItem[] = [
  { code: KV_MOUSE_L, label: '鼠标左键', short: '左键', group: 'mouse' },
  { code: KV_MOUSE_M, label: '鼠标中键', short: '中键', group: 'mouse' },
  { code: KV_MOUSE_R, label: '鼠标右键', short: '右键', group: 'mouse' },
  { code: KV_WHEEL_UP, label: '滚轮向上', short: '滚轮↑', group: 'mouse' },
  { code: KV_WHEEL_DOWN, label: '滚轮向下', short: '滚轮↓', group: 'mouse' },
  { code: KV_VOL_STOP, label: '播放/暂停', short: '播放', group: 'media' },
  { code: KV_VOL_MUTE, label: '静音', short: '静音', group: 'media' },
  { code: KV_VOL_UP, label: '音量加', short: '音量+', group: 'media' },
  { code: KV_VOL_DOWN, label: '音量减', short: '音量-', group: 'media' },
  { code: KV_VOL_PREV, label: '上一曲', short: '上曲', group: 'media' },
  { code: KV_VOL_NEXT, label: '下一曲', short: '下曲', group: 'media' },
  { code: KV_CTRL, label: 'Ctrl', short: 'Ctrl', group: 'modifier' },
  { code: KV_SHIFT, label: 'Shift', short: 'Shift', group: 'modifier' },
  { code: KV_ALT, label: 'Alt', short: 'Alt', group: 'modifier' },
  { code: KV_WIN, label: 'Win', short: 'Win', group: 'modifier' },
  { code: 0, label: '空按键 (None)', short: '空', group: 'other' },
];

const USB_KEY_LABELS: Record<number, [string, string?]> = {
  0: ['无'],
  4: ['A'], 5: ['B'], 6: ['C'], 7: ['D'], 8: ['E'], 9: ['F'], 10: ['G'],
  11: ['H'], 12: ['I'], 13: ['J'], 14: ['K'], 15: ['L'], 16: ['M'], 17: ['N'],
  18: ['O'], 19: ['P'], 20: ['Q'], 21: ['R'], 22: ['S'], 23: ['T'], 24: ['U'],
  25: ['V'], 26: ['W'], 27: ['X'], 28: ['Y'], 29: ['Z'],
  30: ['1', '!'], 31: ['2', '@'], 32: ['3', '#'], 33: ['4', '$'], 34: ['5', '%'],
  35: ['6', '^'], 36: ['7', '&'], 37: ['8', '*'], 38: ['9', '('], 39: ['0', ')'],
  40: ['Enter'], 41: ['Esc'], 42: ['Backspace'], 43: ['Tab'], 44: ['Space'],
  45: ['-', '_'], 46: ['=', '+'], 47: ['[', '{'], 48: [']', '}'], 49: ['\\', '|'],
  50: ['\\*', '|*'], 51: [';', ':'], 52: ["'", '"'], 53: ['`', '~'],
  54: [',', '<'], 55: ['.', '>'], 56: ['/', '?'], 57: ['CapsLock'],
  58: ['F1'], 59: ['F2'], 60: ['F3'], 61: ['F4'], 62: ['F5'], 63: ['F6'],
  64: ['F7'], 65: ['F8'], 66: ['F9'], 67: ['F10'], 68: ['F11'], 69: ['F12'],
  70: ['PrtSc'], 71: ['ScrLk'], 72: ['Pause'], 73: ['Ins'], 74: ['Home'],
  75: ['PgUp'], 76: ['Del'], 77: ['End'], 78: ['PgDn'],
  79: ['→'], 80: ['←'], 81: ['↓'], 82: ['↑'], 83: ['NumLk'],
  84: ['NUM /'], 85: ['NUM *'], 86: ['NUM -'], 87: ['NUM +'], 88: ['NUM Enter'],
  89: ['NUM 1'], 90: ['NUM 2'], 91: ['NUM 3'], 92: ['NUM 4'], 93: ['NUM 5'],
  94: ['NUM 6'], 95: ['NUM 7'], 96: ['NUM 8'], 97: ['NUM 9'], 98: ['NUM 0'],
  99: ['NUM .'], 100: ['Non-US \\'], 101: ['Menu'], 102: ['Power'], 103: ['NUM ='],
  [KV_WHEEL_UP]: ['滚轮↑'],
  [KV_WHEEL_DOWN]: ['滚轮↓'],
  [KV_VOL_UP]: ['音量+'],
  [KV_VOL_DOWN]: ['音量-'],
  [KV_VOL_MUTE]: ['静音'],
  [KV_VOL_STOP]: ['播放/暂停'],
  [KV_VOL_NEXT]: ['下一曲'],
  [KV_VOL_PREV]: ['上一曲'],
  [KV_MOUSE_L]: ['鼠标左键'],
  [KV_MOUSE_M]: ['鼠标中键'],
  [KV_MOUSE_R]: ['鼠标右键'],
  [KV_CTRL]: ['Ctrl'],
  [KV_SHIFT]: ['Shift'],
  [KV_ALT]: ['Alt'],
  [KV_WIN]: ['Win'],
};

const DOM_CODE_TO_USB: Record<string, number> = {
  KeyA: 4, KeyB: 5, KeyC: 6, KeyD: 7, KeyE: 8, KeyF: 9, KeyG: 10,
  KeyH: 11, KeyI: 12, KeyJ: 13, KeyK: 14, KeyL: 15, KeyM: 16, KeyN: 17,
  KeyO: 18, KeyP: 19, KeyQ: 20, KeyR: 21, KeyS: 22, KeyT: 23, KeyU: 24,
  KeyV: 25, KeyW: 26, KeyX: 27, KeyY: 28, KeyZ: 29,
  Digit1: 30, Digit2: 31, Digit3: 32, Digit4: 33, Digit5: 34,
  Digit6: 35, Digit7: 36, Digit8: 37, Digit9: 38, Digit0: 39,
  Enter: 40, Escape: 41, Backspace: 42, Tab: 43, Space: 44,
  Minus: 45, Equal: 46, BracketLeft: 47, BracketRight: 48, Backslash: 49,
  Semicolon: 51, Quote: 52, Backquote: 53, Comma: 54, Period: 55, Slash: 56,
  CapsLock: 57,
  F1: 58, F2: 59, F3: 60, F4: 61, F5: 62, F6: 63,
  F7: 64, F8: 65, F9: 66, F10: 67, F11: 68, F12: 69,
  PrintScreen: 70, ScrollLock: 71, Pause: 72, Insert: 73, Home: 74,
  PageUp: 75, Delete: 76, End: 77, PageDown: 78,
  ArrowRight: 79, ArrowLeft: 80, ArrowDown: 81, ArrowUp: 82, NumLock: 83,
  NumpadDivide: 84, NumpadMultiply: 85, NumpadSubtract: 86, NumpadAdd: 87, NumpadEnter: 88,
  Numpad1: 89, Numpad2: 90, Numpad3: 91, Numpad4: 92, Numpad5: 93,
  Numpad6: 94, Numpad7: 95, Numpad8: 96, Numpad9: 97, Numpad0: 98,
  NumpadDecimal: 99, ContextMenu: 101, NumpadEqual: 103,
  ControlLeft: KV_CTRL, ControlRight: KV_CTRL,
  ShiftLeft: KV_SHIFT, ShiftRight: KV_SHIFT,
  AltLeft: KV_ALT, AltRight: KV_ALT,
  MetaLeft: KV_WIN, MetaRight: KV_WIN,
};

export function domCodeToUsbKey(code: string): number {
  return DOM_CODE_TO_USB[code] ?? 0;
}

export function isModifierUsbKey(usbKey: number): boolean {
  return usbKey >= KV_CTRL && usbKey <= KV_WIN;
}

export function usbKeyToLabel(usbKey: number, shift = false): string {
  const entry = USB_KEY_LABELS[usbKey];
  if (!entry) return `Key#${usbKey}`;
  return shift && entry[1] ? entry[1] : entry[0];
}

export function formatShortcut(usbKey: number, func: number): string {
  const parts: string[] = [];
  if (func & 0x01) parts.push('Ctrl');
  if (func & 0x02) parts.push('Shift');
  if (func & 0x04) parts.push('Alt');
  if (func & 0x08) parts.push('Win');
  if (usbKey !== 0 || parts.length === 0) {
    parts.push(usbKeyToLabel(usbKey));
  }
  return parts.join('+');
}

export function formatShortcutCompact(usbKey: number, func: number): string {
  let prefix = '';
  if (func & 0x01) prefix += 'C';
  if (func & 0x02) prefix += 'S';
  if (func & 0x04) prefix += 'A';
  if (func & 0x08) prefix += 'W';
  const keyStr = usbKey !== 0 ? usbKeyToLabel(usbKey) : '';
  if (prefix && keyStr) return `${prefix}+${keyStr}`;
  if (prefix) return prefix;
  return keyStr || '无';
}

/** 将数字 0..9 转为 USB 主键盘数字键 (1..9 => 30..38, 0 => 39) */
export function digitToUsbKey(digit: number): number {
  const d = Math.max(0, Math.min(9, Math.floor(digit)));
  return d === 0 ? 39 : 29 + d;
}

export function usbKeyToDigit(usbKey: number): number | null {
  if (usbKey >= 30 && usbKey <= 38) return usbKey - 29;
  if (usbKey === 39) return 0;
  return null;
}

/** 摇杆光标位置模式：边距百分比 (5..100, step 5) <-> USB 键值 */
export function percentToCursorRangeKey(pct: number): number {
  const clamped = Math.max(5, Math.min(100, Math.round(pct / 5) * 5));
  if (clamped === 100) return 39; // Digit 0
  if (clamped % 10 === 0) return 29 + clamped / 10; // Digit 1..9 (10%..90%)
  if (clamped === 95) return 98; // NUM0
  return 89 + (clamped - 5) / 10; // NUM1..NUM9 (5%..85%)
}

export function cursorRangeKeyToPercent(usbKey: number): number {
  if (usbKey >= 30 && usbKey <= 38) return (usbKey - 29) * 10;
  if (usbKey === 39) return 100;
  if (usbKey >= 89 && usbKey <= 97) return (usbKey - 89) * 10 + 5;
  if (usbKey === 98) return 95;
  return 100;
}

/** Dial 旋转编码：角度 (1..100°) 与插值 (1..5) <-> 左右旋键值和 func */
export function encodeDialRotate(angle: number, interp: number): {
  ccwKey: number;
  cwKey: number;
  ccwFunc: number;
} {
  const clamped = Math.max(1, Math.min(100, Math.round(angle))) - 1;
  const tens = Math.floor(clamped / 10);
  const ones = clamped % 10;
  const funcMap: Record<number, number> = { 1: 0x01, 2: 0x00, 3: 0x02, 4: 0x04, 5: 0x08 };
  return {
    ccwKey: digitToUsbKey(tens),
    cwKey: digitToUsbKey(ones),
    ccwFunc: funcMap[interp] ?? 0x00,
  };
}

export function decodeDialRotate(ccwKey: number, cwKey: number, ccwFunc: number): {
  angle: number;
  interp: number;
} {
  const tens = usbKeyToDigit(ccwKey);
  const ones = usbKeyToDigit(cwKey);
  const angle = tens !== null && ones !== null ? tens * 10 + ones + 1 : 10;
  let interp = 2;
  if (ccwFunc & 0x01) interp = 1;
  else if (ccwFunc & 0x02) interp = 3;
  else if (ccwFunc & 0x04) interp = 4;
  else if (ccwFunc & 0x08) interp = 5;
  return { angle, interp };
}
