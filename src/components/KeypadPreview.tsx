import { Gamepad2, Paintbrush, RotateCw, Usb } from 'lucide-react';
import {
  AuxKeyMode,
  EncoderRotateMode,
  KeyConfig,
  KeyMode,
  RockerMode,
  simulateLedRgb,
} from '../types/config';
import {
  decodeDialRotate,
  formatShortcutCompact,
  usbKeyToDigit,
  usbKeyToLabel,
} from '../services/keycodes';
import { useDevice } from '../store/useDeviceStore';

interface KeypadPreviewProps {
  mode: 'keymap' | 'lighting';
  /** 灯效页仅当工具为“画笔”时才传入刷色回调，避免误涂色 */
  paintMode?: boolean;
  onPaintKey?: (keyIndex: number) => void;
  onSelectLed?: () => void;
  lightingLayer?: 'up' | 'down';
  useSimulatedLed?: boolean;
}

function summarizeKey(k: KeyConfig): { badge: string; text: string; muted?: boolean } {
  switch (k.mode) {
    case KeyMode.None:
      return { badge: '', text: '空', muted: true };
    case KeyMode.Single:
      return { badge: '', text: usbKeyToLabel(k.key) };
    case KeyMode.Shortcut:
      return { badge: '快捷', text: formatShortcutCompact(k.key, k.func) };
    case KeyMode.Macro:
      return { badge: '宏', text: k.macro.length ? `${k.macro.length} 步` : '空宏' };
    case KeyMode.CursorMove:
      return { badge: '移位', text: `${k.x},${k.y}` };
    case KeyMode.CursorClick:
      return { badge: '点击', text: `${k.x},${k.y}` };
    case KeyMode.SwitchSlot: {
      const target = k.func & 0x0f;
      const isTemp = Boolean(k.func & 0x80);
      return { badge: isTemp ? 'Fn层' : '切层', text: `L${target || 1}` };
    }
    case KeyMode.Clicker:
      return { badge: k.func ? '自动连点' : '连点', text: usbKeyToLabel(k.key) };
    case KeyMode.Buzzer:
      return { badge: '音乐', text: '蜂鸣器' };
    case KeyMode.Morse: {
      const sub = k.func & 0x03;
      return { badge: '电码', text: sub === 0 ? '点 ·' : sub === 1 ? '划 -' : '点划' };
    }
    default:
      return { badge: '', text: '--', muted: true };
  }
}

function summarizeEncoder(enc: ReturnType<typeof useDevice>['keyboardConfig']['encoders'][0]): string {
  if (enc.rotateMode === EncoderRotateMode.Dial) {
    const { angle } = decodeDialRotate(enc.ccwKey, enc.cwKey, enc.ccwFunc);
    return `Dial ${angle}°`;
  }
  if (enc.rotateMode === EncoderRotateMode.KeyOrShortcut) {
    return `${formatShortcutCompact(enc.ccwKey, enc.ccwFunc)}/${formatShortcutCompact(enc.cwKey, enc.cwFunc)}`;
  }
  if (enc.keyMode === AuxKeyMode.PermSwitch) {
    const slot = usbKeyToDigit(enc.pressKey);
    return slot ? `切 L${slot}` : '切层';
  }
  if (enc.keyMode === AuxKeyMode.KeyOrShortcut) {
    return formatShortcutCompact(enc.pressKey, enc.pressFunc);
  }
  return '未绑定';
}

const ORIENTATION_SHORT = ['0°', '90°', '180°', '270°'];

export function KeypadPreview({
  mode,
  paintMode = false,
  onPaintKey,
  onSelectLed,
  lightingLayer = 'up',
  useSimulatedLed = true,
}: KeypadPreviewProps) {
  const {
    keyboardConfig,
    setKeyboardConfig,
    lightConfig,
    selection,
    setSelection,
    setActiveTab,
    liveInput,
  } = useDevice();

  const [tagR, tagG, tagB] = keyboardConfig.systemLed.tagColor;
  const [simTagR, simTagG, simTagB] = simulateLedRgb(tagR, tagG, tagB);
  const isLighting = mode === 'lighting';

  const rockerModes: Record<RockerMode, string> = {
    [RockerMode.None]: '未绑定',
    [RockerMode.FourWay]: '4向键',
    [RockerMode.EightWay]: '8向键',
    [RockerMode.SpeedMouse]: '鼠标',
    [RockerMode.CursorPos]: '光标区',
  };

  return (
    <div className="flex flex-col items-center">
      {/* 顶部小工具条：视角旋转 / 模式提示 */}
      <div className="mb-2.5 flex w-full max-w-[390px] items-center justify-between text-xs">
        <span className="font-medium text-slate-400">
          {isLighting ? (
            paintMode ? (
              <span className="inline-flex items-center gap-1 text-fuchsia-300">
                <Paintbrush className="h-3.5 w-3.5" /> 画笔模式：点击键帽直接涂色
              </span>
            ) : (
              '点选模式：点击键帽或 LED1 编辑参数'
            )
          ) : (
            '点击小键盘上的任意部件即可编辑'
          )}
        </span>

        {!isLighting && (
          <button
            type="button"
            onClick={() =>
              setKeyboardConfig((p) => ({ ...p, orientation: (p.orientation + 1) % 4 }))
            }
            title="点击切换键盘摆放旋转方向"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 hover:border-slate-600"
          >
            <RotateCw className="h-3 w-3 text-indigo-400" />
            方向 {ORIENTATION_SHORT[keyboardConfig.orientation] ?? '0°'}
          </button>
        )}
      </div>

      {/* 小键盘实体外壳 */}
      <div className="relative w-full max-w-[390px] rounded-[28px] border border-slate-700/80 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 p-4 shadow-2xl shadow-black/60">
        {/* USB-C 装饰 */}
        <div className="mx-auto -mt-4 mb-3 flex w-16 items-center justify-center gap-1 rounded-b-lg border-x border-b border-slate-700 bg-slate-800/90 py-0.5 text-[10px] font-medium text-slate-400">
          <Usb className="h-2.5 w-2.5" />
          USB
        </div>

        {/* 顶部功能区（严格按 PCB.png：摇杆 RK1 | 旋钮 2 | LED1 | 旋钮 1） */}
        <div className="mb-4 grid grid-cols-12 items-center gap-2 rounded-2xl border border-slate-800/90 bg-slate-950/60 p-2.5">
          {/* RK1 摇杆 */}
          <button
            type="button"
            disabled={isLighting}
            onClick={() => setSelection({ kind: 'rocker' })}
            className={`col-span-4 flex flex-col items-center rounded-xl border p-2 transition-all ${
              isLighting
                ? 'cursor-default border-slate-800/40 bg-slate-900/30 opacity-35'
                : selection.kind === 'rocker'
                  ? 'border-indigo-400 bg-indigo-500/15 ring-2 ring-indigo-500/30'
                  : 'border-slate-800 bg-slate-900/80 hover:border-slate-600'
            }`}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-slate-700 bg-slate-950">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-slate-200">
                <Gamepad2 className="h-3.5 w-3.5" />
              </div>
            </div>
            <span className="mt-1 text-[11px] font-semibold text-slate-200">摇杆</span>
            <span className="max-w-full truncate text-[10px] text-slate-400">
              {rockerModes[keyboardConfig.rocker.mode]}
            </span>
          </button>

          {/* EC2 旋钮 */}
          <button
            type="button"
            disabled={isLighting}
            onClick={() => setSelection({ kind: 'encoder', index: 1 })}
            className={`col-span-3 flex flex-col items-center rounded-xl border p-2 transition-all ${
              isLighting
                ? 'cursor-default border-slate-800/40 bg-slate-900/30 opacity-35'
                : selection.kind === 'encoder' && selection.index === 1
                  ? 'border-indigo-400 bg-indigo-500/15 ring-2 ring-indigo-500/30'
                  : 'border-slate-800 bg-slate-900/80 hover:border-slate-600'
            }`}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-slate-600 bg-slate-800">
              <RotateCw className="h-3.5 w-3.5 text-slate-300" />
            </div>
            <span className="mt-1 text-[11px] font-semibold text-slate-200">旋钮 2</span>
            <span className="max-w-full truncate text-[10px] text-slate-400">
              {summarizeEncoder(keyboardConfig.encoders[1])}
            </span>
          </button>

          {/* LED1 系统 RGB 指示灯（任何时候可点，自动跳灯效页系统灯） */}
          <button
            type="button"
            onClick={() => {
              setSelection({ kind: 'led' });
              if (!isLighting) {
                setActiveTab('lighting');
              }
              onSelectLed?.();
            }}
            title="点击配置系统 RGB 指示灯 LED1"
            className={`col-span-2 flex flex-col items-center justify-center rounded-xl border py-2.5 transition-all ${
              selection.kind === 'led'
                ? 'border-fuchsia-400 bg-fuchsia-500/15 ring-2 ring-fuchsia-500/30'
                : 'border-slate-800 bg-slate-900/70 hover:border-slate-600'
            }`}
          >
            <div
              className="h-5 w-5 rounded-full border border-white/30 transition-all"
              style={{
                backgroundColor: `rgb(${simTagR}, ${simTagG}, ${simTagB})`,
                boxShadow:
                  tagR + tagG + tagB > 0
                    ? `0 0 14px 2px rgba(${simTagR}, ${simTagG}, ${simTagB}, 0.8)`
                    : 'none',
              }}
            />
            <span className="mt-1.5 text-[10px] font-medium text-slate-300">LED1</span>
          </button>

          {/* EC1 旋钮 */}
          <button
            type="button"
            disabled={isLighting}
            onClick={() => setSelection({ kind: 'encoder', index: 0 })}
            className={`col-span-3 flex flex-col items-center rounded-xl border p-2 transition-all ${
              isLighting
                ? 'cursor-default border-slate-800/40 bg-slate-900/30 opacity-35'
                : selection.kind === 'encoder' && selection.index === 0
                  ? 'border-indigo-400 bg-indigo-500/15 ring-2 ring-indigo-500/30'
                  : 'border-slate-800 bg-slate-900/80 hover:border-slate-600'
            }`}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-slate-600 bg-slate-800">
              <RotateCw className="h-3.5 w-3.5 text-slate-300" />
            </div>
            <span className="mt-1 text-[11px] font-semibold text-slate-200">旋钮 1</span>
            <span className="max-w-full truncate text-[10px] text-slate-400">
              {summarizeEncoder(keyboardConfig.encoders[0])}
            </span>
          </button>
        </div>

        {/* 主体 4x4 机械按键矩阵 K1~K16 */}
        <div className="grid grid-cols-4 gap-2.5">
          {keyboardConfig.keys.map((k, idx) => {
            const isSelected = selection.kind === 'key' && selection.index === idx;
            const isPressedLive = liveInput ? Boolean(liveInput.keyMask & (1 << idx)) : false;
            const summary = summarizeKey(k);

            const rawColor =
              lightingLayer === 'down' ? lightConfig.downColors[idx] : lightConfig.upColors[idx];
            const [dispR, dispG, dispB] = useSimulatedLed
              ? simulateLedRgb(rawColor[0], rawColor[1], rawColor[2])
              : rawColor;
            const hasLight = rawColor[0] + rawColor[1] + rawColor[2] > 0;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setSelection({ kind: 'key', index: idx });
                  if (isLighting && paintMode && onPaintKey) {
                    onPaintKey(idx);
                  }
                }}
                className={`group relative flex aspect-square flex-col items-center justify-between rounded-xl border p-2 text-center transition-all select-none ${
                  isPressedLive ? 'keycap-shadow-pressed' : 'keycap-shadow'
                } ${
                  isLighting && paintMode ? 'cursor-crosshair' : 'cursor-pointer'
                } ${
                  isSelected
                    ? 'border-indigo-400 bg-slate-800 ring-2 ring-indigo-500/40'
                    : 'border-slate-700/90 bg-slate-800/80 hover:border-slate-500'
                }`}
                style={{
                  backgroundColor:
                    isLighting && hasLight
                      ? `rgba(${dispR}, ${dispG}, ${dispB}, 0.22)`
                      : undefined,
                  boxShadow:
                    isLighting && hasLight
                      ? `0 0 16px -2px rgba(${dispR}, ${dispG}, ${dispB}, 0.6), inset 0 0 0 1px rgba(${dispR}, ${dispG}, ${dispB}, 0.5)`
                      : undefined,
                }}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-mono text-[10px] font-semibold text-slate-400">
                    K{idx + 1}
                  </span>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: hasLight
                        ? `rgb(${dispR}, ${dispG}, ${dispB})`
                        : 'rgba(100,116,139,0.25)',
                      boxShadow: hasLight ? `0 0 6px rgba(${dispR}, ${dispG}, ${dispB}, 0.9)` : 'none',
                    }}
                  />
                </div>

                <div className="flex flex-1 items-center justify-center overflow-hidden px-0.5">
                  {isLighting ? (
                    <div
                      className="h-7 w-7 rounded-lg border border-white/25 shadow-inner"
                      style={{ backgroundColor: `rgb(${dispR}, ${dispG}, ${dispB})` }}
                    />
                  ) : (
                    <span
                      className={`truncate text-xs font-semibold leading-tight ${
                        summary.muted ? 'text-slate-500' : 'text-slate-100'
                      }`}
                    >
                      {summary.text}
                    </span>
                  )}
                </div>

                <div className="h-3.5 text-[9px] font-medium text-indigo-300/80">
                  {isLighting ? `序 ${lightConfig.customOrder[idx]}` : summary.badge}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
