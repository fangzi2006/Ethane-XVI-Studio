import {
  Check,
  ChevronDown,
  Gamepad2,
  Keyboard,
  Layers,
  ListTree,
  MousePointerClick,
  Repeat,
  RotateCw,
  Sparkles,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  AuxKeyMode,
  EncoderConfig,
  EncoderRotateMode,
  KEY_SECTION_MAX_BYTES,
  KeyConfig,
  KeyMode,
  RockerConfig,
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

function cloneKey(k: KeyConfig): KeyConfig {
  return { ...k, macro: k.macro.map((m) => ({ ...m })) };
}

function DraftActionBar({
  hasChanges,
  onConfirm,
  onCancel,
}: {
  hasChanges: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-2.5">
      <span className={`text-xs ${hasChanges ? 'font-medium text-amber-300' : 'text-slate-500'}`}>
        {hasChanges ? '当前有未确认的修改，点击“确认”后才会生效' : '修改选项后请点击“确认”应用到当前键位'}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!hasChanges}
          onClick={onCancel}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <X className="h-3.5 w-3.5" />
          取消
        </button>
        <button
          type="button"
          disabled={!hasChanges}
          onClick={onConfirm}
          className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-indigo-600/30 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Check className="h-3.5 w-3.5" />
          确认
        </button>
      </div>
    </div>
  );
}

export function KeyEditor() {
  const { selection, currentSlot, keyboardConfig, setKeyboardConfig, pushToast } = useDevice();
  const [rockerFocus, setRockerFocus] = useState<'up' | 'down' | 'left' | 'right' | 'center'>('up');
  const [encoderFocus, setEncoderFocus] = useState<'ccw' | 'press' | 'cw'>('ccw');
  const [showRockerAdvanced, setShowRockerAdvanced] = useState(false);

  // 本地草稿态：切换其他按键/旋钮/摇杆或配置层时自动丢弃未确认的草稿
  const activeKeyIdx = selection.kind === 'key' ? selection.index : 0;
  const activeEncIdx: 0 | 1 = selection.kind === 'encoder' ? selection.index : 0;

  const committedKey = keyboardConfig.keys[activeKeyIdx];
  const committedRocker = keyboardConfig.rocker;
  const committedEncoder = keyboardConfig.encoders[activeEncIdx];

  const [draftKey, setDraftKey] = useState<KeyConfig>(() => cloneKey(committedKey));
  const [draftRocker, setDraftRocker] = useState<RockerConfig>(() => ({ ...committedRocker }));
  const [draftEncoder, setDraftEncoder] = useState<EncoderConfig>(() => ({ ...committedEncoder }));

  // 切换选中部件、切换层或外部配置变更时自动同步草稿（放弃未确认修改）
  useEffect(() => {
    setDraftKey(cloneKey(committedKey));
  }, [activeKeyIdx, currentSlot, committedKey]);

  useEffect(() => {
    setDraftRocker({ ...committedRocker });
  }, [selection.kind, currentSlot, committedRocker]);

  useEffect(() => {
    setDraftEncoder({ ...committedEncoder });
  }, [activeEncIdx, selection.kind, currentSlot, committedEncoder]);

  // ==================== 1. 机械按键 K1~K16 ====================
  if (selection.kind === 'key' || selection.kind === 'led') {
    const idx = activeKeyIdx;
    const keyCfg = draftKey;
    const category = modeToCategory(keyCfg.mode);
    const hasChanges = JSON.stringify(draftKey) !== JSON.stringify(committedKey);

    // 实时预览应用草稿后的 16 键总字节占用
    const previewKeys = [...keyboardConfig.keys];
    previewKeys[idx] = draftKey;
    const totalKeyBytes = calculateKeySectionSize(previewKeys);

    const patchKey = (patch: Partial<KeyConfig>) => {
      setDraftKey((prev) => ({ ...prev, ...patch }));
    };

    const confirmKey = () => {
      if (totalKeyBytes > KEY_SECTION_MAX_BYTES) {
        pushToast('error', `按键总配置长度 ${totalKeyBytes}B 超过固件 468B 上限，请精简宏步骤`);
        return;
      }
      setKeyboardConfig((prev) => {
        const nextKeys = [...prev.keys];
        nextKeys[idx] = cloneKey(draftKey);
        return { ...prev, keys: nextKeys };
      });
      pushToast('success', `已更新按键 K${idx + 1} 配置`);
    };

    const cancelKey = () => {
      setDraftKey(cloneKey(committedKey));
    };

    const switchCategory = (cat: KeyCategory) => {
      if (cat === category) return;
      if (cat === 'basic') {
        patchKey({
          mode: keyCfg.key ? (keyCfg.func ? KeyMode.Shortcut : KeyMode.Single) : KeyMode.None,
        });
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
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/20 font-mono text-sm font-bold text-indigo-300">
              K{idx + 1}
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">按键 K{idx + 1}</h2>
              <p className="text-xs text-slate-400">编辑完成后请点击下方“确认”应用修改</p>
            </div>
          </div>
          <div
            className="rounded-lg border border-slate-800 bg-slate-950/70 px-2.5 py-1 text-[11px] text-slate-400"
            title="本层所有 16 颗按键共享 468 字节固件空间"
          >
            空间{' '}
            <span
              className={`font-mono font-semibold ${
                totalKeyBytes > KEY_SECTION_MAX_BYTES ? 'text-rose-400' : 'text-slate-200'
              }`}
            >
              {totalKeyBytes}/{KEY_SECTION_MAX_BYTES}B
            </span>
          </div>
        </div>

        {/* 5 大直觉分类 */}
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

        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          {category === 'basic' && (
            <div className="space-y-3">
              <KeyCaptureInput
                usbKey={keyCfg.mode === KeyMode.None ? 0 : keyCfg.key}
                func={keyCfg.mode === KeyMode.Shortcut ? keyCfg.func : 0}
                allowModifiers
                allowModifierAsMainKey
                label="按下键盘直接录制（支持单键或 Ctrl/Shift/Alt/Win 组合键）"
                onChange={handleBasicKeyChange}
              />
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
                  <div className="text-xs font-semibold">按住临时切换（Fn 风格）</div>
                  <div className="mt-0.5 text-[11px] text-slate-400">
                    按住此键时使用目标层，松手立刻切回原层
                  </div>
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
                  <div className="text-xs font-semibold">点按永久切换</div>
                  <div className="mt-0.5 text-[11px] text-slate-400">
                    按一下松开后永久停留在目标配置层
                  </div>
                </button>
              </div>

              <div>
                <span className="mb-2 block text-xs font-medium text-slate-300">切换到哪一层？</span>
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
                    label="轻点复用键（可选：单按一下此键不组合其他键时，额外触发这个单键）"
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
                label="选择要自动连点的按键（如鼠标左键或游戏技能键）"
                onChange={(k) => patchKey({ key: k })}
              />
              <div className="grid gap-4 border-t border-slate-800 pt-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-slate-300">连点方式</span>
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
                      按住时连点
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
                    <span>点击间隔</span>
                    <span className="text-indigo-300">
                      {keyCfg.delayMs === 0
                        ? '0ms（持续按住不松）'
                        : `${keyCfg.delayMs}ms（约 ${(1000 / Math.max(15, keyCfg.delayMs)).toFixed(1)} 次/秒）`}
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
                  { mode: KeyMode.CursorClick, label: '屏幕定点点击' },
                  { mode: KeyMode.CursorMove, label: '屏幕定点移动' },
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
                    按下后鼠标直接跳至屏幕坐标（按 {keyboardConfig.screenWidth}×{keyboardConfig.screenHeight} 换算）
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-1 text-xs">
                      <span className="text-slate-300">横向 X 坐标 (px)</span>
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
                      <span className="text-slate-300">纵向 Y 坐标 (px)</span>
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
                  按下此键后，16 颗按键会临时变为电子琴键发声（旋钮调音量，按下摇杆或旋钮即可退出）。演奏时请勿写入配置。
                </p>
              )}

              {keyCfg.mode === KeyMode.Morse && (
                <div className="space-y-3 border-t border-slate-800 pt-3">
                  <p className="text-[11px] text-slate-400">
                    像电报机一样通过长短按输入字母与标点：单键模式靠按住时长区分点/划，双键模式分别绑定一个“点”键和一个“划”键。
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { val: 2, label: '单键模式 (点+划)' },
                      { val: 0, label: '双键 · 点 (·)' },
                      { val: 1, label: '双键 · 划 (-)' },
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
                  <div className="grid gap-3 text-xs sm:grid-cols-3">
                    <label className="space-y-1">
                      <span className="text-slate-300">蜂鸣提示音量：{morseVol}/10</span>
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
                      <span className="text-slate-300">停顿多久输出字符：{keyCfg.morseGap * 10}ms</span>
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
                        <span className="text-slate-300">超过多久算“划”：{keyCfg.morseLong * 10}ms</span>
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

        {/* 底部确认 / 取消操作条 */}
        <DraftActionBar hasChanges={hasChanges} onConfirm={confirmKey} onCancel={cancelKey} />
      </div>
    );
  }

  // ==================== 2. 摇杆 RK1（草稿态 + 确认/取消） ====================
  if (selection.kind === 'rocker') {
    const rk = draftRocker;
    const hasChanges = JSON.stringify(draftRocker) !== JSON.stringify(committedRocker);
    const patchRocker = (patch: Partial<RockerConfig>) =>
      setDraftRocker((prev) => ({ ...prev, ...patch }));

    const confirmRocker = () => {
      setKeyboardConfig((prev) => ({ ...prev, rocker: { ...draftRocker } }));
      pushToast('success', '已更新摇杆 RK1 配置');
    };
    const cancelRocker = () => setDraftRocker({ ...committedRocker });

    const permSlot = usbKeyToDigit(rk.centerKey) ?? 1;
    const isKeyMode = rk.mode === RockerMode.FourWay || rk.mode === RockerMode.EightWay;
    const isRepeatMode = rk.nearParam > 0 || rk.farParam > 0;

    const pctUp = cursorRangeKeyToPercent(rk.upKey);
    const pctDown = cursorRangeKeyToPercent(rk.downKey);
    const pctLeft = cursorRangeKeyToPercent(rk.leftKey);
    const pctRight = cursorRangeKeyToPercent(rk.rightKey);
    const centerX = (rk.inertia / 50) * 100;
    const centerY = (rk.nearParam / 50) * 100;
    const scale = Math.max(0.15, rk.farParam / 50);

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
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300">
              <Gamepad2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">摇杆 RK1（左上角）</h2>
              <p className="text-xs text-slate-400">编辑完成后请点击下方“确认”应用修改</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() =>
                patchRocker({
                  mode: RockerMode.FourWay,
                  upKey: 82,
                  downKey: 81,
                  leftKey: 80,
                  rightKey: 79,
                  nearParam: 0,
                  farParam: 0,
                })
              }
              className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-slate-300 hover:border-cyan-400"
            >
              方向键
            </button>
            <button
              type="button"
              onClick={() =>
                patchRocker({
                  mode: RockerMode.EightWay,
                  upKey: 26,
                  downKey: 22,
                  leftKey: 4,
                  rightKey: 7,
                  nearParam: 0,
                  farParam: 0,
                })
              }
              className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-slate-300 hover:border-cyan-400"
            >
              游戏 WASD
            </button>
            <button
              type="button"
              onClick={() =>
                patchRocker({
                  mode: RockerMode.SpeedMouse,
                  deadzone: 15,
                  inertia: 10,
                  nearParam: 2,
                  farParam: 25,
                })
              }
              className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-slate-300 hover:border-cyan-400"
            >
              模拟鼠标
            </button>
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:grid-cols-2">
          <label className="space-y-1 text-xs">
            <span className="font-medium text-slate-300">推动摇杆时的用途</span>
            <select
              value={rk.mode}
              onChange={(e) => patchRocker({ mode: Number(e.target.value) as RockerMode })}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            >
              <option value={RockerMode.None}>禁用推动</option>
              <option value={RockerMode.FourWay}>十字 4 方向按键（一次只触发一个方向）</option>
              <option value={RockerMode.EightWay}>8 方向按键（斜推同时触发两键，适合游戏）</option>
              <option value={RockerMode.SpeedMouse}>模拟鼠标移动（推得越远移动越快）</option>
              <option value={RockerMode.CursorPos}>屏幕区域定位（松手回中，适合摇杆选点）</option>
            </select>
          </label>

          <label className="space-y-1 text-xs">
            <span className="font-medium text-slate-300">垂直按下摇杆时的用途</span>
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
        </div>

        {(isKeyMode || rk.keyMode !== AuxKeyMode.None) && (
          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="grid grid-cols-5 gap-2">
              {dirItems.map((item) => {
                const disabled = item.id !== 'center' && !isKeyMode;
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
                  label="摇杆下压按键"
                  onChange={(k, f) => patchRocker({ centerKey: k, centerFunc: f })}
                />
              ) : rk.keyMode === AuxKeyMode.PermSwitch ? (
                <div className="space-y-2">
                  <span className="text-xs text-slate-300">按下摇杆后切换到哪一层？</span>
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
                <p className="text-xs text-slate-500">当前下压模式无需单独绑定按键。</p>
              )
            ) : (
              isKeyMode && (
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

        {isKeyMode && (
          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-slate-200">推住摇杆时的触发行为</span>
              <div className="flex rounded-lg border border-slate-800 bg-slate-950 p-0.5">
                <button
                  type="button"
                  onClick={() => patchRocker({ nearParam: 0, farParam: 0 })}
                  className={`rounded-md px-3 py-1 font-medium ${
                    !isRepeatMode ? 'bg-indigo-600 text-white' : 'text-slate-400'
                  }`}
                >
                  普通长按（推荐）
                </button>
                <button
                  type="button"
                  onClick={() => patchRocker({ nearParam: 5, farParam: 35 })}
                  className={`rounded-md px-3 py-1 font-medium ${
                    isRepeatMode ? 'bg-indigo-600 text-white' : 'text-slate-400'
                  }`}
                >
                  推越远连点越快
                </button>
              </div>
            </div>

            {isRepeatMode && (
              <div className="grid gap-3 border-t border-slate-800 pt-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span>轻推起步连点速度</span>
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
                    <span>推到底最快连点速度</span>
                    <span className="font-mono text-indigo-300">{rk.farParam}/50</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={50}
                    value={rk.farParam}
                    onChange={(e) => patchRocker({ farParam: Number(e.target.value) })}
                    className="w-full accent-indigo-500"
                  />
                </label>
              </div>
            )}
          </div>
        )}

        {rk.mode === RockerMode.SpeedMouse && (
          <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 text-xs sm:grid-cols-3">
            <label className="space-y-1">
              <div className="flex justify-between text-slate-300">
                <span>轻推起步速度</span>
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
                <span>推满最大移速</span>
                <span className="font-mono text-indigo-300">{rk.farParam}/50</span>
              </div>
              <input
                type="range"
                min={1}
                max={50}
                value={rk.farParam}
                onChange={(e) => patchRocker({ farParam: Number(e.target.value) })}
                className="w-full accent-indigo-500"
              />
            </label>
            <label className="space-y-1">
              <div className="flex justify-between text-slate-300">
                <span>起步柔和阻尼（惯性）</span>
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
          </div>
        )}

        {rk.mode === RockerMode.CursorPos && (
          <div className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 text-xs sm:grid-cols-12">
            <div className="flex flex-col items-center justify-center sm:col-span-5">
              <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
                <div
                  className="absolute border border-cyan-400/80 bg-cyan-500/15"
                  style={{
                    left: `${Math.max(0, centerX - (pctLeft / 2) * scale)}%`,
                    top: `${Math.max(0, centerY - (pctUp / 2) * scale)}%`,
                    width: `${Math.min(100, ((pctLeft + pctRight) / 2) * scale)}%`,
                    height: `${Math.min(100, ((pctUp + pctDown) / 2) * scale)}%`,
                  }}
                />
                <div
                  className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400"
                  style={{ left: `${centerX}%`, top: `${centerY}%` }}
                />
              </div>
              <span className="mt-1.5 text-[11px] text-slate-500">蓝色框即摇杆可控制的光标范围</span>
            </div>

            <div className="space-y-2.5 sm:col-span-7">
              <div className="grid grid-cols-3 gap-2">
                <label className="space-y-1">
                  <span className="text-slate-400">中心 X ({Math.round(centerX)}%)</span>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    value={rk.inertia}
                    onChange={(e) => patchRocker({ inertia: Number(e.target.value) })}
                    className="w-full accent-cyan-400"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-400">中心 Y ({Math.round(centerY)}%)</span>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    value={rk.nearParam}
                    onChange={(e) => patchRocker({ nearParam: Number(e.target.value) })}
                    className="w-full accent-cyan-400"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-400">整体大小 ({rk.farParam}/50)</span>
                  <input
                    type="range"
                    min={1}
                    max={50}
                    value={rk.farParam}
                    onChange={(e) => patchRocker({ farParam: Number(e.target.value) })}
                    className="w-full accent-cyan-400"
                  />
                </label>
              </div>
              <div className="grid grid-cols-4 gap-2 border-t border-slate-800 pt-2">
                {(
                  [
                    ['上', 'upKey', pctUp],
                    ['下', 'downKey', pctDown],
                    ['左', 'leftKey', pctLeft],
                    ['右', 'rightKey', pctRight],
                  ] as const
                ).map(([lbl, field, pct]) => (
                  <label key={field} className="space-y-1">
                    <span className="text-slate-400">
                      {lbl} {pct}%
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
                ))}
              </div>
            </div>
          </div>
        )}

        {rk.mode !== RockerMode.None && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 text-xs">
            <button
              type="button"
              onClick={() => setShowRockerAdvanced((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-2.5 font-medium text-slate-300 hover:text-white"
            >
              <span>防误触死区（{Math.round((rk.deadzone / 200) * 100)}%）与方向轴反向设置</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showRockerAdvanced ? 'rotate-180' : ''}`}
              />
            </button>
            {showRockerAdvanced && (
              <div className="space-y-3 border-t border-slate-800 p-4">
                <label className="block space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span>中心防误触死区（范围内推动不响应，防止摇杆轻微漂移）</span>
                    <span className="font-mono text-indigo-300">
                      {Math.round((rk.deadzone / 200) * 100)}% ({rk.deadzone}/200)
                    </span>
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
                <div className="flex flex-wrap gap-4 text-slate-300">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={rk.invertX}
                      onChange={(e) => patchRocker({ invertX: e.target.checked })}
                    />
                    左右反向
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={rk.invertY}
                      onChange={(e) => patchRocker({ invertY: e.target.checked })}
                    />
                    上下反向
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={rk.rotateR90}
                      onChange={(e) => patchRocker({ rotateR90: e.target.checked })}
                    />
                    摇杆方向右旋 90°（横放键盘时用）
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        <DraftActionBar hasChanges={hasChanges} onConfirm={confirmRocker} onCancel={cancelRocker} />
      </div>
    );
  }

  // ==================== 3. 双旋钮 EC1 / EC2（草稿态 + 确认/取消） ====================
  const eIdx = activeEncIdx;
  const ec = draftEncoder;
  const hasChanges = JSON.stringify(draftEncoder) !== JSON.stringify(committedEncoder);
  const title = eIdx === 0 ? '旋钮 1（最右侧）' : '旋钮 2（顶部靠中）';

  const patchEncoder = (patch: Partial<EncoderConfig>) => {
    setDraftEncoder((prev) => ({ ...prev, ...patch }));
  };

  const confirmEncoder = () => {
    setKeyboardConfig((prev) => {
      const next: [EncoderConfig, EncoderConfig] = [{ ...prev.encoders[0] }, { ...prev.encoders[1] }];
      next[eIdx] = { ...draftEncoder };
      return { ...prev, encoders: next };
    });
    pushToast('success', `已更新${title}配置`);
  };
  const cancelEncoder = () => setDraftEncoder({ ...committedEncoder });

  const dial = decodeDialRotate(ec.ccwKey, ec.cwKey, ec.ccwFunc);
  const permSlot = usbKeyToDigit(ec.pressKey) ?? 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
            <RotateCw className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">{title}</h2>
            <p className="text-xs text-slate-400">编辑完成后请点击下方“确认”应用修改</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 text-[11px]">
          <button
            type="button"
            onClick={() =>
              patchEncoder({
                rotateMode: EncoderRotateMode.KeyOrShortcut,
                keyMode: AuxKeyMode.KeyOrShortcut,
                ccwKey: 243,
                ccwFunc: 0,
                cwKey: 242,
                cwFunc: 0,
                pressKey: 244,
                pressFunc: 0,
              })
            }
            className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-slate-300 hover:border-amber-400"
          >
            音量 + 静音
          </button>
          <button
            type="button"
            onClick={() =>
              patchEncoder({
                rotateMode: EncoderRotateMode.KeyOrShortcut,
                keyMode: AuxKeyMode.KeyOrShortcut,
                ccwKey: 241,
                ccwFunc: 0x01,
                cwKey: 240,
                cwFunc: 0x01,
                pressKey: 39,
                pressFunc: 0x01,
              })
            }
            className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-slate-300 hover:border-amber-400"
          >
            画面缩放
          </button>
          <button
            type="button"
            onClick={() =>
              patchEncoder({
                rotateMode: EncoderRotateMode.Dial,
                keyMode: AuxKeyMode.Dial,
                ...encodeDialRotate(10, 2),
              })
            }
            className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-slate-300 hover:border-amber-400"
          >
            Surface Dial
          </button>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:grid-cols-2">
        <label className="space-y-1 text-xs">
          <span className="font-medium text-slate-300">旋转时的用途</span>
          <select
            value={ec.rotateMode}
            onChange={(e) =>
              patchEncoder({ rotateMode: Number(e.target.value) as EncoderRotateMode })
            }
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
          >
            <option value={EncoderRotateMode.None}>禁用旋转</option>
            <option value={EncoderRotateMode.KeyOrShortcut}>按键 / 快捷键（每拧一格触发一次）</option>
            <option value={EncoderRotateMode.Dial}>Surface Dial 创意轮盘（系统原生滚轮）</option>
          </select>
        </label>

        <label className="space-y-1 text-xs">
          <span className="font-medium text-slate-300">按下旋钮时的用途</span>
          <select
            value={ec.keyMode}
            onChange={(e) => patchEncoder({ keyMode: Number(e.target.value) as AuxKeyMode })}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
          >
            <option value={AuxKeyMode.None}>禁用按下</option>
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
          反转顺/逆时针方向（觉得拧反了就勾上）
        </label>
      </div>

      {ec.rotateMode === EncoderRotateMode.Dial && (
        <div className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 text-xs sm:grid-cols-2">
          <label className="space-y-1.5">
            <div className="flex justify-between text-slate-300">
              <span>每拧一格转动的角度（默认 10°）</span>
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
            <span className="text-slate-300">滚动丝滑度（分几步发送，推荐 2x）</span>
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
                label: '● 按下旋钮',
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
            label="逆时针旋转 (↶) 触发的按键"
            onChange={(k, f) => patchEncoder({ ccwKey: k, ccwFunc: f })}
          />
        )}

        {encoderFocus === 'cw' && ec.rotateMode === EncoderRotateMode.KeyOrShortcut && (
          <KeyCaptureInput
            usbKey={ec.cwKey}
            func={ec.cwFunc}
            allowModifiers
            label="顺时针旋转 (↷) 触发的按键"
            onChange={(k, f) => patchEncoder({ cwKey: k, cwFunc: f })}
          />
        )}

        {encoderFocus === 'press' && ec.keyMode === AuxKeyMode.KeyOrShortcut && (
          <KeyCaptureInput
            usbKey={ec.pressKey}
            func={ec.pressFunc}
            allowModifiers
            label="按下旋钮触发的按键"
            onChange={(k, f) => patchEncoder({ pressKey: k, pressFunc: f })}
          />
        )}

        {encoderFocus === 'press' && ec.keyMode === AuxKeyMode.PermSwitch && (
          <div className="space-y-2">
            <span className="text-xs text-slate-300">按下旋钮切换到哪一层？</span>
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

      <DraftActionBar hasChanges={hasChanges} onConfirm={confirmEncoder} onCancel={cancelEncoder} />
    </div>
  );
}
