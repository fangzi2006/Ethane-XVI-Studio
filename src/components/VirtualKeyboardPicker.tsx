import { Keyboard, Mouse, Sparkles, Volume2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  SPECIAL_KEYS,
  domCodeToUsbKey,
  formatShortcut,
  isModifierUsbKey,
  usbKeyToLabel,
} from '../services/keycodes';

interface VirtualKeyboardPickerProps {
  usbKey: number;
  func?: number;
  allowModifiers?: boolean;
  allowModifierAsMainKey?: boolean;
  label?: string;
  onChange: (usbKey: number, func: number) => void;
}

type PickerTab = 'main' | 'fn' | 'numpad' | 'mouse' | 'combos';

interface KeyCapDef {
  code: number;
  label: string;
  w?: string;
}

const MAIN_ROWS: KeyCapDef[][] = [
  [
    { code: 41, label: 'Esc' },
    { code: 53, label: '`' },
    { code: 30, label: '1' },
    { code: 31, label: '2' },
    { code: 32, label: '3' },
    { code: 33, label: '4' },
    { code: 34, label: '5' },
    { code: 35, label: '6' },
    { code: 36, label: '7' },
    { code: 37, label: '8' },
    { code: 38, label: '9' },
    { code: 39, label: '0' },
    { code: 45, label: '-' },
    { code: 46, label: '=' },
    { code: 42, label: 'Back', w: 'col-span-2' },
  ],
  [
    { code: 43, label: 'Tab' },
    { code: 20, label: 'Q' },
    { code: 26, label: 'W' },
    { code: 8, label: 'E' },
    { code: 21, label: 'R' },
    { code: 23, label: 'T' },
    { code: 28, label: 'Y' },
    { code: 24, label: 'U' },
    { code: 12, label: 'I' },
    { code: 18, label: 'O' },
    { code: 19, label: 'P' },
    { code: 47, label: '[' },
    { code: 48, label: ']' },
    { code: 49, label: '\\' },
  ],
  [
    { code: 57, label: 'Caps' },
    { code: 4, label: 'A' },
    { code: 22, label: 'S' },
    { code: 7, label: 'D' },
    { code: 9, label: 'F' },
    { code: 10, label: 'G' },
    { code: 11, label: 'H' },
    { code: 13, label: 'J' },
    { code: 14, label: 'K' },
    { code: 15, label: 'L' },
    { code: 51, label: ';' },
    { code: 52, label: "'" },
    { code: 40, label: 'Enter', w: 'col-span-2' },
  ],
  [
    { code: 29, label: 'Z' },
    { code: 27, label: 'X' },
    { code: 6, label: 'C' },
    { code: 25, label: 'V' },
    { code: 5, label: 'B' },
    { code: 17, label: 'N' },
    { code: 16, label: 'M' },
    { code: 54, label: ',' },
    { code: 55, label: '.' },
    { code: 56, label: '/' },
    { code: 44, label: 'Space', w: 'col-span-2' },
    { code: 82, label: '↑' },
    { code: 80, label: '←' },
    { code: 81, label: '↓' },
    { code: 79, label: '→' },
  ],
];

const FN_KEYS: KeyCapDef[] = [
  { code: 58, label: 'F1' },
  { code: 59, label: 'F2' },
  { code: 60, label: 'F3' },
  { code: 61, label: 'F4' },
  { code: 62, label: 'F5' },
  { code: 63, label: 'F6' },
  { code: 64, label: 'F7' },
  { code: 65, label: 'F8' },
  { code: 66, label: 'F9' },
  { code: 67, label: 'F10' },
  { code: 68, label: 'F11' },
  { code: 69, label: 'F12' },
  { code: 70, label: 'PrtSc' },
  { code: 71, label: 'ScrLk' },
  { code: 72, label: 'Pause' },
  { code: 73, label: 'Ins' },
  { code: 74, label: 'Home' },
  { code: 75, label: 'PgUp' },
  { code: 76, label: 'Del' },
  { code: 77, label: 'End' },
  { code: 78, label: 'PgDn' },
  { code: 101, label: 'Menu' },
];

const NUMPAD_KEYS: KeyCapDef[] = [
  { code: 83, label: 'NumLk' },
  { code: 84, label: '/' },
  { code: 85, label: '*' },
  { code: 86, label: '-' },
  { code: 95, label: '7' },
  { code: 96, label: '8' },
  { code: 97, label: '9' },
  { code: 87, label: '+' },
  { code: 92, label: '4' },
  { code: 93, label: '5' },
  { code: 94, label: '6' },
  { code: 103, label: '=' },
  { code: 89, label: '1' },
  { code: 90, label: '2' },
  { code: 91, label: '3' },
  { code: 88, label: 'Enter' },
  { code: 98, label: '0', w: 'col-span-2' },
  { code: 99, label: '.' },
];

const COMMON_COMBOS: { label: string; key: number; func: number }[] = [
  { label: '复制 Ctrl+C', key: 6, func: 0x01 },
  { label: '粘贴 Ctrl+V', key: 25, func: 0x01 },
  { label: '剪切 Ctrl+X', key: 27, func: 0x01 },
  { label: '全选 Ctrl+A', key: 4, func: 0x01 },
  { label: '撤销 Ctrl+Z', key: 29, func: 0x01 },
  { label: '重做 Ctrl+Y', key: 28, func: 0x01 },
  { label: '保存 Ctrl+S', key: 22, func: 0x01 },
  { label: '查找 Ctrl+F', key: 9, func: 0x01 },
  { label: '切窗 Alt+Tab', key: 43, func: 0x04 },
  { label: '桌面 Win+D', key: 7, func: 0x08 },
  { label: '截图 Win+S+S', key: 22, func: 0x0a },
  { label: '关闭 Alt+F4', key: 61, func: 0x04 },
];

export function VirtualKeyboardPicker({
  usbKey,
  func = 0,
  allowModifiers = false,
  allowModifierAsMainKey = false,
  label = '绑定按键',
  onChange,
}: VirtualKeyboardPickerProps) {
  const [recording, setRecording] = useState(false);
  const [tab, setTab] = useState<PickerTab>('main');

  useEffect(() => {
    if (!recording) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const code = domCodeToUsbKey(e.code);
      if (!code) return;

      if (isModifierUsbKey(code)) {
        if (allowModifierAsMainKey && !allowModifiers) {
          onChange(code, 0);
          setRecording(false);
        } else if (allowModifiers) {
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
        {(usbKey !== 0 || func !== 0) && (
          <button
            type="button"
            onClick={() => onChange(0, 0)}
            className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-300"
          >
            <X className="h-3 w-3" /> 置空清除
          </button>
        )}
      </div>

      {/* 顶部：录制器 + 修饰键胶囊 */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => setRecording((r) => !r)}
          className={`flex flex-1 items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-all ${
            recording
              ? 'border-indigo-400 bg-indigo-500/20 text-indigo-100 ring-2 ring-indigo-500/40'
              : 'border-slate-700 bg-slate-950 text-white hover:border-slate-500'
          }`}
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Keyboard className="h-4 w-4 text-indigo-400" />
            {recording ? '请直接敲击键盘...' : displayText}
          </span>
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
            {recording ? '取消' : '键盘录制'}
          </span>
        </button>

        {allowModifiers && (
          <div className="flex items-center gap-1.5">
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
                  className={`rounded-lg border px-2.5 py-2 text-xs font-semibold transition ${
                    active
                      ? 'border-indigo-400 bg-indigo-600 text-white'
                      : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 底部：可视化全尺寸点选键盘（免去系统拦截快捷键的烦恼） */}
      <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-2.5">
        <div className="mb-2.5 flex flex-wrap items-center gap-1 border-b border-slate-800 pb-2 text-[11px]">
          {(
            [
              { id: 'main', label: '主键盘' },
              { id: 'fn', label: 'F区与编辑' },
              { id: 'numpad', label: '数字小键盘' },
              { id: 'mouse', label: '鼠标与媒体' },
              ...(allowModifiers ? [{ id: 'combos' as const, label: '效率组合' }] : []),
            ] as { id: PickerTab; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-2.5 py-1 font-medium transition ${
                tab === t.id
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'main' && (
          <div className="space-y-1.5">
            {MAIN_ROWS.map((row, rIdx) => (
              <div key={rIdx} className="grid grid-cols-16 gap-1">
                {row.map((cap) => {
                  const selected = usbKey === cap.code;
                  return (
                    <button
                      key={cap.code}
                      type="button"
                      onClick={() => onChange(cap.code, allowModifiers ? func : 0)}
                      className={`${cap.w ?? 'col-span-1'} rounded border py-1.5 text-[10px] font-medium transition ${
                        selected
                          ? 'border-indigo-400 bg-indigo-600/30 text-white'
                          : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600 hover:text-white'
                      }`}
                    >
                      {cap.label}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {tab === 'fn' && (
          <div className="space-y-2">
            <div className="grid grid-cols-6 gap-1 sm:grid-cols-11">
              {FN_KEYS.map((cap) => (
                <button
                  key={cap.code}
                  type="button"
                  onClick={() => onChange(cap.code, allowModifiers ? func : 0)}
                  className={`rounded border py-1.5 text-[10px] font-medium transition ${
                    usbKey === cap.code
                      ? 'border-indigo-400 bg-indigo-600/30 text-white'
                      : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {cap.label}
                </button>
              ))}
            </div>
            {allowModifierAsMainKey && (
              <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-800 pt-2">
                <span className="text-[10px] text-slate-500">独立修饰键：</span>
                {SPECIAL_KEYS.filter((k) => k.group === 'modifier').map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => onChange(item.code, 0)}
                    className={`rounded border px-2.5 py-1 text-[10px] font-medium ${
                      usbKey === item.code && func === 0
                        ? 'border-indigo-400 bg-indigo-600/30 text-white'
                        : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    {item.short}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'numpad' && (
          <div className="mx-auto grid max-w-xs grid-cols-4 gap-1.5">
            {NUMPAD_KEYS.map((cap) => (
              <button
                key={cap.code}
                type="button"
                onClick={() => onChange(cap.code, allowModifiers ? func : 0)}
                className={`${cap.w ?? ''} rounded border py-2 text-[11px] font-medium transition ${
                  usbKey === cap.code
                    ? 'border-indigo-400 bg-indigo-600/30 text-white'
                    : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600'
                }`}
              >
                {cap.label}
              </button>
            ))}
          </div>
        )}

        {tab === 'mouse' && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 inline-flex items-center gap-1 text-[11px] text-slate-500">
                <Mouse className="h-3 w-3" /> 鼠标
              </span>
              {SPECIAL_KEYS.filter((k) => k.group === 'mouse').map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => onChange(item.code, allowModifiers ? func : 0)}
                  className={`rounded-md border px-2.5 py-1.5 text-[11px] transition ${
                    usbKey === item.code
                      ? 'border-indigo-400 bg-indigo-500/20 text-indigo-200'
                      : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {item.label}
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
                  className={`rounded-md border px-2.5 py-1.5 text-[11px] transition ${
                    usbKey === item.code
                      ? 'border-indigo-400 bg-indigo-500/20 text-indigo-200'
                      : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === 'combos' && allowModifiers && (
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {COMMON_COMBOS.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => onChange(c.key, c.func)}
                className={`inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] transition ${
                  usbKey === c.key && func === c.func
                    ? 'border-indigo-400 bg-indigo-600/25 text-white'
                    : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600'
                }`}
              >
                <Sparkles className="h-2.5 w-2.5 text-indigo-400" />
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
