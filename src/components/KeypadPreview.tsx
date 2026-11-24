import {
  ClipboardCopy,
  ClipboardPaste,
  Eraser,
  Gamepad2,
  Paintbrush,
  Play,
  RotateCw,
  Square,
  Usb,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  AuxKeyMode,
  EncoderRotateMode,
  IndicatorSource,
  KeyConfig,
  KeyMode,
  RgbTuple,
  RockerMode,
  createDefaultKeyConfig,
  hsvToRgb,
  rgbToHsv,
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
  paintMode?: boolean;
  onPaintKey?: (keyIndex: number) => void;
  lightingLayer?: 'up' | 'down';
  selectedKeys?: Set<number>;
  onToggleKeySelect?: (keyIndex: number, multi: boolean) => void;
  draftKeyPreview?: { index: number; config: KeyConfig } | null;
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

const ORIENTATION_SHORT = ['0° USB朝上', '90° USB朝右', '180° USB朝下', '270° USB朝左'];

const SNAKE_ORDER = [0, 1, 2, 3, 7, 6, 5, 4, 8, 9, 10, 11, 15, 14, 13, 12];
const VORTEX_ORDER = [0, 1, 2, 3, 7, 11, 15, 14, 13, 12, 8, 4, 5, 6, 10, 9];

/** 纯前端计算灯效动态预览帧（仅在开启“动态预览”时计算，不修改实际配置） */
function computePreviewColor(
  idx: number,
  tickMs: number,
  light: ReturnType<typeof useDevice>['lightConfig'],
  baseLayer: 'up' | 'down',
): RgbTuple {
  const base = baseLayer === 'down' ? light.downColors[idx] : light.upColors[idx];
  let [r, g, b] = base;

  // 色环流转
  if (
    light.colorShiftPeriod > 0 &&
    (light.colorShiftTarget === 3 ||
      (baseLayer === 'up' && light.colorShiftTarget === 1) ||
      (baseLayer === 'down' && light.colorShiftTarget === 2))
  ) {
    const [h, s, v] = rgbToHsv(r, g, b);
    const deltaH = ((tickMs / (light.colorShiftPeriod * 1000)) * 360) % 360;
    [r, g, b] = hsvToRgb((h + deltaH) % 360, s, v);
  }

  const row = Math.floor(idx / 4);
  const col = idx % 4;
  const wave = light.waveMode;
  const actionMs = Math.max(120, light.actionTimeMs || 1800);
  let factor = 1;

  if (wave === 0) {
    if (light.actionTimeMs > 0) {
      factor = 0.25 + 0.75 * (0.5 - 0.5 * Math.cos((tickMs / actionMs) * Math.PI * 2));
    }
  } else {
    const dir = light.direction;
    let rank = idx;
    if (wave === 1 || wave === 2) {
      if (dir === 0) rank = row;
      else if (dir === 1) rank = row + col;
      else if (dir === 2) rank = col;
      else if (dir === 3) rank = 3 - row + col;
      else if (dir === 4) rank = 3 - row;
      else if (dir === 5) rank = 6 - (row + col);
      else if (dir === 6) rank = 3 - col;
      else rank = row + (3 - col);
      const maxRank = dir % 2 === 1 ? 6 : 3;
      const phase = ((tickMs / Math.max(180, light.actionTimeMs || 300)) - rank * 0.45) % (maxRank + 2.5);
      const dist = Math.abs(((phase + maxRank + 2.5) % (maxRank + 2.5)) - 1.2);
      factor = Math.max(0.18, 1 - dist * 0.48);
    } else if (wave === 3) {
      rank = SNAKE_ORDER.indexOf(idx);
      const head = (tickMs / Math.max(100, light.actionTimeMs || 180)) % 16;
      const dist = Math.min(Math.abs(head - rank), 16 - Math.abs(head - rank));
      factor = Math.max(0.15, 1 - dist * 0.24);
    } else if (wave === 4) {
      rank = VORTEX_ORDER.indexOf(idx);
      const head = (tickMs / Math.max(100, light.actionTimeMs || 180)) % 16;
      const dist = Math.min(Math.abs(head - rank), 16 - Math.abs(head - rank));
      factor = Math.max(0.15, 1 - dist * 0.24);
    } else if (wave === 5) {
      rank = light.customOrder[idx];
      const head = (tickMs / Math.max(140, light.actionTimeMs || 220)) % 16;
      const dist = Math.min(Math.abs(head - rank), 16 - Math.abs(head - rank));
      factor = Math.max(0.18, 1 - dist * 0.25);
    } else {
      factor = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(tickMs / 350 + idx * 0.4));
    }
  }

  return [Math.round(r * factor), Math.round(g * factor), Math.round(b * factor)];
}

export function KeypadPreview({
  mode,
  paintMode = false,
  onPaintKey,
  lightingLayer = 'up',
  selectedKeys,
  onToggleKeySelect,
  draftKeyPreview,
}: KeypadPreviewProps) {
  const {
    keyboardConfig,
    setKeyboardConfig,
    lightConfig,
    selection,
    setSelection,
    setActiveTab,
    liveInput,
    swapKeysInCurrentSlot,
    pushToast,
  } = useDevice();

  const [copiedKey, setCopiedKey] = useState<KeyConfig | null>(null);
  const [dragFromIdx, setDragFromIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [animating, setAnimating] = useState(false);
  const [tickMs, setTickMs] = useState(0);

  const isLighting = mode === 'lighting';
  const orientation = keyboardConfig.orientation; // 0=上, 1=右, 2=下, 3=左

  useEffect(() => {
    if (!isLighting || !animating) return;
    const start = performance.now();
    const timer = setInterval(() => {
      setTickMs(performance.now() - start);
    }, 50);
    return () => clearInterval(timer);
  }, [isLighting, animating]);

  // LED1 显示状态指示灯三通道混合亮度（仅计入已绑定功能的通道）
  const sysLed = keyboardConfig.systemLed;
  const indR = sysLed.channelR.source !== IndicatorSource.None ? sysLed.indicatorBrightness[0] : 0;
  const indG = sysLed.channelG.source !== IndicatorSource.None ? sysLed.indicatorBrightness[1] : 0;
  const indB = sysLed.channelB.source !== IndicatorSource.None ? sysLed.indicatorBrightness[2] : 0;
  const hasIndLight = indR + indG + indB > 0;
  const [glowIndR, glowIndG, glowIndB] = simulateLedRgb(indR, indG, indB);

  const rockerModes: Record<RockerMode, string> = {
    [RockerMode.None]: '未绑定',
    [RockerMode.FourWay]: '4向键',
    [RockerMode.EightWay]: '8向键',
    [RockerMode.SpeedMouse]: '鼠标',
    [RockerMode.CursorPos]: '光标区',
  };

  // auxMask: bit 0 = EC1, bit 1 = EC2, bit 2 = RK1
  const ec1Pressed = liveInput ? Boolean(liveInput.auxMask & 0x01) : false;
  const ec2Pressed = liveInput ? Boolean(liveInput.auxMask & 0x02) : false;
  const rkPressed = liveInput ? Boolean(liveInput.auxMask & 0x04) : false;

  const isVerticalBar = orientation === 1 || orientation === 3;

  const rockerBtn = (
    <button
      key="rk1"
      type="button"
      disabled={isLighting}
      onClick={() => setSelection({ kind: 'rocker' })}
      className={`flex flex-col items-center justify-center rounded-xl border p-1.5 transition-all ${
        isVerticalBar ? 'w-full py-2' : 'col-span-4'
      } ${
        isLighting
          ? 'cursor-default border-slate-800/40 bg-slate-900/30 opacity-35'
          : selection.kind === 'rocker'
            ? 'border-indigo-400 bg-indigo-500/15 ring-2 ring-indigo-500/30'
            : rkPressed
              ? 'border-emerald-400 bg-emerald-500/20'
              : 'border-slate-800 bg-slate-900/80 hover:border-slate-600'
      }`}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-slate-700 bg-slate-950">
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-slate-200">
          <Gamepad2 className="h-3 w-3" />
        </div>
      </div>
      <span className="mt-1 text-[10px] font-semibold text-slate-200">摇杆</span>
      <span className="max-w-full truncate text-[9px] text-slate-400">
        {rockerModes[keyboardConfig.rocker.mode]}
      </span>
    </button>
  );

  const ec2Btn = (
    <button
      key="ec2"
      type="button"
      disabled={isLighting}
      onClick={() => setSelection({ kind: 'encoder', index: 1 })}
      className={`flex flex-col items-center justify-center rounded-xl border p-1.5 transition-all ${
        isVerticalBar ? 'w-full py-2' : 'col-span-3'
      } ${
        isLighting
          ? 'cursor-default border-slate-800/40 bg-slate-900/30 opacity-35'
          : selection.kind === 'encoder' && selection.index === 1
            ? 'border-indigo-400 bg-indigo-500/15 ring-2 ring-indigo-500/30'
            : ec2Pressed
              ? 'border-emerald-400 bg-emerald-500/20'
              : 'border-slate-800 bg-slate-900/80 hover:border-slate-600'
      }`}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-dashed border-slate-600 bg-slate-800">
        <RotateCw className="h-3.5 w-3.5 text-slate-300" />
      </div>
      <span className="mt-1 text-[10px] font-semibold text-slate-200">旋钮 2</span>
      <span className="max-w-full truncate text-[9px] text-slate-400">
        {summarizeEncoder(keyboardConfig.encoders[1])}
      </span>
    </button>
  );

  const ledBtn = (
    <button
      key="led1"
      type="button"
      onClick={() => {
        setSelection({ kind: 'led' });
        if (!isLighting) setActiveTab('lighting');
      }}
      title={`状态指示灯三通道混合亮度 RGB(${indR}, ${indG}, ${indB})`}
      className={`flex flex-col items-center justify-center rounded-xl border py-2 transition-all ${
        isVerticalBar ? 'w-full' : 'col-span-2'
      } ${
        selection.kind === 'led'
          ? 'border-fuchsia-400 bg-fuchsia-500/15 ring-2 ring-fuchsia-500/30'
          : 'border-slate-800 bg-slate-900/70 hover:border-slate-600'
      }`}
      style={{
        backgroundColor: hasIndLight ? `rgba(${glowIndR}, ${glowIndG}, ${glowIndB}, 0.10)` : undefined,
      }}
    >
      <div
        className="h-4 w-4 rounded-full border border-white/30"
        style={{
          backgroundColor: `rgb(${indR}, ${indG}, ${indB})`,
          boxShadow: hasIndLight
            ? `0 0 10px 1px rgba(${glowIndR}, ${glowIndG}, ${glowIndB}, 0.65)`
            : 'none',
        }}
      />
      <span className="mt-1 text-[9px] font-medium text-slate-300">LED1</span>
    </button>
  );

  const ec1Btn = (
    <button
      key="ec1"
      type="button"
      disabled={isLighting}
      onClick={() => setSelection({ kind: 'encoder', index: 0 })}
      className={`flex flex-col items-center justify-center rounded-xl border p-1.5 transition-all ${
        isVerticalBar ? 'w-full py-2' : 'col-span-3'
      } ${
        isLighting
          ? 'cursor-default border-slate-800/40 bg-slate-900/30 opacity-35'
          : selection.kind === 'encoder' && selection.index === 0
            ? 'border-indigo-400 bg-indigo-500/15 ring-2 ring-indigo-500/30'
            : ec1Pressed
              ? 'border-emerald-400 bg-emerald-500/20'
              : 'border-slate-800 bg-slate-900/80 hover:border-slate-600'
      }`}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-dashed border-slate-600 bg-slate-800">
        <RotateCw className="h-3.5 w-3.5 text-slate-300" />
      </div>
      <span className="mt-1 text-[10px] font-semibold text-slate-200">旋钮 1</span>
      <span className="max-w-full truncate text-[9px] text-slate-400">
        {summarizeEncoder(keyboardConfig.encoders[0])}
      </span>
    </button>
  );

  // 根据旋转方向确定顶部/侧边功能条的物理顺序（与实体旋转 100% 一致）
  const orderedAuxItems =
    orientation === 2 || orientation === 3
      ? [ec1Btn, ledBtn, ec2Btn, rockerBtn]
      : [rockerBtn, ec2Btn, ledBtn, ec1Btn];

  const auxBarElement = (
    <div
      className={
        isVerticalBar
          ? 'flex w-[78px] shrink-0 flex-col justify-between gap-1.5 rounded-2xl border border-slate-800/90 bg-slate-950/60 p-1.5'
          : 'grid grid-cols-12 items-center gap-1.5 rounded-2xl border border-slate-800/90 bg-slate-950/60 p-2'
      }
    >
      {orderedAuxItems}
    </div>
  );

  const keyMatrixElement = (
    <div className="grid flex-1 grid-cols-4 gap-2">
      {keyboardConfig.keys.map((k, idx) => {
        const isSelected = selection.kind === 'key' && selection.index === idx;
        const isMultiSelected = isLighting && selectedKeys?.has(idx);
        const isPressedLive = liveInput ? Boolean(liveInput.keyMask & (1 << idx)) : false;

        // 若存在未确认的草稿预览，则在对应键帽上叠加预览
        const hasDraft = !isLighting && draftKeyPreview && draftKeyPreview.index === idx;
        const displayKey = hasDraft ? draftKeyPreview.config : k;
        const summary = summarizeKey(displayKey);

        const [rawR, rawG, rawB] =
          lightingLayer === 'down' ? lightConfig.downColors[idx] : lightConfig.upColors[idx];
        const [animR, animG, animB] =
          isLighting && animating
            ? computePreviewColor(idx, tickMs, lightConfig, lightingLayer)
            : [rawR, rawG, rawB];
        const [glowR, glowG, glowB] = simulateLedRgb(animR, animG, animB);
        const hasLight = animR + animG + animB > 0;

        return (
          <button
            key={idx}
            type="button"
            draggable={!isLighting}
            onDragStart={() => setDragFromIdx(idx)}
            onDragOver={(e) => {
              if (!isLighting && dragFromIdx !== null && dragFromIdx !== idx) {
                e.preventDefault();
                setDragOverIdx(idx);
              }
            }}
            onDragLeave={() => {
              if (dragOverIdx === idx) setDragOverIdx(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (!isLighting && dragFromIdx !== null && dragFromIdx !== idx) {
                swapKeysInCurrentSlot(dragFromIdx, idx);
                setSelection({ kind: 'key', index: idx });
              }
              setDragFromIdx(null);
              setDragOverIdx(null);
            }}
            onDragEnd={() => {
              setDragFromIdx(null);
              setDragOverIdx(null);
            }}
            onClick={(e) => {
              if (isLighting && onToggleKeySelect && (e.ctrlKey || e.metaKey || e.shiftKey)) {
                onToggleKeySelect(idx, true);
              } else {
                setSelection({ kind: 'key', index: idx });
                onToggleKeySelect?.(idx, false);
              }
              if (isLighting && paintMode && onPaintKey) {
                onPaintKey(idx);
              }
            }}
            className={`group relative flex aspect-square flex-col items-center justify-between rounded-xl border p-1.5 text-center transition-all select-none ${
              isPressedLive ? 'keycap-shadow-pressed' : 'keycap-shadow'
            } ${
              isLighting && paintMode ? 'cursor-crosshair' : 'cursor-pointer'
            } ${
              dragOverIdx === idx
                ? 'border-cyan-400 bg-cyan-500/20 ring-2 ring-cyan-400/50'
                : isSelected || isMultiSelected
                  ? 'border-indigo-400 bg-slate-800 ring-2 ring-indigo-500/45'
                  : 'border-slate-700/90 bg-slate-800/80 hover:border-slate-500'
            }`}
            style={
              isLighting && hasLight
                ? {
                    // 极浅的发光背景，能看清已配色又不喧宾夺主
                    backgroundColor: `rgba(${glowR}, ${glowG}, ${glowB}, 0.11)`,
                    borderColor:
                      isSelected || isMultiSelected
                        ? undefined
                        : `rgba(${glowR}, ${glowG}, ${glowB}, 0.36)`,
                  }
                : undefined
            }
          >
            <div className="flex w-full items-center justify-between">
              <span className="font-mono text-[10px] font-semibold text-slate-400">
                K{idx + 1}
              </span>
              {hasDraft && (
                <span
                  className="rounded bg-amber-500/20 px-1 text-[8px] font-medium text-amber-300"
                  title="草稿预览，点击确认后生效"
                >
                  预览
                </span>
              )}
            </div>

            <div className="flex flex-1 items-center justify-center overflow-hidden px-0.5">
              {isLighting ? (
                <div
                  className="h-6 w-6 rounded-md border border-white/30 shadow-inner transition-colors duration-75"
                  style={{ backgroundColor: `rgb(${animR}, ${animG}, ${animB})` }}
                  title={`真实 RGB(${rawR}, ${rawG}, ${rawB})`}
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

            <div className="h-3 text-[9px] font-medium text-indigo-300/80">
              {isLighting ? (hasLight ? '' : '熄灭') : summary.badge}
            </div>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col items-center">
      {/* 顶部小工具条 */}
      <div className="mb-2.5 flex w-full max-w-[430px] items-center justify-between text-xs">
        <span className="font-medium text-slate-400">
          {isLighting ? (
            paintMode ? (
              <span className="inline-flex items-center gap-1 text-fuchsia-300">
                <Paintbrush className="h-3.5 w-3.5" /> 画笔模式：点击键帽涂色
              </span>
            ) : (
              '点选键帽改背光（Ctrl+点击多选），点 LED1 改状态灯'
            )
          ) : (
            '点击编辑部件 · 拖拽键帽可互换位置'
          )}
        </span>

        {isLighting ? (
          <button
            type="button"
            onClick={() => setAnimating((a) => !a)}
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
              animating
                ? 'border-fuchsia-400 bg-fuchsia-600/20 text-fuchsia-200'
                : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600'
            }`}
          >
            {animating ? <Square className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3" />}
            {animating ? '停止动画' : '动态预览'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              setKeyboardConfig((p) => ({ ...p, orientation: (p.orientation + 1) % 4 }))
            }
            title="点击切换键盘桌面摆放旋转方向，画布将按实物方向旋转"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 hover:border-slate-600"
          >
            <RotateCw className="h-3 w-3 text-indigo-400" />
            {ORIENTATION_SHORT[orientation] ?? '0°'}
          </button>
        )}
      </div>

      {/* 小键盘实体外壳（支持 0/90/180/270° 真实物理旋转排布） */}
      <div className="relative w-full max-w-[430px] rounded-[28px] border border-slate-700/80 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 p-4 shadow-2xl shadow-black/60">
        {/* USB-C 接口物理方向指示 */}
        <div className="mb-2.5 flex items-center justify-center">
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-700/80 bg-slate-800/80 px-2.5 py-0.5 text-[10px] font-medium text-slate-400">
            <Usb className="h-2.5 w-2.5" />
            {ORIENTATION_SHORT[orientation]}
          </span>
        </div>

        {orientation === 0 && (
          <div className="space-y-3">
            {auxBarElement}
            {keyMatrixElement}
          </div>
        )}
        {orientation === 2 && (
          <div className="space-y-3">
            {keyMatrixElement}
            {auxBarElement}
          </div>
        )}
        {orientation === 1 && (
          <div className="flex items-stretch gap-2.5">
            {keyMatrixElement}
            {auxBarElement}
          </div>
        )}
        {orientation === 3 && (
          <div className="flex items-stretch gap-2.5">
            {auxBarElement}
            {keyMatrixElement}
          </div>
        )}
      </div>

      {/* 键位工作台快捷操作条（复制/粘贴/清空键 + 旋转同步提示） */}
      {!isLighting && (
        <div className="mt-3 flex w-full max-w-[430px] flex-wrap items-center justify-between gap-2 text-[11px]">
          {selection.kind === 'key' ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const k = keyboardConfig.keys[selection.index];
                  setCopiedKey({ ...k, macro: k.macro.map((m) => ({ ...m })) });
                  pushToast('info', `已复制 K${selection.index + 1} 功能`);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-slate-300 hover:border-slate-600"
              >
                <ClipboardCopy className="h-3 w-3" /> 复制 K{selection.index + 1}
              </button>
              <button
                type="button"
                disabled={!copiedKey}
                onClick={() => {
                  if (!copiedKey) return;
                  setKeyboardConfig((prev) => {
                    const next = [...prev.keys];
                    next[selection.index] = {
                      ...copiedKey,
                      macro: copiedKey.macro.map((m) => ({ ...m })),
                    };
                    return { ...prev, keys: next };
                  });
                  pushToast('success', `已粘贴到 K${selection.index + 1}`);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-slate-300 hover:border-slate-600 disabled:opacity-40"
              >
                <ClipboardPaste className="h-3 w-3" /> 粘贴
              </button>
              <button
                type="button"
                onClick={() => {
                  setKeyboardConfig((prev) => {
                    const next = [...prev.keys];
                    next[selection.index] = createDefaultKeyConfig();
                    return { ...prev, keys: next };
                  });
                  pushToast('info', `已清空 K${selection.index + 1}`);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-slate-400 hover:border-rose-500/40 hover:text-rose-300"
              >
                <Eraser className="h-3 w-3" /> 清空
              </button>
            </div>
          ) : (
            <span className="text-slate-500">拖动任意键帽可互换位置</span>
          )}

          {orientation === 1 && !keyboardConfig.rocker.rotateR90 && (
            <button
              type="button"
              onClick={() =>
                setKeyboardConfig((p) => ({ ...p, rocker: { ...p.rocker, rotateR90: true } }))
              }
              className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200 hover:bg-amber-500/20"
            >
              同步摇杆右旋 90°
            </button>
          )}
        </div>
      )}
    </div>
  );
}
