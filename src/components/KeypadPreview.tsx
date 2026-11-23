import { Compass, Gamepad2, RotateCw, Usb } from 'lucide-react';
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
  /** 灯效页刷色回调：如果传入，点击键帽时会触发刷色而非仅选中 */
  onPaintKey?: (keyIndex: number) => void;
  lightingLayer?: 'up' | 'down';
  useSimulatedLed?: boolean;
}

function summarizeKey(k: KeyConfig): { badge: string; text: string } {
  switch (k.mode) {
    case KeyMode.None:
      return { badge: '', text: '未绑定' };
    case KeyMode.Single:
      return { badge: '单键', text: usbKeyToLabel(k.key) };
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
      return {
        badge: isTemp ? '临时切' : '永久切',
        text: `槽位 ${target || 1}`,
      };
    }
    case KeyMode.Clicker:
      return {
        badge: k.func ? '自动连点' : '按住连点',
        text: usbKeyToLabel(k.key),
      };
    case KeyMode.Buzzer:
      return { badge: '音乐', text: '蜂鸣器' };
    case KeyMode.Morse: {
      const sub = k.func & 0x03;
      return {
        badge: '电码',
        text: sub === 0 ? '点 ·' : sub === 1 ? '划 -' : '单键 ·-',
      };
    }
    default:
      return { badge: '', text: '--' };
  }
}

function summarizeEncoder(enc: ReturnType<typeof useDevice>['keyboardConfig']['encoders'][0]): string {
  if (enc.rotateMode === EncoderRotateMode.Dial) {
    const { angle } = decodeDialRotate(enc.ccwKey, enc.cwKey, enc.ccwFunc);
    return `Dial ${angle}°`;
  }
  if (enc.rotateMode === EncoderRotateMode.KeyOrShortcut) {
    return `${formatShortcutCompact(enc.ccwKey, enc.ccwFunc)} / ${formatShortcutCompact(enc.cwKey, enc.cwFunc)}`;
  }
  if (enc.keyMode === AuxKeyMode.PermSwitch) {
    const slot = usbKeyToDigit(enc.pressKey);
    return slot ? `切至槽位 ${slot}` : '永久切换';
  }
  if (enc.keyMode === AuxKeyMode.KeyOrShortcut) {
    return formatShortcutCompact(enc.pressKey, enc.pressFunc);
  }
  return '未配置';
}

const ORIENTATION_NAMES = ['正常 (USB 朝上)', '右旋 90°', '旋转 180°', '左旋 90°'];

export function KeypadPreview({
  onPaintKey,
  lightingLayer = 'up',
  useSimulatedLed = true,
}: KeypadPreviewProps) {
  const {
    keyboardConfig,
    lightConfig,
    selection,
    setSelection,
    activeTab,
    liveInput,
    livePolling,
    globalParams,
    status,
    mockTransportRef,
  } = useDevice();

  const [tagR, tagG, tagB] = keyboardConfig.systemLed.tagColor;
  const [simTagR, simTagG, simTagB] = simulateLedRgb(tagR, tagG, tagB);

  // 摇杆实时位置归一化 (-1..1)
  const rkNormX = liveInput
    ? Math.max(
        -1,
        Math.min(
          1,
          (liveInput.rockerX - globalParams.rockerMidX) /
            Math.max(1, globalParams.rockerMaxX - globalParams.rockerMidX),
        ),
      )
    : 0;
  const rkNormY = liveInput
    ? Math.max(
        -1,
        Math.min(
          1,
          (liveInput.rockerY - globalParams.rockerMidY) /
            Math.max(1, globalParams.rockerMaxY - globalParams.rockerMidY),
        ),
      )
    : 0;

  const rockerModes: Record<RockerMode, string> = {
    [RockerMode.None]: '关闭',
    [RockerMode.FourWay]: '4向按键',
    [RockerMode.EightWay]: '8向按键',
    [RockerMode.SpeedMouse]: '速度鼠标',
    [RockerMode.CursorPos]: '光标位置',
  };

  const handleMockKeyHold = (idx: number, pressed: boolean) => {
    if (status !== 'mock' || !livePolling || !mockTransportRef.current) return;
    if (pressed) {
      mockTransportRef.current.mockLiveInput.keyMask |= 1 << idx;
    } else {
      mockTransportRef.current.mockLiveInput.keyMask &= ~(1 << idx);
    }
  };

  return (
    <div className="flex flex-col items-center">
      {/* 顶部方向提示 */}
      <div className="mb-3 flex w-full max-w-[400px] items-center justify-between text-xs text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <Compass className="h-3.5 w-3.5 text-indigo-400" />
          实体 PCB 布局预览
        </span>
        <span className="rounded-md border border-slate-800 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-300">
          方向：{ORIENTATION_NAMES[keyboardConfig.orientation] ?? '正常'}
        </span>
      </div>

      {/* 小键盘外壳容器 */}
      <div className="relative w-full max-w-[400px] rounded-[28px] border border-slate-700/80 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 p-5 shadow-2xl shadow-black/60">
        {/* 顶部居中 Type-C 接口装饰 */}
        <div className="mx-auto -mt-5 mb-3 flex w-20 items-center justify-center gap-1 rounded-b-lg border-x border-b border-slate-700 bg-slate-800/90 py-1 text-[10px] font-medium text-slate-400">
          <Usb className="h-3 w-3" />
          USB-C
        </div>

        {/* 顶部功能区：严格按 PCB.png 从左到右 -> 摇杆(RK1) | 旋钮2(EC2) | RGB指示灯(LED1) | 旋钮1(EC1) */}
        <div className="mb-5 grid grid-cols-12 items-center gap-2 rounded-2xl border border-slate-800/90 bg-slate-950/60 p-3">
          {/* 1. 摇杆 RK1 (左) */}
          <button
            type="button"
            onClick={() => setSelection({ kind: 'rocker' })}
            className={`col-span-4 flex flex-col items-center rounded-xl border p-2 transition-all ${
              selection.kind === 'rocker'
                ? 'border-indigo-500 bg-indigo-500/15 ring-2 ring-indigo-500/30'
                : 'border-slate-800 bg-slate-900/80 hover:border-slate-600'
            }`}
          >
            <div className="relative flex h-12 w-12 items-center justify-center rounded-full border-2 border-slate-700 bg-slate-950 shadow-inner">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-slate-200 shadow-md transition-transform duration-75"
                style={{
                  transform: `translate(${rkNormX * 8}px, ${rkNormY * 8}px)`,
                }}
              >
                <Gamepad2 className="h-3.5 w-3.5" />
              </div>
            </div>
            <span className="mt-1.5 text-[11px] font-semibold text-slate-200">摇杆 RK1</span>
            <span className="truncate max-w-full text-[10px] text-slate-400">
              {rockerModes[keyboardConfig.rocker.mode]}
            </span>
          </button>

          {/* 2. 旋钮 2 EC2 (中左) */}
          <button
            type="button"
            onClick={() => setSelection({ kind: 'encoder', index: 1 })}
            className={`col-span-3 flex flex-col items-center rounded-xl border p-2 transition-all ${
              selection.kind === 'encoder' && selection.index === 1
                ? 'border-indigo-500 bg-indigo-500/15 ring-2 ring-indigo-500/30'
                : 'border-slate-800 bg-slate-900/80 hover:border-slate-600'
            }`}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed border-slate-600 bg-gradient-to-b from-slate-700 to-slate-900 shadow-md">
              <RotateCw className="h-4 w-4 text-slate-300" />
            </div>
            <span className="mt-1.5 text-[11px] font-semibold text-slate-200">旋钮 2</span>
            <span className="truncate max-w-full text-[10px] text-slate-400">
              {summarizeEncoder(keyboardConfig.encoders[1])}
            </span>
          </button>

          {/* 3. 系统 RGB 指示灯 LED1 (中右) */}
          <button
            type="button"
            onClick={() => setSelection({ kind: 'led' })}
            title="点击配置系统 RGB 状态指示灯"
            className={`col-span-2 flex flex-col items-center justify-center rounded-xl border py-2.5 transition-all ${
              selection.kind === 'led'
                ? 'border-indigo-500 bg-indigo-500/15 ring-2 ring-indigo-500/30'
                : 'border-slate-800 bg-slate-900/60 hover:border-slate-600'
            }`}
          >
            <div
              className="h-5 w-5 rounded-full border border-white/30 transition-all"
              style={{
                backgroundColor: `rgb(${simTagR}, ${simTagG}, ${simTagB})`,
                boxShadow:
                  tagR + tagG + tagB > 0
                    ? `0 0 14px 2px rgba(${simTagR}, ${simTagG}, ${simTagB}, 0.75)`
                    : 'none',
              }}
            />
            <span className="mt-2 text-[10px] font-medium text-slate-300">LED1</span>
          </button>

          {/* 4. 旋钮 1 EC1 (最右) */}
          <button
            type="button"
            onClick={() => setSelection({ kind: 'encoder', index: 0 })}
            className={`col-span-3 flex flex-col items-center rounded-xl border p-2 transition-all ${
              selection.kind === 'encoder' && selection.index === 0
                ? 'border-indigo-500 bg-indigo-500/15 ring-2 ring-indigo-500/30'
                : 'border-slate-800 bg-slate-900/80 hover:border-slate-600'
            }`}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed border-slate-600 bg-gradient-to-b from-slate-700 to-slate-900 shadow-md">
              <RotateCw className="h-4 w-4 text-slate-300" />
            </div>
            <span className="mt-1.5 text-[11px] font-semibold text-slate-200">旋钮 1</span>
            <span className="truncate max-w-full text-[10px] text-slate-400">
              {summarizeEncoder(keyboardConfig.encoders[0])}
            </span>
          </button>
        </div>

        {/* 主体 4x4 机械按键矩阵 K1 ~ K16 */}
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
                  if (activeTab === 'lighting' && onPaintKey) {
                    onPaintKey(idx);
                  }
                }}
                onMouseDown={() => handleMockKeyHold(idx, true)}
                onMouseUp={() => handleMockKeyHold(idx, false)}
                onMouseLeave={() => handleMockKeyHold(idx, false)}
                className={`group relative flex aspect-square flex-col items-center justify-between rounded-xl border p-2 text-center transition-all select-none ${
                  isPressedLive ? 'keycap-shadow-pressed' : 'keycap-shadow'
                } ${
                  isSelected
                    ? 'border-indigo-400 bg-slate-800/95 ring-2 ring-indigo-500/40'
                    : isPressedLive
                      ? 'border-emerald-400 bg-emerald-500/20'
                      : 'border-slate-700/90 bg-slate-800/80 hover:border-slate-500 hover:bg-slate-800'
                }`}
                style={{
                  boxShadow:
                    hasLight && activeTab === 'lighting'
                      ? `0 0 14px -2px rgba(${dispR}, ${dispG}, ${dispB}, 0.55), inset 0 0 0 1px rgba(${dispR}, ${dispG}, ${dispB}, 0.55)`
                      : undefined,
                }}
              >
                {/* 键帽顶部编号 + RGB 灯珠 */}
                <div className="flex w-full items-center justify-between">
                  <span className="font-mono text-[10px] font-semibold text-slate-400">
                    K{idx + 1}
                  </span>
                  <span
                    className="h-2 w-2 rounded-full transition-colors"
                    style={{
                      backgroundColor: hasLight
                        ? `rgb(${dispR}, ${dispG}, ${dispB})`
                        : 'rgba(100,116,139,0.25)',
                      boxShadow: hasLight
                        ? `0 0 6px rgba(${dispR}, ${dispG}, ${dispB}, 0.9)`
                        : 'none',
                    }}
                  />
                </div>

                {/* 中间主标签 */}
                <div className="flex flex-1 items-center justify-center overflow-hidden px-0.5">
                  {activeTab === 'lighting' ? (
                    <div
                      className="h-6 w-6 rounded-md border border-white/20 shadow-inner"
                      style={{
                        backgroundColor: `rgb(${dispR}, ${dispG}, ${dispB})`,
                      }}
                    />
                  ) : (
                    <span
                      className={`truncate text-xs font-semibold leading-tight ${
                        k.mode === KeyMode.None ? 'text-slate-500' : 'text-slate-100'
                      }`}
                    >
                      {summary.text}
                    </span>
                  )}
                </div>

                {/* 底部模式徽章 */}
                <div className="h-3.5 text-[9px] font-medium text-indigo-300/80">
                  {activeTab === 'lighting'
                    ? `#${lightConfig.customOrder[idx]}`
                    : summary.badge}
                </div>
              </button>
            );
          })}
        </div>

        {/* 底部品牌丝印 */}
        <div className="mt-4 flex items-center justify-between px-1 text-[10px] font-mono text-slate-500">
          <span>ETHANE-XVI</span>
          <span>
            {activeTab === 'lighting'
              ? '点击键帽应用当前画笔/参数'
              : livePolling
                ? '实时输入监控中'
                : '点击任意部件编辑功能'}
          </span>
        </div>
      </div>
    </div>
  );
}
