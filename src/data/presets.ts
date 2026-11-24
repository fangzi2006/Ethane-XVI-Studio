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
  KV_SHIFT,
  KV_VOL_DOWN,
  KV_VOL_MUTE,
  KV_VOL_NEXT,
  KV_VOL_PREV,
  KV_VOL_STOP,
  KV_VOL_UP,
  KV_WHEEL_DOWN,
  KV_WHEEL_UP,
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
    name: '日常办公与网页',
    desc: '按行分区：编辑撤销 / 文档保存查找 / 浏览器标签与截图 / 通用辅助；双旋钮管音量与缩放',
    tags: ['复制/撤销', '标签/截图', '音量+缩放'],
    buildConfig: () => {
      const cfg = createDefaultKeyboardConfig();
      cfg.priority = true;
      // Row 1: 高频编辑
      cfg.keys[0] = { ...cfg.keys[0], mode: KeyMode.Shortcut, key: 6, func: 0x01 }; // Ctrl+C
      cfg.keys[1] = { ...cfg.keys[1], mode: KeyMode.Shortcut, key: 25, func: 0x01 }; // Ctrl+V
      cfg.keys[2] = { ...cfg.keys[2], mode: KeyMode.Shortcut, key: 29, func: 0x01 }; // Ctrl+Z
      cfg.keys[3] = { ...cfg.keys[3], mode: KeyMode.Shortcut, key: 28, func: 0x01 }; // Ctrl+Y
      // Row 2: 文档操作
      cfg.keys[4] = { ...cfg.keys[4], mode: KeyMode.Shortcut, key: 22, func: 0x01 }; // Ctrl+S
      cfg.keys[5] = { ...cfg.keys[5], mode: KeyMode.Shortcut, key: 9, func: 0x01 }; // Ctrl+F
      cfg.keys[6] = { ...cfg.keys[6], mode: KeyMode.Shortcut, key: 4, func: 0x01 }; // Ctrl+A
      cfg.keys[7] = { ...cfg.keys[7], mode: KeyMode.Shortcut, key: 27, func: 0x01 }; // Ctrl+X
      // Row 3: 网页与窗口
      cfg.keys[8] = { ...cfg.keys[8], mode: KeyMode.Shortcut, key: 23, func: 0x01 }; // Ctrl+T
      cfg.keys[9] = { ...cfg.keys[9], mode: KeyMode.Shortcut, key: 26, func: 0x01 }; // Ctrl+W
      cfg.keys[10] = { ...cfg.keys[10], mode: KeyMode.Shortcut, key: 43, func: 0x04 }; // Alt+Tab
      cfg.keys[11] = { ...cfg.keys[11], mode: KeyMode.Shortcut, key: 22, func: 0x0a }; // Win+Shift+S
      // Row 4: 通用辅助
      cfg.keys[12] = { ...cfg.keys[12], mode: KeyMode.Single, key: 41, func: 0 }; // Esc
      cfg.keys[13] = { ...cfg.keys[13], mode: KeyMode.Single, key: 42, func: 0 }; // Backspace
      cfg.keys[14] = { ...cfg.keys[14], mode: KeyMode.Single, key: 40, func: 0 }; // Enter
      cfg.keys[15] = { ...cfg.keys[15], mode: KeyMode.Shortcut, key: 7, func: 0x08 }; // Win+D
      cfg.rocker = {
        ...cfg.rocker,
        mode: RockerMode.FourWay,
        keyMode: AuxKeyMode.KeyOrShortcut,
        upKey: 82,
        downKey: 81,
        leftKey: 80,
        rightKey: 79,
        centerKey: 40, // Enter
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
      light.upColors = Array.from({ length: KEY_NUM }, (_, i) =>
        i < 4 ? [25, 95, 165] : i < 8 ? [20, 75, 135] : i < 12 ? [30, 65, 145] : [45, 70, 120],
      );
      light.downColors = Array.from({ length: KEY_NUM }, () => [200, 240, 255]);
      light.waveMode = 0;
      light.actionTimeMs = 0;
      light.colorShiftTarget = 0;
      return light;
    },
  },
  {
    id: 'numpad',
    name: '标准数字小键盘',
    desc: '贴合盲打习惯的 0~9 + 四则运算 + 退格回车布局，摇杆控方向、双旋钮管音量与切歌',
    tags: ['数字录入', 'Excel / 财务', '媒体旋钮'],
    buildConfig: () => {
      const cfg = createDefaultKeyboardConfig();
      // 7 8 9 Backspace | 4 5 6 + | 1 2 3 - | 0 . * Enter
      const codes = [95, 96, 97, 42, 92, 93, 94, 87, 89, 90, 91, 86, 98, 99, 85, 88];
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
      light.upColors = Array.from({ length: KEY_NUM }, (_, i) =>
        i % 4 === 3 ? [25, 115, 110] : [20, 120, 60],
      );
      light.downColors = Array.from({ length: KEY_NUM }, () => [200, 255, 220]);
      light.waveMode = 0;
      light.actionTimeMs = 0;
      light.colorShiftTarget = 0;
      return light;
    },
  },
  {
    id: 'creator',
    name: '剪辑与设计通用',
    desc: '适配 PR / 剪映 / PS：撤销重做、分割、常用工具与修饰键，旋钮调节笔刷/帧进与画布缩放',
    tags: ['PR / 剪映 / PS', '笔刷与时间轴', '画布缩放'],
    buildConfig: () => {
      const cfg = createDefaultKeyboardConfig();
      // Row 1: 核心撤销/保存/播放抓手
      cfg.keys[0] = { ...cfg.keys[0], mode: KeyMode.Shortcut, key: 29, func: 0x01 }; // Ctrl+Z
      cfg.keys[1] = { ...cfg.keys[1], mode: KeyMode.Shortcut, key: 29, func: 0x03 }; // Ctrl+Shift+Z
      cfg.keys[2] = { ...cfg.keys[2], mode: KeyMode.Shortcut, key: 22, func: 0x01 }; // Ctrl+S
      cfg.keys[3] = { ...cfg.keys[3], mode: KeyMode.Single, key: 44, func: 0 }; // Space
      // Row 2: 高频工具
      cfg.keys[4] = { ...cfg.keys[4], mode: KeyMode.Single, key: 25, func: 0 }; // V 选择
      cfg.keys[5] = { ...cfg.keys[5], mode: KeyMode.Single, key: 5, func: 0 }; // B 画笔/分割
      cfg.keys[6] = { ...cfg.keys[6], mode: KeyMode.Single, key: 8, func: 0 }; // E 橡皮
      cfg.keys[7] = { ...cfg.keys[7], mode: KeyMode.Shortcut, key: 14, func: 0x01 }; // Ctrl+K 切割
      // Row 3: 编排编辑
      cfg.keys[8] = { ...cfg.keys[8], mode: KeyMode.Shortcut, key: 6, func: 0x01 }; // Ctrl+C
      cfg.keys[9] = { ...cfg.keys[9], mode: KeyMode.Shortcut, key: 25, func: 0x01 }; // Ctrl+V
      cfg.keys[10] = { ...cfg.keys[10], mode: KeyMode.Single, key: 76, func: 0 }; // Delete
      cfg.keys[11] = { ...cfg.keys[11], mode: KeyMode.Shortcut, key: 7, func: 0x01 }; // Ctrl+D
      // Row 4: 左手修饰键 + Esc
      cfg.keys[12] = { ...cfg.keys[12], mode: KeyMode.Single, key: KV_SHIFT, func: 0 }; // Shift
      cfg.keys[13] = { ...cfg.keys[13], mode: KeyMode.Single, key: KV_CTRL, func: 0 }; // Ctrl
      cfg.keys[14] = { ...cfg.keys[14], mode: KeyMode.Single, key: KV_ALT, func: 0 }; // Alt
      cfg.keys[15] = { ...cfg.keys[15], mode: KeyMode.Single, key: 41, func: 0 }; // Esc
      cfg.rocker = {
        ...cfg.rocker,
        mode: RockerMode.FourWay,
        keyMode: AuxKeyMode.KeyOrShortcut,
        upKey: 82,
        downKey: 81,
        leftKey: 80,
        rightKey: 79,
        centerKey: 44, // Space
        centerFunc: 0,
        nearParam: 5,
        farParam: 35,
      };
      cfg.encoders[0] = {
        rotateMode: EncoderRotateMode.KeyOrShortcut,
        keyMode: AuxKeyMode.KeyOrShortcut,
        invert: false,
        pressKey: 44, // Space
        pressFunc: 0,
        ccwKey: 47, // '['
        ccwFunc: 0,
        cwKey: 48, // ']'
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
      cfg.systemLed.tagColor = [165, 85, 255];
      return cfg;
    },
    buildLight: () => {
      const light = createDefaultLightConfig();
      light.upColors = Array.from({ length: KEY_NUM }, (_, i) =>
        hsvToRgb(((Math.floor(i / 4) + (i % 4)) * 28 + 210) % 360, 190, 95),
      );
      light.downColors = Array.from({ length: KEY_NUM }, () => [255, 240, 255]);
      light.waveMode = 1;
      light.actionTimeMs = 240;
      light.colorShiftTarget = 0;
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
