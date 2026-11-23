import {
  Gamepad2,
  Keyboard,
  Layers,
  ListTree,
  MousePointerClick,
  Repeat,
  RotateCw,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import {
  AuxKeyMode,
  EncoderConfig,
  EncoderRotateMode,
  KEY_SECTION_MAX_BYTES,
  KeyConfig,
  KeyMode,
  RockerMode,
  SLOT_COUNT,
} from '../types/config';
import {
  cursorRangeKeyToPercent,
  decodeDialRotate,
  digitToUsbKey,
  encodeDialRotate,
  formatShortcutCompact,
  percentToCursorRangeKey,
  usbKeyToDigit,
  usbKeyToLabel,
} from '../services/keycodes';
import { calculateKeySectionSize } from '../services/protocol';
import { useDevice } from '../store/useDeviceStore';
import { KeyCaptureInput } from './KeyCaptureInput';
import { MacroBuilder } from './MacroBuilder';

type KeyCategory = 'basic' | 'macro' | 'switch' | 'clicker' | 'extra';

function modeToCategory(mode: KeyMode): KeyCategory {
  if (mode === KeyMode.None || mode === KeyMode.Single || mode === KeyMode.Shortcut) return 'basic';
  if (mode === KeyMode.Macro) return 'macro';
  if (mode === KeyMode.SwitchSlot) return 'switch';
  if (mode === KeyMode.Clicker) return 'clicker';
  return 'extra';
}

export function KeyEditor() {
  const { selection, keyboardConfig, setKeyboardConfig } = useDevice();
  const [rockerFocus, setRockerFocus] = useState<'up' | 'down' | 'left' | 'right' | 'center'>('up');
  const [encoderFocus, setEncoderFocus] = useState<'ccw' | 'press' | 'cw'>('ccw');
  const totalKeyBytes = calculateKeySectionSize(keyboardConfig.keys);

  // ==================== 1. 机械按键 K1~K16 ====================
  if (selection.kind === 'key' || selection.kind === 'led') {
    const idx = selection.kind === 'key' ? selection.index : 0;
    const keyCfg = keyboardConfig.keys[idx];
    const category = modeToCategory(keyCfg.mode);

    const patchKey = (patch: Partial<KeyConfig>) => {
      setKeyboardConfig((prev) => {
        const nextKeys = [...prev.keys];
        nextKeys[idx] = { ...nextKeys[idx], ...patch };
        return { ...prev, keys: nextKeys };
      });
    };

    const switchCategory = (cat: KeyCategory) => {
      if (cat === category) return;
      if (cat === 'basic') {
        patchKey({ mode: keyCfg.key ? (keyCfg.func ? KeyMode.Shortcut : KeyMode.Single) : KeyMode.None });
      } else if (cat === 'macro') {
        patchKey({ mode: KeyMode.Macro });
      } else if (cat === 'switch') {
        patchKey({ mode: KeyMode.SwitchSlot, func: keyCfg.func || 0x82 });
      } else if (cat === 'clicker') {
        patchKey({ mode: KeyMode.Clicker, key: keyCfg.key || 246, delayMs: keyCfg.delayMs || 80 });
      } else {
        patchKey({ mode: KeyMode.CursorClick });
      }
    };

    const handleBasicKeyChange = (usbKey: number, func: number) => {
      if (usbKey === 0 && func === 0) {
        patchKey({ mode: KeyMode.None, key: 0, func: 0 });
      } else if (func !== 0) {
        patchKey({ mode: KeyMode.Shortcut, key: usbKey, func });
      } else {
        patchKey({ mode: KeyMode.Single, key: usbKey, func: 0 });
      }
    };

    const isTempSwitch = Boolean(keyCfg.func & 0x80);
    const switchTarget = Math.max(1, Math.min(8, keyCfg.func & 0x0f || 1));
    const morseVol = (keyCfg.func >> 4) & 0x0f;
    const morseType = keyCfg.func & 0x03;

    const categories: { id: KeyCategory; label: string; icon: typeof Keyboard }[] = [
      { id: 'basic', label: '按键 / 快捷键', icon: Keyboard },
      { id: 'macro', label: '宏连招', icon: ListTree },
      { id: 'switch', label: '切换配置层', icon: Layers },
      { id: 'clicker', label: '连点器', icon: Repeat },
      { id: 'extra', label: '特色扩展', icon: Sparkles },
    ];

    return (
      <div className="space-y-4">
        {/* 头部标题 */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/20 font-mono text-sm font-bold text-indigo-300">
              K{idx + 1}
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">按键 K{idx + 1}</h2>
              <p className="text-xs text-slate-400">选择功能类型，直接录制按键即可生效</p>
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-2.5 py-1 text-[11px] text-slate-400">
            总容量{' '}
            <span
              className={`font-mono font-semibold ${
                totalKeyBytes > KEY_SECTION_MAX_BYTES ? 'text-rose-400' : 'text-slate-200'
              }`}
            >
              {totalKeyBytes}/{KEY_SECTION_MAX_BYTES}B
            </span>
          </div>
        </div>

        {/* 5 大直觉分类标签 */}
        <div className="grid grid-cols-5 gap-1.5 rounded-xl border border-slate-800 bg-slate-950/70 p-1">
          {categories.map((c) => {
            const Icon = c.icon;
            const active = category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => switchCategory(c.id)}
                className={`flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-semibold transition sm:flex-row sm:gap-1.5 ${
                  active
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{c.label}</span>
              </button>
            );
          })}
        </div>

        {/* 内容面板 */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          {category === 'basic' && (
            <div className="space-y-3">
              <KeyCaptureInput
                usbKey={keyCfg.mode === KeyMode.None ? 0 : keyCfg.key}
                func={keyCfg.mode === KeyMode.Shortcut ? keyCfg.func : 0}
                allowModifiers
                allowModifierAsMainKey
                label="直接按下单键或组合快捷键（自动识别单键/快捷键）"
                onChange={handleBasicKeyChange}
              />
              {/* 常用效率快捷键一键填入 */}
              <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-800 pt-3 text-[11px]">
                <span className="text-slate-500">常用一键填入：</span>
                {[
                  { label: '复制 Ctrl+C', key: 6, func: 0x01 },
                  { label: '粘贴 Ctrl+V', key: 25, func: 0x01 },
                  { label: '撤销 Ctrl+Z', key: 29, func: 0x01 },
                  { label: '保存 Ctrl+S', key: 22, func: 0x01 },
                  { label: '切窗 Alt+Tab', key: 43, func: 0x04 },
                  { label: 'Esc', key: 41, func: 0 },
                  { label: 'Enter', key: 40, func: 0 },
                  { label: 'Space', key: 44, func: 0 },
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => handleBasicKeyChange(p.key, p.func)}
                    className="rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-slate-300 hover:border-indigo-400 hover:text-white"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {category === 'macro' && (
            <MacroBuilder
              steps={keyCfg.macro}
              screenWidth={keyboardConfig.screenWidth}
              screenHeight={keyboardConfig.screenHeight}
              onChange={(macro) => patchKey({ macro })}
            />
          )}

          {category === 'switch' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => patchKey({ func: switchTarget | 0x80 })}
                  className={`rounded-xl border p-3 text-left transition ${
                    isTempSwitch
                      ? 'border-indigo-400 bg-indigo-600/20 text-white'
                      : 'border-slate-800 bg-slate-950 text-slate-400'
                  }`}
                >
                  <div className="text-xs font-semibold">临时切换（类似 Fn 键）</div>
                  <div className="mt-0.5 text-[11px] text-slate-400">按住时临时切层，松开即刻恢复</div>
                </button>
                <button
                  type="button"
                  onClick={() => patchKey({ key: 0, func: switchTarget })}
                  className={`rounded-xl border p-3 text-left transition ${
                    !isTempSwitch
                      ? 'border-indigo-400 bg-indigo-600/20 text-white'
                      : 'border-slate-800 bg-slate-950 text-slate-400'
                  }`}
                >
                  <div className="text-xs font-semibold">永久切换</div>
                  <div className="mt-0.5 text-[11px] text-slate-400">按一下永久切换至目标配置层</div>
                </button>
              </div>

              <div>
                <span className="mb-2 block text-xs font-medium text-slate-300">目标配置层</span>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                  {Array.from({ length: SLOT_COUNT }, (_, i) => {
                    const targetNum = i + 1;
                    return (
                      <button
                        key={targetNum}
                        type="button"
                        onClick={() =>
                          patchKey({ func: (isTempSwitch ? 0x80 : 0) | targetNum })
                        }
                        className={`rounded-lg border py-2 text-xs font-semibold transition ${
                          switchTarget === targetNum
                            ? 'border-indigo-400 bg-indigo-600 text-white'
                            : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        L{targetNum}
                      </button>
                    );
                  })}
                </div>
              </div>

              {isTempSwitch && (
                <div className="border-t border-slate-800 pt-3">
                  <KeyCaptureInput
                    usbKey={keyCfg.key}
                    label="轻按复用单键（可选：仅轻点此键未组合其他键时输出）"
                    onChange={(k) => patchKey({ key: k })}
                  />
                </div>
              )}
            </div>
          )}

          {category === 'clicker' && (
            <div className="space-y-4">
              <KeyCaptureInput
                usbKey={keyCfg.key}
                label="要连点的按键"
                onChange={(k) => patchKey({ key: k })}
              />
              <div className="grid gap-4 border-t border-slate-800 pt-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-slate-300">触发方式</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => patchKey({ func: 0 })}
                      className={`rounded-lg border py-2 text-xs font-medium ${
                        keyCfg.func === 0
                          ? 'border-indigo-400 bg-indigo-600/20 text-white'
                          : 'border-slate-800 bg-slate-950 text-slate-400'
                      }`}
                    >
                      按住连点
                    </button>
                    <button
                      type="button"
                      onClick={() => patchKey({ func: 1 })}
                      className={`rounded-lg border py-2 text-xs font-medium ${
                        keyCfg.func === 1
                          ? 'border-indigo-400 bg-indigo-600/20 text-white'
                          : 'border-slate-800 bg-slate-950 text-slate-400'
                      }`}
                    >
                      按一下持续连点
                    </button>
                  </div>
                </div>
                <label className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>连点间隔 (ms)</span>
                    <span className="text-indigo-300">
                      {keyCfg.delayMs === 0
                        ? '长按不松'
                        : `约 ${(1000 / Math.max(15, keyCfg.delayMs)).toFixed(1)} 次/秒`}
                    </span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={65000}
                    value={keyCfg.delayMs}
                    onChange={(e) =>
                      patchKey({ delayMs: Math.max(0, Math.min(65000, Number(e.target.value))) })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </label>
              </div>
            </div>
          )}

          {category === 'extra' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { mode: KeyMode.CursorClick, label: '屏幕定位点击' },
                  { mode: KeyMode.CursorMove, label: '屏幕定位移位' },
                  { mode: KeyMode.Buzzer, label: '蜂鸣器演奏' },
                  { mode: KeyMode.Morse, label: '摩尔斯电码' },
                ].map((opt) => (
                  <button
                    key={opt.mode}
                    type="button"
                    onClick={() => patchKey({ mode: opt.mode })}
                    className={`rounded-xl border py-2 text-xs font-semibold transition ${
                      keyCfg.mode === opt.mode
                        ? 'border-indigo-400 bg-indigo-600/20 text-white'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {(keyCfg.mode === KeyMode.CursorClick || keyCfg.mode === KeyMode.CursorMove) && (
                <div className="space-y-3 border-t border-slate-800 pt-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <MousePointerClick className="h-3.5 w-3.5 text-emerald-400" />
                    按当前屏幕 {keyboardConfig.screenWidth}×{keyboardConfig.screenHeight} 映射绝对坐标
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-1 text-xs">
                      <span className="text-slate-300">X 坐标 (px)</span>
                      <input
                        type="number"
                        min={0}
                        max={keyboardConfig.screenWidth - 1}
                        value={keyCfg.x}
                        onChange={(e) => patchKey({ x: Math.max(0, Number(e.target.value)) })}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                      />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="text-slate-300">Y 坐标 (px)</span>
                      <input
                        type="number"
                        min={0}
                        max={keyboardConfig.screenHeight - 1}
                        value={keyCfg.y}
                        onChange={(e) => patchKey({ y: Math.max(0, Number(e.target.value)) })}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                      />
                    </label>
                  </div>
                </div>
              )}

              {keyCfg.mode === KeyMode.Buzzer && (
                <p className="border-t border-slate-800 pt-3 text-xs text-slate-300">
                  按下此键进入小键盘蜂鸣器演奏模式（旋钮调节音量，按下摇杆或旋钮退出）。演奏模式下请勿进行上位机写入。
                </p>
              )}

              {keyCfg.mode === KeyMode.Morse && (
                <div className="space-y-3 border-t border-slate-800 pt-3">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { val: 2, label: '单键 (· / -)' },
                      { val: 0, label: '双键 · 点' },
                      { val: 1, label: '双键 · 划' },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => patchKey({ func: (morseVol << 4) | opt.val })}
                        className={`rounded-lg border py-1.5 text-xs font-medium ${
                          morseType === opt.val
                            ? 'border-indigo-400 bg-indigo-600/20 text-white'
                            : 'border-slate-800 bg-slate-950 text-slate-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3 text-xs">
                    <label className="space-y-1">
                      <span className="text-slate-300">音量 {morseVol}/10</span>
                      <input
                        type="range"
                        min={0}
                        max={10}
                        value={morseVol}
                        onChange={(e) =>
                          patchKey({ func: (Number(e.target.value) << 4) | morseType })
                        }
                        className="w-full accent-indigo-500"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-slate-300">字符间隔 {keyCfg.morseGap * 10}ms</span>
                      <input
                        type="range"
                        min={1}
                        max={100}
                        value={keyCfg.morseGap}
                        onChange={(e) => patchKey({ morseGap: Number(e.target.value) })}
                        className="w-full accent-indigo-500"
                      />
                    </label>
                    {morseType === 2 && (
                      <label className="space-y-1">
                        <span className="text-slate-300">长按阈值 {keyCfg.morseLong * 10}ms</span>
                        <input
                          type="range"
                          min={1}
                          max={100}
                          value={keyCfg.morseLong}
                          onChange={(e) => patchKey({ morseLong: Number(e.target.value) })}
                          className="w-full accent-indigo-500"
                        />
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==================== 2. 摇杆 RK1（紧凑十字交互式） ====================
  if (selection.kind === 'rocker') {
    const rk = keyboardConfig.rocker;
    const patchRocker = (patch: Partial<typeof rk>) =>
      setKeyboardConfig((prev) => ({ ...prev, rocker: { ...prev.rocker, ...patch } }));
    const permSlot = usbKeyToDigit(rk.centerKey) ?? 1;

    const dirItems: {
      id: 'up' | 'down' | 'left' | 'right' | 'center';
      label: string;
      val: string;
    }[] = [
      { id: 'up', label: '↑ 上推', val: usbKeyToLabel(rk.upKey) },
      { id: 'down', label: '↓ 下推', val: usbKeyToLabel(rk.downKey) },
      { id: 'left', label: '← 左推', val: usbKeyToLabel(rk.leftKey) },
      { id: 'right', label: '→ 右推', val: usbKeyToLabel(rk.rightKey) },
      {
        id: 'center',
        label: '● 下压按键',
        val:
          rk.keyMode === AuxKeyMode.None
            ? '禁用'
            : rk.keyMode === AuxKeyMode.PermSwitch
              ? `切至 L${permSlot}`
              : rk.keyMode === AuxKeyMode.Dial
                ? 'Dial 按压'
                : formatShortcutCompact(rk.centerKey, rk.centerFunc),
      },
    ];

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300">
            <Gamepad2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">摇杆 RK1（左上角）</h2>
            <p className="text-xs text-slate-400">选择摇杆模式，点击下方方向块即可聚焦修改单个方向键位</p>
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:grid-cols-2">
          <label className="space-y-1 text-xs">
            <span className="font-medium text-slate-300">推动模式</span>
            <select
              value={rk.mode}
              onChange={(e) => patchRocker({ mode: Number(e.target.value) as RockerMode })}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            >
              <option value={RockerMode.None}>禁用推动</option>
              <option value={RockerMode.FourWay}>4 向按键（WASD 等）</option>
              <option value={RockerMode.EightWay}>8 向按键（支持斜向双键）</option>
              <option value={RockerMode.SpeedMouse}>速度鼠标</option>
              <option value={RockerMode.CursorPos}>绝对光标区域</option>
            </select>
          </label>

          <label className="space-y-1 text-xs">
            <span className="font-medium text-slate-300">下压按键模式</span>
            <select
              value={rk.keyMode}
              onChange={(e) => patchRocker({ keyMode: Number(e.target.value) as AuxKeyMode })}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            >
              <option value={AuxKeyMode.None}>禁用下压</option>
              <option value={AuxKeyMode.KeyOrShortcut}>按键 / 快捷键</option>
              <option value={AuxKeyMode.PermSwitch}>永久切换配置层</option>
              <option value={AuxKeyMode.Dial}>Surface Dial 按压</option>
            </select>
          </label>

          <div className="flex flex-wrap gap-4 text-xs sm:col-span-2">
            <label className="flex items-center gap-1.5 text-slate-300">
              <input
                type="checkbox"
                checked={rk.invertX}
                onChange={(e) => patchRocker({ invertX: e.target.checked })}
              />
              左右反向
            </label>
            <label className="flex items-center gap-1.5 text-slate-300">
              <input
                type="checkbox"
                checked={rk.invertY}
                onChange={(e) => patchRocker({ invertY: e.target.checked })}
              />
              上下反向
            </label>
            <label className="flex items-center gap-1.5 text-slate-300">
              <input
                type="checkbox"
                checked={rk.rotateR90}
                onChange={(e) => patchRocker({ rotateR90: e.target.checked })}
              />
              坐标系右旋 90°
            </label>
          </div>
        </div>

        {/* 紧凑方向聚焦选择器 */}
        {(rk.mode === RockerMode.FourWay ||
          rk.mode === RockerMode.EightWay ||
          rk.keyMode !== AuxKeyMode.None) && (
          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="grid grid-cols-5 gap-2">
              {dirItems.map((item) => {
                const disabled =
                  item.id !== 'center' &&
                  rk.mode !== RockerMode.FourWay &&
                  rk.mode !== RockerMode.EightWay;
                const active = rockerFocus === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => setRockerFocus(item.id)}
                    className={`rounded-xl border px-2 py-2 text-center transition disabled:opacity-30 ${
                      active
                        ? 'border-indigo-400 bg-indigo-600/20 text-white'
                        : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="text-[10px] text-slate-400">{item.label}</div>
                    <div className="mt-0.5 truncate text-xs font-semibold">{item.val}</div>
                  </button>
                );
              })}
            </div>

            {rockerFocus === 'center' ? (
              rk.keyMode === AuxKeyMode.KeyOrShortcut ? (
                <KeyCaptureInput
                  usbKey={rk.centerKey}
                  func={rk.centerFunc}
                  allowModifiers
                  label="摇杆中心下压按键"
                  onChange={(k, f) => patchRocker({ centerKey: k, centerFunc: f })}
                />
              ) : rk.keyMode === AuxKeyMode.PermSwitch ? (
                <div className="space-y-2">
                  <span className="text-xs text-slate-300">按下摇杆切换至目标配置层：</span>
                  <div className="grid grid-cols-8 gap-1.5">
                    {Array.from({ length: SLOT_COUNT }, (_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => patchRocker({ centerKey: digitToUsbKey(i + 1), centerFunc: 0 })}
                        className={`rounded-lg border py-1.5 text-xs font-semibold ${
                          permSlot === i + 1
                            ? 'border-indigo-400 bg-indigo-600 text-white'
                            : 'border-slate-800 bg-slate-950 text-slate-300'
                        }`}
                      >
                        L{i + 1}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">当前下压模式无需单独绑定键值。</p>
              )
            ) : (
              (rk.mode === RockerMode.FourWay || rk.mode === RockerMode.EightWay) && (
                <KeyCaptureInput
                  usbKey={
                    rockerFocus === 'up'
                      ? rk.upKey
                      : rockerFocus === 'down'
                        ? rk.downKey
                        : rockerFocus === 'left'
                          ? rk.leftKey
                          : rk.rightKey
                  }
                  allowModifierAsMainKey
                  label={`设置 ${dirItems.find((d) => d.id === rockerFocus)?.label} 绑定的按键`}
                  onChange={(k) => {
                    if (rockerFocus === 'up') patchRocker({ upKey: k });
                    else if (rockerFocus === 'down') patchRocker({ downKey: k });
                    else if (rockerFocus === 'left') patchRocker({ leftKey: k });
                    else patchRocker({ rightKey: k });
                  }}
                />
              )
            )}
          </div>
        )}

        {/* 死区与手感参数 */}
        {rk.mode !== RockerMode.None && (
          <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 text-xs sm:grid-cols-2">
            <label className="space-y-1">
              <div className="flex justify-between text-slate-300">
                <span>死区阈值</span>
                <span className="font-mono text-indigo-300">{rk.deadzone}/200</span>
              </div>
              <input
                type="range"
                min={0}
                max={200}
                value={rk.deadzone}
                onChange={(e) => patchRocker({ deadzone: Number(e.target.value) })}
                className="w-full accent-indigo-500"
              />
            </label>
            <label className="space-y-1">
              <div className="flex justify-between text-slate-300">
                <span>{rk.mode === RockerMode.CursorPos ? '中心点 X' : '惯性平滑'}</span>
                <span className="font-mono text-indigo-300">{rk.inertia}/50</span>
              </div>
              <input
                type="range"
                min={0}
                max={50}
                value={rk.inertia}
                onChange={(e) => patchRocker({ inertia: Number(e.target.value) })}
                className="w-full accent-indigo-500"
              />
            </label>
            <label className="space-y-1">
              <div className="flex justify-between text-slate-300">
                <span>{rk.mode === RockerMode.CursorPos ? '中心点 Y' : '近端幅度'}</span>
                <span className="font-mono text-indigo-300">{rk.nearParam}/50</span>
              </div>
              <input
                type="range"
                min={0}
                max={50}
                value={rk.nearParam}
                onChange={(e) => patchRocker({ nearParam: Number(e.target.value) })}
                className="w-full accent-indigo-500"
              />
            </label>
            <label className="space-y-1">
              <div className="flex justify-between text-slate-300">
                <span>{rk.mode === RockerMode.CursorPos ? '范围缩放' : '远端幅度'}</span>
                <span className="font-mono text-indigo-300">{rk.farParam}/50</span>
              </div>
              <input
                type="range"
                min={0}
                max={50}
                value={rk.farParam}
                onChange={(e) => patchRocker({ farParam: Number(e.target.value) })}
                className="w-full accent-indigo-500"
              />
            </label>

            {rk.mode === RockerMode.CursorPos && (
              <div className="grid grid-cols-4 gap-2 border-t border-slate-800 pt-3 sm:col-span-2">
                {(
                  [
                    ['上', 'upKey'],
                    ['下', 'downKey'],
                    ['左', 'leftKey'],
                    ['右', 'rightKey'],
                  ] as const
                ).map(([lbl, field]) => {
                  const pct = cursorRangeKeyToPercent(rk[field]);
                  return (
                    <label key={field} className="space-y-1">
                      <span className="text-slate-400">
                        {lbl}边距 <strong className="text-indigo-300">{pct}%</strong>
                      </span>
                      <input
                        type="range"
                        min={5}
                        max={100}
                        step={5}
                        value={pct}
                        onChange={(e) =>
                          patchRocker({ [field]: percentToCursorRangeKey(Number(e.target.value)) })
                        }
                        className="w-full accent-indigo-500"
                      />
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ==================== 3. 双旋钮 EC1 / EC2（紧凑三向交互式） ====================
  const eIdx = selection.index;
  const ec = keyboardConfig.encoders[eIdx];
  const title = eIdx === 0 ? '旋钮 1 EC1（最右侧）' : '旋钮 2 EC2（顶部靠中）';

  const patchEncoder = (patch: Partial<EncoderConfig>) => {
    setKeyboardConfig((prev) => {
      const next: [EncoderConfig, EncoderConfig] = [{ ...prev.encoders[0] }, { ...prev.encoders[1] }];
      next[eIdx] = { ...next[eIdx], ...patch };
      return { ...prev, encoders: next };
    });
  };

  const dial = decodeDialRotate(ec.ccwKey, ec.cwKey, ec.ccwFunc);
  const permSlot = usbKeyToDigit(ec.pressKey) ?? 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
          <RotateCw className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <p className="text-xs text-slate-400">支持音量/缩放快捷键、Surface Dial 轮盘与下压功能</p>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:grid-cols-2">
        <label className="space-y-1 text-xs">
          <span className="font-medium text-slate-300">旋转模式</span>
          <select
            value={ec.rotateMode}
            onChange={(e) =>
              patchEncoder({ rotateMode: Number(e.target.value) as EncoderRotateMode })
            }
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
          >
            <option value={EncoderRotateMode.None}>禁用旋转</option>
            <option value={EncoderRotateMode.KeyOrShortcut}>按键 / 快捷键</option>
            <option value={EncoderRotateMode.Dial}>Surface Dial 轮盘</option>
          </select>
        </label>

        <label className="space-y-1 text-xs">
          <span className="font-medium text-slate-300">下压模式</span>
          <select
            value={ec.keyMode}
            onChange={(e) => patchEncoder({ keyMode: Number(e.target.value) as AuxKeyMode })}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
          >
            <option value={AuxKeyMode.None}>禁用下压</option>
            <option value={AuxKeyMode.KeyOrShortcut}>按键 / 快捷键</option>
            <option value={AuxKeyMode.PermSwitch}>永久切换配置层</option>
            <option value={AuxKeyMode.Dial}>Surface Dial 按压</option>
          </select>
        </label>

        <label className="flex items-center gap-2 text-xs text-slate-300 sm:col-span-2">
          <input
            type="checkbox"
            checked={ec.invert}
            onChange={(e) => patchEncoder({ invert: e.target.checked })}
          />
          反转旋转方向
        </label>
      </div>

      {/* Dial 专属参数 */}
      {ec.rotateMode === EncoderRotateMode.Dial && (
        <div className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 text-xs sm:grid-cols-2">
          <label className="space-y-1.5">
            <div className="flex justify-between text-slate-300">
              <span>单格旋转角度</span>
              <span className="font-mono text-indigo-300">{dial.angle}°</span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              value={dial.angle}
              onChange={(e) => patchEncoder(encodeDialRotate(Number(e.target.value), dial.interp))}
              className="w-full accent-indigo-500"
            />
          </label>
          <div className="space-y-1.5">
            <span className="text-slate-300">平滑插值次数</span>
            <div className="grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => patchEncoder(encodeDialRotate(dial.angle, n))}
                  className={`rounded-lg border py-1.5 font-semibold ${
                    dial.interp === n
                      ? 'border-indigo-400 bg-indigo-600 text-white'
                      : 'border-slate-800 bg-slate-950 text-slate-300'
                  }`}
                >
                  {n}x
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 三向聚焦编辑器 */}
      <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              {
                id: 'ccw' as const,
                label: '↶ 逆时针',
                val:
                  ec.rotateMode === EncoderRotateMode.KeyOrShortcut
                    ? formatShortcutCompact(ec.ccwKey, ec.ccwFunc)
                    : ec.rotateMode === EncoderRotateMode.Dial
                      ? `Dial -${dial.angle}°`
                      : '禁用',
                disabled: ec.rotateMode !== EncoderRotateMode.KeyOrShortcut,
              },
              {
                id: 'press' as const,
                label: '● 下压按键',
                val:
                  ec.keyMode === AuxKeyMode.KeyOrShortcut
                    ? formatShortcutCompact(ec.pressKey, ec.pressFunc)
                    : ec.keyMode === AuxKeyMode.PermSwitch
                      ? `切至 L${permSlot}`
                      : ec.keyMode === AuxKeyMode.Dial
                        ? 'Dial 按压'
                        : '禁用',
                disabled:
                  ec.keyMode !== AuxKeyMode.KeyOrShortcut && ec.keyMode !== AuxKeyMode.PermSwitch,
              },
              {
                id: 'cw' as const,
                label: '↷ 顺时针',
                val:
                  ec.rotateMode === EncoderRotateMode.KeyOrShortcut
                    ? formatShortcutCompact(ec.cwKey, ec.cwFunc)
                    : ec.rotateMode === EncoderRotateMode.Dial
                      ? `Dial +${dial.angle}°`
                      : '禁用',
                disabled: ec.rotateMode !== EncoderRotateMode.KeyOrShortcut,
              },
            ]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled}
              onClick={() => setEncoderFocus(item.id)}
              className={`rounded-xl border px-3 py-2 text-center transition disabled:opacity-35 ${
                encoderFocus === item.id && !item.disabled
                  ? 'border-indigo-400 bg-indigo-600/20 text-white'
                  : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-600'
              }`}
            >
              <div className="text-[10px] text-slate-400">{item.label}</div>
              <div className="mt-0.5 truncate text-xs font-semibold">{item.val}</div>
            </button>
          ))}
        </div>

        {encoderFocus === 'ccw' && ec.rotateMode === EncoderRotateMode.KeyOrShortcut && (
          <KeyCaptureInput
            usbKey={ec.ccwKey}
            func={ec.ccwFunc}
            allowModifiers
            label="逆时针旋转 (↶) 绑定功能"
            onChange={(k, f) => patchEncoder({ ccwKey: k, ccwFunc: f })}
          />
        )}

        {encoderFocus === 'cw' && ec.rotateMode === EncoderRotateMode.KeyOrShortcut && (
          <KeyCaptureInput
            usbKey={ec.cwKey}
            func={ec.cwFunc}
            allowModifiers
            label="顺时针旋转 (↷) 绑定功能"
            onChange={(k, f) => patchEncoder({ cwKey: k, cwFunc: f })}
          />
        )}

        {encoderFocus === 'press' && ec.keyMode === AuxKeyMode.KeyOrShortcut && (
          <KeyCaptureInput
            usbKey={ec.pressKey}
            func={ec.pressFunc}
            allowModifiers
            label="旋钮下压绑定功能"
            onChange={(k, f) => patchEncoder({ pressKey: k, pressFunc: f })}
          />
        )}

        {encoderFocus === 'press' && ec.keyMode === AuxKeyMode.PermSwitch && (
          <div className="space-y-2">
            <span className="text-xs text-slate-300">按下旋钮切换至目标配置层：</span>
            <div className="grid grid-cols-8 gap-1.5">
              {Array.from({ length: SLOT_COUNT }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => patchEncoder({ pressKey: digitToUsbKey(i + 1), pressFunc: 0 })}
                  className={`rounded-lg border py-1.5 text-xs font-semibold ${
                    permSlot === i + 1
                      ? 'border-indigo-400 bg-indigo-600 text-white'
                      : 'border-slate-800 bg-slate-950 text-slate-300'
                  }`}
                >
                  L{i + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
