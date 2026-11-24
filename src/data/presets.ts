import {
  AuxKeyMode,
  EncoderRotateMode,
  KEY_NUM,
  KeyMode,
  KeyboardConfig,
  LightConfig,
  RockerMode,
  createDefaultKeyboardConfig,
  createDefaultLightConfig,
  hsvToRgb,
} from '../types/config';
import {
  KV_ALT,
  KV_CTRL,
  KV_MOUSE_L,
  KV_VOL_DOWN,
  KV_VOL_MUTE,
  KV_VOL_NEXT,
  KV_VOL_PREV,
  KV_VOL_STOP,
  KV_VOL_UP,
  KV_WHEEL_DOWN,
  KV_WHEEL_UP,
  encodeDialRotate,
} from '../services/keycodes';

export interface ScenarioTemplate {
  id: string;
  name: string;
  desc: string;
  tags: string[];
  buildConfig: () => KeyboardConfig;
  buildLight: () => LightConfig;
}

export const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  {
    id: 'office',
    name: '日常办公效率',
    desc: '高频剪贴板、窗口切换、截图与一键锁屏/桌面，旋钮1调音量、旋钮2滚屏缩放',
    tags: ['复制粘贴', '窗口切换', '音量/缩放'],
    buildConfig: () => {
      const cfg = createDefaultKeyboardConfig();
      cfg.priority = true;
      cfg.keys[0] = { ...cfg.keys[0], mode: KeyMode.Shortcut, key: 6, func: 0x01 }; // Ctrl+C
      cfg.keys[1] = { ...cfg.keys[1], mode: KeyMode.Shortcut, key: 25, func: 0x01 }; // Ctrl+V
      cfg.keys[2] = { ...cfg.keys[2], mode: KeyMode.Shortcut, key: 27, func: 0x01 }; // Ctrl+X
      cfg.keys[3] = { ...cfg.keys[3], mode: KeyMode.Shortcut, key: 29, func: 0x01 }; // Ctrl+Z
      cfg.keys[4] = { ...cfg.keys[4], mode: KeyMode.Shortcut, key: 4, func: 0x01 }; // Ctrl+A
      cfg.keys[5] = { ...cfg.keys[5], mode: KeyMode.Shortcut, key: 22, func: 0x01 }; // Ctrl+S
      cfg.keys[6] = { ...cfg.keys[6], mode: KeyMode.Shortcut, key: 9, func: 0x01 }; // Ctrl+F
      cfg.keys[7] = { ...cfg.keys[7], mode: KeyMode.Shortcut, key: 28, func: 0x01 }; // Ctrl+Y
      cfg.keys[8] = { ...cfg.keys[8], mode: KeyMode.Shortcut, key: 43, func: 0x04 }; // Alt+Tab
      cfg.keys[9] = { ...cfg.keys[9], mode: KeyMode.Shortcut, key: 7, func: 0x08 }; // Win+D
      cfg.keys[10] = { ...cfg.keys[10], mode: KeyMode.Shortcut, key: 22, func: 0x0a }; // Win+Shift+S
      cfg.keys[11] = { ...cfg.keys[11], mode: KeyMode.Shortcut, key: 61, func: 0x04 }; // Alt+F4
      cfg.keys[12] = { ...cfg.keys[12], mode: KeyMode.Single, key: 41, func: 0 }; // Esc
      cfg.keys[13] = { ...cfg.keys[13], mode: KeyMode.Single, key: 40, func: 0 }; // Enter
      cfg.keys[14] = { ...cfg.keys[14], mode: KeyMode.Single, key: 42, func: 0 }; // Backspace
      cfg.keys[15] = { ...cfg.keys[15], mode: KeyMode.SwitchSlot, key: 44, func: 0x82 }; // Fn L2 + Space
      cfg.rocker = {
        ...cfg.rocker,
        mode: RockerMode.FourWay,
        keyMode: AuxKeyMode.KeyOrShortcut,
        upKey: 82,
        downKey: 81,
        leftKey: 80,
        rightKey: 79,
        centerKey: 40,
        centerFunc: 0,
        nearParam: 0,
        farParam: 0,
      };
      cfg.encoders[0] = {
        rotateMode: EncoderRotateMode.KeyOrShortcut,
        keyMode: AuxKeyMode.KeyOrShortcut,
        invert: false,
        pressKey: KV_VOL_MUTE,
        pressFunc: 0,
        ccwKey: KV_VOL_DOWN,
        ccwFunc: 0,
        cwKey: KV_VOL_UP,
        cwFunc: 0,
      };
      cfg.encoders[1] = {
        rotateMode: EncoderRotateMode.KeyOrShortcut,
        keyMode: AuxKeyMode.KeyOrShortcut,
        invert: false,
        pressKey: 39, // Ctrl+0
        pressFunc: 0x01,
        ccwKey: KV_WHEEL_DOWN,
        ccwFunc: 0x01,
        cwKey: KV_WHEEL_UP,
        cwFunc: 0x01,
      };
      cfg.systemLed.tagColor = [40, 130, 255];
      return cfg;
    },
    buildLight: () => {
      const light = createDefaultLightConfig();
      light.upColors = Array.from({ length: KEY_NUM }, () => [20, 75, 130]);
      light.downColors = Array.from({ length: KEY_NUM }, () => [200, 240, 255]);
      light.waveMode = 0;
      light.actionTimeMs = 0;
      light.colorShiftTarget = 0;
      return light;
    },
  },
  {
    id: 'video',
    name: '视频剪辑（PR / 剪映）',
    desc: '剪辑切割、波纹删除、播放控制，双旋钮分别负责时间轴逐帧穿梭与音频音量',
    tags: ['J/K/L 播放', '切割/波纹删', '时间轴旋钮'],
    buildConfig: () => {
      const cfg = createDefaultKeyboardConfig();
      cfg.keys[0] = { ...cfg.keys[0], mode: KeyMode.Single, key: 13, func: 0 }; // J
      cfg.keys[1] = { ...cfg.keys[1], mode: KeyMode.Single, key: 14, func: 0 }; // K
      cfg.keys[2] = { ...cfg.keys[2], mode: KeyMode.Single, key: 15, func: 0 }; // L
      cfg.keys[3] = { ...cfg.keys[3], mode: KeyMode.Single, key: 44, func: 0 }; // Space
      cfg.keys[4] = { ...cfg.keys[4], mode: KeyMode.Shortcut, key: 14, func: 0x01 }; // Ctrl+K (Cut)
      cfg.keys[5] = { ...cfg.keys[5], mode: KeyMode.Single, key: 25, func: 0 }; // V (Select)
      cfg.keys[6] = { ...cfg.keys[6], mode: KeyMode.Single, key: 6, func: 0 }; // C (Razor)
      cfg.keys[7] = { ...cfg.keys[7], mode: KeyMode.Single, key: 76, func: 0 }; // Del
      cfg.keys[8] = { ...cfg.keys[8], mode: KeyMode.Single, key: 12, func: 0 }; // I (In)
      cfg.keys[9] = { ...cfg.keys[9], mode: KeyMode.Single, key: 18, func: 0 }; // O (Out)
      cfg.keys[10] = { ...cfg.keys[10], mode: KeyMode.Single, key: 16, func: 0 }; // M (Marker)
      cfg.keys[11] = { ...cfg.keys[11], mode: KeyMode.Shortcut, key: 29, func: 0x01 }; // Ctrl+Z
      cfg.keys[12] = { ...cfg.keys[12], mode: KeyMode.Single, key: 47, func: 0 }; // [
      cfg.keys[13] = { ...cfg.keys[13], mode: KeyMode.Single, key: 48, func: 0 }; // ]
      cfg.keys[14] = { ...cfg.keys[14], mode: KeyMode.Shortcut, key: 22, func: 0x01 }; // Ctrl+S
      cfg.keys[15] = { ...cfg.keys[15], mode: KeyMode.SwitchSlot, key: 0, func: 1 }; // P1
      cfg.rocker = {
        ...cfg.rocker,
        mode: RockerMode.FourWay,
        keyMode: AuxKeyMode.KeyOrShortcut,
        upKey: 82,
        downKey: 81,
        leftKey: 80,
        rightKey: 79,
        centerKey: 44,
        centerFunc: 0,
        nearParam: 5,
        farParam: 35,
      };
      cfg.encoders[0] = {
        rotateMode: EncoderRotateMode.KeyOrShortcut,
        keyMode: AuxKeyMode.KeyOrShortcut,
        invert: false,
        pressKey: KV_VOL_STOP,
        pressFunc: 0,
        ccwKey: 80, // Left
        ccwFunc: 0,
        cwKey: 79, // Right
        cwFunc: 0,
      };
      cfg.encoders[1] = {
        rotateMode: EncoderRotateMode.KeyOrShortcut,
        keyMode: AuxKeyMode.KeyOrShortcut,
        invert: false,
        pressKey: 49, // '\'
        pressFunc: 0,
        ccwKey: 45, // '-'
        ccwFunc: 0,
        cwKey: 46, // '='
        cwFunc: 0,
      };
      cfg.systemLed.tagColor = [180, 70, 255];
      return cfg;
    },
    buildLight: () => {
      const light = createDefaultLightConfig();
      light.upColors = Array.from({ length: KEY_NUM }, () => [95, 30, 140]);
      light.downColors = Array.from({ length: KEY_NUM }, () => [255, 190, 255]);
      light.waveMode = 2;
      light.actionTimeMs = 180;
      light.colorShiftTarget = 0;
      return light;
    },
  },
  {
    id: 'design',
    name: '绘画设计（PS / SAI / CSP）',
    desc: '笔刷/橡皮/吸管/抓手无缝切换，旋钮调节笔刷大小与画布缩放，支持 Dial',
    tags: ['笔刷大小', '画布缩放', '吸管/抓手'],
    buildConfig: () => {
      const cfg = createDefaultKeyboardConfig();
      cfg.keys[0] = { ...cfg.keys[0], mode: KeyMode.Single, key: 5, func: 0 }; // B Brush
      cfg.keys[1] = { ...cfg.keys[1], mode: KeyMode.Single, key: 8, func: 0 }; // E Eraser
      cfg.keys[2] = { ...cfg.keys[2], mode: KeyMode.Single, key: 44, func: 0 }; // Space Hand
      cfg.keys[3] = { ...cfg.keys[3], mode: KeyMode.Single, key: KV_ALT, func: 0 }; // Alt Eyedropper
      cfg.keys[4] = { ...cfg.keys[4], mode: KeyMode.Shortcut, key: 29, func: 0x01 }; // Ctrl+Z
      cfg.keys[5] = { ...cfg.keys[5], mode: KeyMode.Shortcut, key: 29, func: 0x03 }; // Ctrl+Shift+Z
      cfg.keys[6] = { ...cfg.keys[6], mode: KeyMode.Single, key: 27, func: 0 }; // X Swap color
      cfg.keys[7] = { ...cfg.keys[7], mode: KeyMode.Single, key: 7, func: 0 }; // D Default color
      cfg.keys[8] = { ...cfg.keys[8], mode: KeyMode.Single, key: 15, func: 0 }; // L Lasso
      cfg.keys[9] = { ...cfg.keys[9], mode: KeyMode.Single, key: 16, func: 0 }; // M Marquee
      cfg.keys[10] = { ...cfg.keys[10], mode: KeyMode.Shortcut, key: 23, func: 0x01 }; // Ctrl+T
      cfg.keys[11] = { ...cfg.keys[11], mode: KeyMode.Shortcut, key: 7, func: 0x01 }; // Ctrl+D
      cfg.keys[12] = { ...cfg.keys[12], mode: KeyMode.Single, key: KV_CTRL, func: 0 }; // Ctrl
      cfg.keys[13] = { ...cfg.keys[13], mode: KeyMode.Single, key: 11, func: 0 }; // H Rotate
      cfg.keys[14] = { ...cfg.keys[14], mode: KeyMode.Shortcut, key: 22, func: 0x01 }; // Ctrl+S
      cfg.keys[15] = { ...cfg.keys[15], mode: KeyMode.SwitchSlot, key: 0, func: 1 }; // P1
      cfg.encoders[0] = {
        rotateMode: EncoderRotateMode.KeyOrShortcut,
        keyMode: AuxKeyMode.KeyOrShortcut,
        invert: false,
        pressKey: 47,
        pressFunc: 0,
        ccwKey: 47, // '['
        ccwFunc: 0,
        cwKey: 48, // ']'
        cwFunc: 0,
      };
      const dial = encodeDialRotate(10, 2);
      cfg.encoders[1] = {
        rotateMode: EncoderRotateMode.Dial,
        keyMode: AuxKeyMode.Dial,
        invert: false,
        pressKey: 0,
        pressFunc: 0,
        ccwKey: dial.ccwKey,
        cwKey: dial.cwKey,
        ccwFunc: dial.ccwFunc,
        cwFunc: 0,
      };
      cfg.systemLed.tagColor = [0, 200, 170];
      return cfg;
    },
    buildLight: () => {
      const light = createDefaultLightConfig();
      light.upColors = Array.from({ length: KEY_NUM }, (_, i) =>
        hsvToRgb(((Math.floor(i / 4) + (i % 4)) * 35 + 160) % 360, 200, 100),
      );
      light.downColors = Array.from({ length: KEY_NUM }, () => [255, 255, 255]);
      light.waveMode = 1;
      light.actionTimeMs = 260;
      light.colorShiftTarget = 1;
      light.colorShiftPeriod = 15;
      return light;
    },
  },
  {
    id: 'numpad',
    name: '标准数字小键盘',
    desc: '经典 0~9 数字区 + 加减乘除 + 回车退格，摇杆控制光标方向，旋钮负责切歌与音量',
    tags: ['数字录入', '财务/表格', '媒体控制'],
    buildConfig: () => {
      const cfg = createDefaultKeyboardConfig();
      const codes = [95, 96, 97, 86, 92, 93, 94, 87, 89, 90, 91, 84, 98, 99, 42, 88]; // 7 8 9 - | 4 5 6 + | 1 2 3 / | 0 . Back Enter
      codes.forEach((code, idx) => {
        cfg.keys[idx] = { ...cfg.keys[idx], mode: KeyMode.Single, key: code, func: 0 };
      });
      cfg.rocker = {
        ...cfg.rocker,
        mode: RockerMode.FourWay,
        keyMode: AuxKeyMode.KeyOrShortcut,
        upKey: 82,
        downKey: 81,
        leftKey: 80,
        rightKey: 79,
        centerKey: 43, // Tab
        centerFunc: 0,
        nearParam: 0,
        farParam: 0,
      };
      cfg.encoders[0] = {
        rotateMode: EncoderRotateMode.KeyOrShortcut,
        keyMode: AuxKeyMode.KeyOrShortcut,
        invert: false,
        pressKey: KV_VOL_MUTE,
        pressFunc: 0,
        ccwKey: KV_VOL_DOWN,
        ccwFunc: 0,
        cwKey: KV_VOL_UP,
        cwFunc: 0,
      };
      cfg.encoders[1] = {
        rotateMode: EncoderRotateMode.KeyOrShortcut,
        keyMode: AuxKeyMode.KeyOrShortcut,
        invert: false,
        pressKey: KV_VOL_STOP,
        pressFunc: 0,
        ccwKey: KV_VOL_PREV,
        ccwFunc: 0,
        cwKey: KV_VOL_NEXT,
        cwFunc: 0,
      };
      cfg.systemLed.tagColor = [30, 210, 90];
      return cfg;
    },
    buildLight: () => {
      const light = createDefaultLightConfig();
      light.upColors = Array.from({ length: KEY_NUM }, () => [20, 120, 60]);
      light.downColors = Array.from({ length: KEY_NUM }, () => [200, 255, 220]);
      light.waveMode = 0;
      light.actionTimeMs = 0;
      light.colorShiftTarget = 0;
      return light;
    },
  },
  {
    id: 'gaming',
    name: '游戏娱乐与连点',
    desc: '8向摇杆 WASD 走位，独立自动连点键、一键连招宏，以及酷炫呼吸流光',
    tags: ['8向 WASD', '自动连点', '游戏宏'],
    buildConfig: () => {
      const cfg = createDefaultKeyboardConfig();
      cfg.keys[0] = { ...cfg.keys[0], mode: KeyMode.Single, key: 20, func: 0 }; // Q
      cfg.keys[1] = { ...cfg.keys[1], mode: KeyMode.Single, key: 26, func: 0 }; // W
      cfg.keys[2] = { ...cfg.keys[2], mode: KeyMode.Single, key: 8, func: 0 }; // E
      cfg.keys[3] = { ...cfg.keys[3], mode: KeyMode.Single, key: 21, func: 0 }; // R
      cfg.keys[4] = { ...cfg.keys[4], mode: KeyMode.Single, key: 4, func: 0 }; // A
      cfg.keys[5] = { ...cfg.keys[5], mode: KeyMode.Single, key: 22, func: 0 }; // S
      cfg.keys[6] = { ...cfg.keys[6], mode: KeyMode.Single, key: 7, func: 0 }; // D
      cfg.keys[7] = { ...cfg.keys[7], mode: KeyMode.Single, key: 9, func: 0 }; // F
      cfg.keys[8] = { ...cfg.keys[8], mode: KeyMode.Single, key: 30, func: 0 }; // 1
      cfg.keys[9] = { ...cfg.keys[9], mode: KeyMode.Single, key: 31, func: 0 }; // 2
      cfg.keys[10] = { ...cfg.keys[10], mode: KeyMode.Single, key: 32, func: 0 }; // 3
      cfg.keys[11] = {
        ...cfg.keys[11],
        mode: KeyMode.Clicker,
        key: KV_MOUSE_L,
        func: 1,
        delayMs: 50,
      };
      cfg.keys[12] = { ...cfg.keys[12], mode: KeyMode.Single, key: 41, func: 0 }; // Esc
      cfg.keys[13] = { ...cfg.keys[13], mode: KeyMode.Single, key: 44, func: 0 }; // Space
      cfg.keys[14] = {
        ...cfg.keys[14],
        mode: KeyMode.Macro,
        macro: [
          { id: 'g1', type: 'key', key: 20, shift: false },
          { id: 'g2', type: 'delay', ms: 60 },
          { id: 'g3', type: 'key', key: 8, shift: false },
          { id: 'g4', type: 'delay', ms: 60 },
          { id: 'g5', type: 'key', key: 21, shift: false },
        ],
      };
      cfg.keys[15] = { ...cfg.keys[15], mode: KeyMode.SwitchSlot, key: 0, func: 1 }; // P1
      cfg.rocker = {
        ...cfg.rocker,
        mode: RockerMode.EightWay,
        keyMode: AuxKeyMode.KeyOrShortcut,
        upKey: 26,
        downKey: 22,
        leftKey: 4,
        rightKey: 7,
        centerKey: 44, // Space
        centerFunc: 0,
        nearParam: 0,
        farParam: 0,
      };
      cfg.systemLed.tagColor = [255, 60, 80];
      return cfg;
    },
    buildLight: () => {
      const light = createDefaultLightConfig();
      light.upColors = Array.from({ length: KEY_NUM }, () => [140, 25, 25]);
      light.downColors = Array.from({ length: KEY_NUM }, () => [255, 230, 80]);
      light.waveMode = 4; // 涡旋
      light.actionTimeMs = 150;
      light.colorShiftTarget = 1;
      light.colorShiftPeriod = 10;
      return light;
    },
  },
];

export const BUZZER_KEYMAP = [
  '高音 4', '高音 5', '高音 6', '高音 7',
  '高音 8', '高音 1', '高音 2', '高音 3',
  '中音 4', '中音 5', '中音 6', '中音 7',
  '升半音 #', '低音 1', '低音 2', '低音 3',
];

export interface MorseRefItem {
  char: string;
  code: string;
  isCustom?: boolean;
}

export const MORSE_REFERENCE: MorseRefItem[] = [
  { char: 'A', code: '· -' },
  { char: 'B', code: '- · · ·' },
  { char: 'C', code: '- · - ·' },
  { char: 'D', code: '- · ·' },
  { char: 'E', code: '·' },
  { char: 'F', code: '· · - ·' },
  { char: 'G', code: '- - ·' },
  { char: 'H', code: '· · · ·' },
  { char: 'I', code: '· ·' },
  { char: 'J', code: '· - - -' },
  { char: 'K', code: '- · -' },
  { char: 'L', code: '· - · ·' },
  { char: 'M', code: '- -' },
  { char: 'N', code: '- ·' },
  { char: 'O', code: '- - -' },
  { char: 'P', code: '· - - ·' },
  { char: 'Q', code: '- - · -' },
  { char: 'R', code: '· - ·' },
  { char: 'S', code: '· · ·' },
  { char: 'T', code: '-' },
  { char: 'U', code: '· · -' },
  { char: 'V', code: '· · · -' },
  { char: 'W', code: '· - -' },
  { char: 'X', code: '- · · -' },
  { char: 'Y', code: '- · - -' },
  { char: 'Z', code: '- - · ·' },
  { char: '1', code: '· - - - -' },
  { char: '2', code: '· · - - -' },
  { char: '3', code: '· · · - -' },
  { char: '4', code: '· · · · -' },
  { char: '5', code: '· · · · ·' },
  { char: '6', code: '- · · · ·' },
  { char: '7', code: '- - · · ·' },
  { char: '8', code: '- - - · ·' },
  { char: '9', code: '- - - - ·' },
  { char: '0', code: '- - - - -' },
  { char: 'Space', code: '- - - -', isCustom: true },
  { char: 'Return', code: '- - - ·', isCustom: true },
  { char: 'Backspace', code: '· · · · · ·', isCustom: true },
  { char: 'Esc', code: '· · - -', isCustom: true },
  { char: 'Tab', code: '· - · -', isCustom: true },
  { char: 'CapsLock', code: '· · - - ·', isCustom: true },
  { char: 'Shift', code: '- - · · -', isCustom: true },
  { char: 'Delete', code: '· - - · -', isCustom: true },
  { char: '↑', code: '- - · - -', isCustom: true },
  { char: '↓', code: '· · - · ·', isCustom: true },
  { char: '←', code: '- · - - -', isCustom: true },
  { char: '→', code: '- - - · -', isCustom: true },
];
