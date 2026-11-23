export const KEY_NUM = 16;
export const RK_NUM = 1;
export const EC_NUM = 2;
export const SLOT_COUNT = 8;
export const KEY_SECTION_MAX_BYTES = 468;
export const LIGHT_LIST_MAX = 9;

export const DEFAULT_VID = 0x1a86; // 6790
export const DEFAULT_PID = 0x5884; // 22660
export const DEFAULT_USAGE_PAGE = 0xff00;

export enum KeyMode {
  None = 0,
  Single = 1,
  Shortcut = 2,
  Macro = 3,
  CursorMove = 4,
  CursorClick = 5,
  SwitchSlot = 6,
  Clicker = 7,
  Buzzer = 8,
  Morse = 9,
}

export const KEY_MODE_LABELS: Record<KeyMode, { name: string; desc: string }> = {
  [KeyMode.None]: { name: '无功能', desc: '禁用此按键' },
  [KeyMode.Single]: { name: '单键', desc: '映射为单个键盘、鼠标或媒体键' },
  [KeyMode.Shortcut]: { name: '组合快捷键', desc: 'Ctrl/Shift/Alt/Win + 任意主键' },
  [KeyMode.Macro]: { name: '宏（按键组）', desc: '按顺序执行多步按键、延时、点击与循环' },
  [KeyMode.CursorMove]: { name: '光标移位', desc: '将指针瞬间移动到屏幕指定坐标' },
  [KeyMode.CursorClick]: { name: '光标点击', desc: '在屏幕指定坐标执行触摸/点击' },
  [KeyMode.SwitchSlot]: { name: '配置切换键', desc: '临时按住或永久切换到 1~8 套配置' },
  [KeyMode.Clicker]: { name: '按键连点', desc: '按住连点或按一次自动持续连点' },
  [KeyMode.Buzzer]: { name: '蜂鸣器模式', desc: '按下后进入小键盘音乐演奏模式' },
  [KeyMode.Morse]: { name: '摩尔斯电码', desc: '单键或双键点划发报输入字符' },
};

/** Modifier bitmask: bit0=Ctrl, bit1=Shift, bit2=Alt, bit3=Win */
export interface Modifiers {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  win: boolean;
}

export type MacroStep =
  | { id: string; type: 'key'; key: number; shift: boolean }
  | { id: string; type: 'shortcut'; key: number; func: number }
  | { id: string; type: 'move' | 'press'; x: number; y: number }
  | { id: string; type: 'delay'; ms: number }
  | { id: string; type: 'loopStart' }
  | { id: string; type: 'loopEnd'; auto: boolean; count: number }
  | { id: string; type: 'reportCtrl'; end: boolean; gap: boolean };

export interface KeyConfig {
  mode: KeyMode;
  key: number;
  func: number; // shortcut modifiers / switch target+temp / clicker auto / morse vol+type
  macro: MacroStep[];
  x: number;
  y: number;
  delayMs: number; // clicker interval
  morseGap: number; // unit 10ms
  morseLong: number; // unit 10ms
}

export enum RockerMode {
  None = 0,
  FourWay = 1,
  EightWay = 2,
  SpeedMouse = 3,
  CursorPos = 4,
}

export enum AuxKeyMode {
  None = 0,
  KeyOrShortcut = 1,
  PermSwitch = 2,
  Dial = 3,
}

export interface RockerConfig {
  mode: RockerMode;
  keyMode: AuxKeyMode;
  invertX: boolean;
  invertY: boolean;
  rotateR90: boolean;
  centerKey: number;
  centerFunc: number;
  upKey: number;
  downKey: number;
  leftKey: number;
  rightKey: number;
  deadzone: number; // 0..200
  inertia: number; // 0..50 (CursorPos: centerX)
  nearParam: number; // 0..50 (CursorPos: centerY)
  farParam: number; // 0..50 (CursorPos: scale)
}

export enum EncoderRotateMode {
  None = 0,
  KeyOrShortcut = 1,
  Dial = 2,
}

export interface EncoderConfig {
  rotateMode: EncoderRotateMode;
  keyMode: AuxKeyMode;
  invert: boolean;
  pressKey: number;
  pressFunc: number;
  ccwKey: number;
  ccwFunc: number;
  cwKey: number;
  cwFunc: number;
}

export enum IndicatorSource {
  None = 0,
  NumLock = 1,
  CapsLock = 2,
  ScrollLock = 3,
  AutoClicker = 4,
  MacroRunning = 5,
}

export interface SystemLedConfig {
  tagColor: [number, number, number];
  indicatorBrightness: [number, number, number];
  channelR: { source: IndicatorSource; invert: boolean };
  channelG: { source: IndicatorSource; invert: boolean };
  channelB: { source: IndicatorSource; invert: boolean };
  tagOnTime: number; // 0..7
  tagFadeSpeed: number; // 0..4
}

export interface KeyboardConfig {
  keys: KeyConfig[]; // length 16
  rocker: RockerConfig;
  encoders: [EncoderConfig, EncoderConfig]; // [EC1(右), EC2(中)]
  systemLed: SystemLedConfig;
  screenWidth: number;
  screenHeight: number;
  orientation: number; // 0=正常, 1=右旋90°, 2=旋转180°, 3=左旋90°
  priority: boolean;
}

export type RgbTuple = [number, number, number];

export interface LightConfig {
  upColors: RgbTuple[]; // 16
  downColors: RgbTuple[]; // 16
  pressFade: number[]; // 16, 0..30
  releaseFade: number[]; // 16, 0..30
  shieldRemain: number[]; // 16, 0..255
  customOrder: number[]; // 16, 0..15
  effectList: number[]; // 9, each 0..5
  effectListCount: number; // 1..9
  switchPolicy: number; // 0=切换, 1=不切换, 2=临时保持
  direction: number; // 0..7
  waveMode: number; // 0..7
  colorShiftTarget: number; // 0=不变, 1=上变, 2=下变, 3=上下变
  colorShiftPeriod: number; // seconds 0..255
  waitTime10ms: number; // unit 10ms, 0..65000
  actionTimeMs: number; // ms, 0..10000
  gapTimeMs: number; // ms, 0..65000
  randGapTimeMs: number; // ms, 0..65000
  fadeOn: number; // 0..30
  fadeOff: number; // 0..30
  shieldFadeOn: number; // 0..30
  shieldFadeOff: number; // 0..30
}

export interface GlobalParams {
  rockerMinX: number;
  rockerMaxX: number;
  rockerMinY: number;
  rockerMaxY: number;
  rockerMidX: number;
  rockerMidY: number;
  keyDebounce: number; // 0..100
  ec1DoubleFreq: boolean;
  ec2DoubleFreq: boolean;
}

export interface LiveInputState {
  rockerX: number;
  rockerY: number;
  ec1Count: number;
  ec2Count: number;
  keyMask: number; // 16 keys (bit 0..15)
  auxMask: number; // bit 0=rocker press, bit 1=EC1 press, bit 2=EC2 press
}

export interface DiagnosticData {
  flagError: number;
  checksumError: number;
  watchdogResets: number;
  consecutiveWatchdogResets: number;
  cfgErrors: number[]; // 8
  lightErrors: number[]; // 8
  globalError: number;
  lastErrorPos: number;
}

export function createDefaultKeyConfig(): KeyConfig {
  return {
    mode: KeyMode.None,
    key: 0,
    func: 0,
    macro: [],
    x: 0,
    y: 0,
    delayMs: 50,
    morseGap: 30,
    morseLong: 15,
  };
}

export function createDefaultKeyboardConfig(): KeyboardConfig {
  return {
    keys: Array.from({ length: KEY_NUM }, () => createDefaultKeyConfig()),
    rocker: {
      mode: RockerMode.None,
      keyMode: AuxKeyMode.None,
      invertX: false,
      invertY: false,
      rotateR90: false,
      centerKey: 0,
      centerFunc: 0,
      upKey: 0,
      downKey: 0,
      leftKey: 0,
      rightKey: 0,
      deadzone: 10,
      inertia: 0,
      nearParam: 0,
      farParam: 50,
    },
    encoders: [
      {
        rotateMode: EncoderRotateMode.KeyOrShortcut,
        keyMode: AuxKeyMode.KeyOrShortcut,
        invert: false,
        pressKey: 244, // 静音
        pressFunc: 0,
        ccwKey: 243, // 音量减
        ccwFunc: 0,
        cwKey: 242, // 音量加
        cwFunc: 0,
      },
      {
        rotateMode: EncoderRotateMode.KeyOrShortcut,
        keyMode: AuxKeyMode.None,
        invert: false,
        pressKey: 0,
        pressFunc: 0,
        ccwKey: 240, // 滚轮向上
        ccwFunc: 0x01, // Ctrl
        cwKey: 241, // 滚轮向下
        cwFunc: 0x01, // Ctrl
      },
    ],
    systemLed: {
      tagColor: [40, 120, 255],
      indicatorBrightness: [50, 30, 20],
      channelR: { source: IndicatorSource.AutoClicker, invert: false },
      channelG: { source: IndicatorSource.NumLock, invert: false },
      channelB: { source: IndicatorSource.CapsLock, invert: false },
      tagOnTime: 5, // 0.5s
      tagFadeSpeed: 2, // 中速
    },
    screenWidth: typeof window !== 'undefined' ? window.screen.width || 1920 : 1920,
    screenHeight: typeof window !== 'undefined' ? window.screen.height || 1080 : 1080,
    orientation: 0,
    priority: false,
  };
}

export function createDefaultLightConfig(): LightConfig {
  const defaultUp: RgbTuple[] = Array.from({ length: KEY_NUM }, (_, i) => {
    const hue = (i * 22) % 360;
    return hsvToRgb(hue, 200, 110);
  });
  const defaultDown: RgbTuple[] = Array.from({ length: KEY_NUM }, () => [255, 255, 255]);
  return {
    upColors: defaultUp,
    downColors: defaultDown,
    pressFade: Array(KEY_NUM).fill(1),
    releaseFade: Array(KEY_NUM).fill(5),
    shieldRemain: Array(KEY_NUM).fill(128),
    customOrder: Array.from({ length: KEY_NUM }, (_, i) => i),
    effectList: [0, 1, 2, 3, 4, 5, 0, 1, 2],
    effectListCount: 6,
    switchPolicy: 0,
    direction: 0,
    waveMode: 0,
    colorShiftTarget: 1,
    colorShiftPeriod: 12,
    waitTime10ms: 0,
    actionTimeMs: 2500,
    gapTimeMs: 0,
    randGapTimeMs: 0,
    fadeOn: 4,
    fadeOff: 8,
    shieldFadeOn: 15,
    shieldFadeOff: 15,
  };
}

export function createDefaultGlobalParams(): GlobalParams {
  return {
    rockerMinX: 0,
    rockerMaxX: 4095,
    rockerMinY: 0,
    rockerMaxY: 4095,
    rockerMidX: 2048,
    rockerMidY: 2048,
    keyDebounce: 2,
    ec1DoubleFreq: false,
    ec2DoubleFreq: false,
  };
}

export function hsvToRgb(h: number, s: number, v: number): RgbTuple {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.max(0, Math.min(255, s)) / 255;
  const vv = Math.max(0, Math.min(255, v)) / 255;
  const c = vv * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = vv - c;
  let r = 0, g = 0, b = 0;
  if (hh < 60) [r, g, b] = [c, x, 0];
  else if (hh < 120) [r, g, b] = [x, c, 0];
  else if (hh < 180) [r, g, b] = [0, c, x];
  else if (hh < 240) [r, g, b] = [0, x, c];
  else if (hh < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rr) h = 60 * (((gg - bb) / d) % 6);
    else if (max === gg) h = 60 * ((bb - rr) / d + 2);
    else h = 60 * ((rr - gg) / d + 4);
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : d / max;
  return [Math.round(h), Math.round(s * 255), Math.round(max * 255)];
}

/** 模拟原 QT rgbToPix(mode=1) 的 WS2812 物理低亮度发光视觉仿真 */
export function simulateLedRgb(r: number, g: number, b: number): RgbTuple {
  const [h, s, rawV] = rgbToHsv(r, g, b);
  let v = rawV;
  if (v > 0 && v < 6) v = v * 20 + 100;
  else if (v >= 6) v = Math.min(Math.round(((v - 6) * 6) / 25) + 200, 255);
  const [sr, sg, sb] = hsvToRgb(h, s, v);
  return [sr, sg, Math.min(Math.round((sb * 12) / 10), 255)];
}
