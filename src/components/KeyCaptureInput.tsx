import { Keyboard, Mouse, Volume2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  SPECIAL_KEYS,
  domCodeToUsbKey,
  formatShortcut,
  isModifierUsbKey,
  usbKeyToLabel,
} from '../services/keycodes';

interface KeyCaptureInputProps {
  usbKey: number;
  func?: number;
  allowModifiers?: boolean;
  allowModifierAsMainKey?: boolean;
  label?: string;
  onChange: (usbKey: number, func: number) => void;
}

export function KeyCaptureInput({
  usbKey,
  func = 0,
  allowModifiers = false,
  allowModifierAsMainKey = false,
  label = '绑定按键',
  onChange,
}: KeyCaptureInputProps) {
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (!recording) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const code = domCodeToUsbKey(e.code);
      if (!code) return;

      if (isModifierUsbKey(code)) {
        if (allowModifierAsMainKey) {
          onChange(code, 0);
          setRecording(false);
        } else if (allowModifiers) {
          // 自动勾选对应的修饰键
          const bit = 1 << (code - 249);
          onChange(usbKey, func | bit);
        }
        return;
      }

      let nextFunc = func;
      if (allowModifiers) {
        if (e.ctrlKey) nextFunc |= 0x01;
        if (e.shiftKey) nextFunc |= 0x02;
        if (e.altKey) nextFunc |= 0x04;
        if (e.metaKey) nextFunc |= 0x08;
      }
      onChange(code, allowModifiers ? nextFunc : 0);
      setRecording(false);
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [recording, allowModifiers, allowModifierAsMainKey, usbKey, func, onChange]);

  const toggleMod = (bit: number) => {
    onChange(usbKey, func ^ bit);
  };

  const displayText = allowModifiers ? formatShortcut(usbKey, func) : usbKeyToLabel(usbKey);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-300">{label}</span>
        {usbKey !== 0 || func !== 0 ? (
          <button
            type="button"
            onClick={() => onChange(0, 0)}
            className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-300"
          >
            <X className="h-3 w-3" />
            清除
          </button>
        ) : null}
      </div>

      {/* 录制按钮 */}
      <button
        type="button"
        onClick={() => setRecording((r) => !r)}
        className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-all ${
          recording
            ? 'border-indigo-400 bg-indigo-500/20 text-indigo-100 ring-2 ring-indigo-500/40'
            : 'border-slate-700 bg-slate-950 text-white hover:border-slate-500'
        }`}
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Keyboard className="h-4 w-4 text-indigo-400" />
          {recording ? '请直接按下键盘上的任意键...' : displayText}
        </span>
        <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
          {recording ? '取消' : '点击录制'}
        </span>
      </button>

      {/* 修饰键直观开关（替代原程序繁琐的“按键保持”机制） */}
      {allowModifiers && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">修饰键：</span>
          {[
            { label: 'Ctrl', bit: 0x01 },
            { label: 'Shift', bit: 0x02 },
            { label: 'Alt', bit: 0x04 },
            { label: 'Win', bit: 0x08 },
          ].map((m) => {
            const active = Boolean(func & m.bit);
            return (
              <button
                key={m.label}
                type="button"
                onClick={() => toggleMod(m.bit)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                  active
                    ? 'border-indigo-400 bg-indigo-600 text-white'
                    : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      )}

      {/* 快捷鼠标与媒体键面板 */}
      <div className="space-y-2 rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 inline-flex items-center gap-1 text-[11px] text-slate-500">
            <Mouse className="h-3 w-3" /> 鼠标
          </span>
          {SPECIAL_KEYS.filter((k) => k.group === 'mouse').map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => onChange(item.code, allowModifiers ? func : 0)}
              className={`rounded-md border px-2 py-1 text-[11px] transition ${
                usbKey === item.code
                  ? 'border-indigo-400 bg-indigo-500/20 text-indigo-200'
                  : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600'
              }`}
            >
              {item.short}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 inline-flex items-center gap-1 text-[11px] text-slate-500">
            <Volume2 className="h-3 w-3" /> 媒体
          </span>
          {SPECIAL_KEYS.filter((k) => k.group === 'media').map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => onChange(item.code, allowModifiers ? func : 0)}
              className={`rounded-md border px-2 py-1 text-[11px] transition ${
                usbKey === item.code
                  ? 'border-indigo-400 bg-indigo-500/20 text-indigo-200'
                  : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600'
              }`}
            >
              {item.short}
            </button>
          ))}
        </div>

        {allowModifierAsMainKey && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] text-slate-500">独立修饰键</span>
            {SPECIAL_KEYS.filter((k) => k.group === 'modifier').map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => onChange(item.code, 0)}
                className={`rounded-md border px-2 py-1 text-[11px] transition ${
                  usbKey === item.code
                    ? 'border-indigo-400 bg-indigo-500/20 text-indigo-200'
                    : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600'
                }`}
              >
                {item.short}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
