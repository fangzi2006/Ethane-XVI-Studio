import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Clock,
  Download,
  Keyboard,
  MousePointerClick,
  Repeat,
  SlidersHorizontal,
  Trash2,
  Upload,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  domCodeToUsbKey,
  formatShortcut,
  isModifierUsbKey,
  usbKeyToLabel,
} from '../services/keycodes';
import { decodeMacroFile, encodeMacroFile, getMacroByteLength } from '../services/protocol';
import { useDevice } from '../store/useDeviceStore';
import { MacroStep } from '../types/config';

interface MacroBuilderProps {
  steps: MacroStep[];
  screenWidth: number;
  screenHeight: number;
  onChange: (next: MacroStep[]) => void;
}

export function MacroBuilder({ steps, screenWidth, screenHeight, onChange }: MacroBuilderProps) {
  const { pushToast } = useDevice();
  const [recordingMode, setRecordingMode] = useState<'none' | 'key' | 'shortcut'>('none');
  const [delayVal, setDelayVal] = useState(100);
  const [posX, setPosX] = useState(Math.round(screenWidth / 2));
  const [posY, setPosY] = useState(Math.round(screenHeight / 2));
  const [loopCount, setLoopCount] = useState(0);
  const [loopAuto, setLoopAuto] = useState(false);
  const [reportEnd, setReportEnd] = useState(true);
  const [reportGap, setReportGap] = useState(false);
  const [showAdvancedBlocks, setShowAdvancedBlocks] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const byteLen = getMacroByteLength(steps);

  const appendStep = (step: MacroStep) => {
    const next = [...steps, step];
    if (getMacroByteLength(next) > 255) {
      pushToast('error', '此按键宏空间已满（上限 255 字节）');
      return;
    }
    onChange(next);
  };

  useEffect(() => {
    if (recordingMode === 'none') return;
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const code = domCodeToUsbKey(e.code);
      if (!code || isModifierUsbKey(code)) return;

      const id = `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      if (recordingMode === 'shortcut') {
        let func = 0;
        if (e.ctrlKey) func |= 0x01;
        if (e.shiftKey) func |= 0x02;
        if (e.altKey) func |= 0x04;
        if (e.metaKey) func |= 0x08;
        if (func === 0) {
          pushToast('info', '组合快捷键录制模式请同时按住 Ctrl / Shift / Alt / Win');
          return;
        }
        appendStep({ id, type: 'shortcut', key: code, func });
      } else {
        appendStep({ id, type: 'key', key: code, shift: e.shiftKey });
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  });

  const moveStep = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const removeStep = (index: number) => onChange(steps.filter((_, i) => i !== index));

  const exportEtkey = () => {
    try {
      const bytes = encodeMacroFile(steps);
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'macro.etkey';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : '导出失败');
    }
  };

  const describeStep = (s: MacroStep): { badge: string; color: string; text: string } => {
    switch (s.type) {
      case 'key':
        return {
          badge: '按键',
          color: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
          text: s.shift ? `Shift + ${usbKeyToLabel(s.key, true)}` : usbKeyToLabel(s.key),
        };
      case 'shortcut':
        return {
          badge: '快捷键',
          color: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
          text: formatShortcut(s.key, s.func),
        };
      case 'delay':
        return {
          badge: '等待',
          color: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
          text: `停顿 ${s.ms} 毫秒`,
        };
      case 'move':
        return {
          badge: '移位',
          color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
          text: `鼠标移至 (${s.x}, ${s.y})`,
        };
      case 'press':
        return {
          badge: '点击',
          color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
          text: `点击屏幕 (${s.x}, ${s.y})`,
        };
      case 'loopStart':
        return {
          badge: '循环开始',
          color: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',
          text: '从这里开始重复',
        };
      case 'loopEnd':
        return {
          badge: '循环结束',
          color: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',
          text: `${s.auto ? '松手也自动重复' : '按住期间重复'} · ${s.count === 0 ? '无限次' : `共 ${s.count} 次`}`,
        };
      case 'reportCtrl':
        return {
          badge: '报文控制',
          color: 'bg-slate-700/60 text-slate-300 border-slate-600',
          text: `${s.end ? '立即发出当前包' : '合并到下一包'} · ${s.gap ? '发完松开按键' : '保持按住不松'}`,
        };
    }
  };

  return (
    <div className="space-y-3.5">
      {/* 顶部空间统计 + 常用模板 + 文件导入导出 */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="text-slate-400">
            共 <strong className="text-white">{steps.length}</strong> 步
          </span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-400">
            占用{' '}
            <strong className={byteLen > 230 ? 'text-amber-300' : 'text-indigo-300'}>
              {byteLen}/255B
            </strong>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() =>
              onChange([
                { id: `tpl-1-${Date.now()}`, type: 'shortcut', key: 4, func: 0x01 },
                { id: `tpl-2-${Date.now()}`, type: 'delay', ms: 40 },
                { id: `tpl-3-${Date.now()}`, type: 'shortcut', key: 6, func: 0x01 },
              ])
            }
            className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 hover:border-indigo-400"
          >
            模板: 全选并复制
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-slate-300 hover:bg-slate-800"
          >
            <Upload className="h-3 w-3" /> 导入
          </button>
          <button
            type="button"
            onClick={exportEtkey}
            disabled={steps.length === 0}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
          >
            <Download className="h-3 w-3" /> 导出
          </button>
          {steps.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-rose-300 hover:bg-rose-500/20"
            >
              <Trash2 className="h-3 w-3" /> 清空
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".etkey"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const decoded = decodeMacroFile(new Uint8Array(await file.arrayBuffer()));
              onChange(decoded);
              pushToast('success', `已导入宏文件（${decoded.length} 步）`);
            } catch (err) {
              pushToast('error', err instanceof Error ? err.message : '导入 .etkey 失败');
            }
            e.target.value = '';
          }}
        />
      </div>

      {/* 常用录制按钮 */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setRecordingMode((m) => (m === 'key' ? 'none' : 'key'))}
          className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
            recordingMode === 'key'
              ? 'border-sky-400 bg-sky-500/20 text-sky-200 ring-2 ring-sky-500/30'
              : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500'
          }`}
        >
          <Keyboard className="h-4 w-4" />
          {recordingMode === 'key' ? '正在录制（点击停止）' : '连续录制普通按键'}
        </button>

        <button
          type="button"
          onClick={() => setRecordingMode((m) => (m === 'shortcut' ? 'none' : 'shortcut'))}
          className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
            recordingMode === 'shortcut'
              ? 'border-indigo-400 bg-indigo-500/20 text-indigo-200 ring-2 ring-indigo-500/30'
              : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500'
          }`}
        >
          <Keyboard className="h-4 w-4" />
          {recordingMode === 'shortcut' ? '正在录制（点击停止）' : '连续录制组合快捷键'}
        </button>
      </div>

      {/* 步骤列表 */}
      <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        {steps.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">
            按顺序排列执行动作。点击上方“录制”直接敲击键盘，或在下方插入等待与屏幕点击。
          </div>
        ) : (
          steps.map((s, idx) => {
            const info = describeStep(s);
            return (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-800/80 bg-slate-900/90 px-3 py-1.5 text-xs"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="w-5 font-mono text-[11px] text-slate-500">{idx + 1}.</span>
                  <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium ${info.color}`}>
                    {info.badge}
                  </span>
                  <span className="truncate font-medium text-slate-200">{info.text}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveStep(idx, -1)}
                    disabled={idx === 0}
                    className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveStep(idx, 1)}
                    disabled={idx === steps.length - 1}
                    className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeStep(idx)}
                    className="rounded p-1 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 常用积木：等待 + 屏幕点击 */}
      <div className="grid gap-3 text-xs sm:grid-cols-2">
        <div className="space-y-1.5 rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
          <div className="flex items-center gap-1.5 font-medium text-amber-300">
            <Clock className="h-3.5 w-3.5" /> 插入等待停顿 (毫秒)
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={65000}
              value={delayVal}
              onChange={(e) => setDelayVal(Math.max(1, Math.min(65000, Number(e.target.value))))}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-white"
            />
            <button
              type="button"
              onClick={() => appendStep({ id: `d-${Date.now()}`, type: 'delay', ms: delayVal })}
              className="shrink-0 rounded-lg bg-amber-500/20 px-3 py-1 font-medium text-amber-200 hover:bg-amber-500/30"
            >
              添加
            </button>
          </div>
        </div>

        <div className="space-y-1.5 rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
          <div className="flex items-center gap-1.5 font-medium text-emerald-300">
            <MousePointerClick className="h-3.5 w-3.5" /> 屏幕定点操作 ({screenWidth}×{screenHeight})
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              max={screenWidth - 1}
              value={posX}
              onChange={(e) => setPosX(Number(e.target.value))}
              placeholder="X"
              className="w-16 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-white"
            />
            <input
              type="number"
              min={0}
              max={screenHeight - 1}
              value={posY}
              onChange={(e) => setPosY(Number(e.target.value))}
              placeholder="Y"
              className="w-16 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-white"
            />
            <button
              type="button"
              onClick={() => appendStep({ id: `p-${Date.now()}`, type: 'press', x: posX, y: posY })}
              className="rounded-lg bg-emerald-500/20 px-2.5 py-1 font-medium text-emerald-200 hover:bg-emerald-500/30"
            >
              点击
            </button>
            <button
              type="button"
              onClick={() => appendStep({ id: `m-${Date.now()}`, type: 'move', x: posX, y: posY })}
              className="rounded-lg bg-slate-800 px-2.5 py-1 text-slate-300 hover:bg-slate-700"
            >
              移位
            </button>
          </div>
        </div>
      </div>

      {/* 折叠进阶流程控制（循环 + 报文控制，带白话说明） */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/40 text-xs">
        <button
          type="button"
          onClick={() => setShowAdvancedBlocks((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2 font-medium text-slate-400 hover:text-slate-200"
        >
          <span>进阶流程控制（循环重复 / 按住不松的报文控制）</span>
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${showAdvancedBlocks ? 'rotate-180' : ''}`}
          />
        </button>

        {showAdvancedBlocks && (
          <div className="grid gap-3 border-t border-slate-800 p-3 sm:grid-cols-2">
            <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
              <div className="flex items-center gap-1.5 font-medium text-fuchsia-300">
                <Repeat className="h-3.5 w-3.5" /> 重复执行一段步骤（成对使用，不可嵌套）
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => appendStep({ id: `ls-${Date.now()}`, type: 'loopStart' })}
                  className="rounded-lg bg-fuchsia-500/20 px-2.5 py-1 font-medium text-fuchsia-200 hover:bg-fuchsia-500/30"
                >
                  + 循环开始
                </button>
                <input
                  type="number"
                  min={0}
                  max={65534}
                  value={loopCount}
                  onChange={(e) => setLoopCount(Math.max(0, Number(e.target.value)))}
                  title="0 表示无限循环"
                  className="w-14 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-white"
                />
                <label className="flex items-center gap-1 text-[11px] text-slate-400">
                  <input
                    type="checkbox"
                    checked={loopAuto}
                    onChange={(e) => setLoopAuto(e.target.checked)}
                  />
                  松手继续
                </label>
                <button
                  type="button"
                  onClick={() =>
                    appendStep({
                      id: `le-${Date.now()}`,
                      type: 'loopEnd',
                      auto: loopAuto,
                      count: loopCount,
                    })
                  }
                  className="rounded-lg bg-fuchsia-500/20 px-2.5 py-1 font-medium text-fuchsia-200 hover:bg-fuchsia-500/30"
                >
                  + 循环结束
                </button>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
              <div className="flex items-center gap-1.5 font-medium text-slate-300">
                <SlidersHorizontal className="h-3.5 w-3.5" /> 报文控制（模拟按住不松）
              </div>
              <p className="text-[10px] text-slate-500">
                默认每段动作结束会自动松开所有键；取消“发完松开”可实现按住前一键的同时按下后一键。
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1 text-[11px] text-slate-300">
                  <input
                    type="checkbox"
                    checked={reportEnd}
                    onChange={(e) => setReportEnd(e.target.checked)}
                  />
                  立刻发送当前键
                </label>
                <label className="flex items-center gap-1 text-[11px] text-slate-300">
                  <input
                    type="checkbox"
                    checked={reportGap}
                    onChange={(e) => setReportGap(e.target.checked)}
                  />
                  发完松开按键
                </label>
                <button
                  type="button"
                  onClick={() =>
                    appendStep({
                      id: `rc-${Date.now()}`,
                      type: 'reportCtrl',
                      end: reportEnd,
                      gap: reportGap,
                    })
                  }
                  className="rounded-lg bg-slate-800 px-2.5 py-1 font-medium text-slate-200 hover:bg-slate-700"
                >
                  + 插入
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
