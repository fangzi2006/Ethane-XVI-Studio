import {
  Check,
  Copy,
  Download,
  FolderKanban,
  Pencil,
  RotateCcw,
  Sparkles,
  Star,
  Upload,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { SCENARIO_TEMPLATES } from '../data/presets';
import { formatShortcutCompact, usbKeyToLabel } from '../services/keycodes';
import { useDevice } from '../store/useDeviceStore';
import { KeyMode, SLOT_COUNT } from '../types/config';
import { saveFileWithPicker } from '../utils/saveFile';

function getMiniKeyLabel(mode: KeyMode, key: number, func: number): string {
  if (mode === KeyMode.None) return '·';
  if (mode === KeyMode.Single) return usbKeyToLabel(key);
  if (mode === KeyMode.Shortcut) return formatShortcutCompact(key, func);
  if (mode === KeyMode.Macro) return '宏';
  if (mode === KeyMode.SwitchSlot) return `L${(func & 0x0f) || 1}`;
  if (mode === KeyMode.Clicker) return '连点';
  if (mode === KeyMode.Buzzer) return '琴';
  if (mode === KeyMode.Morse) return '电码';
  return '点';
}

export function ProfileManager() {
  const {
    slotCfgs,
    slotLights,
    slotMetas,
    dirtySlots,
    currentSlot,
    deviceActiveSlot,
    setCurrentSlot,
    setActiveTab,
    renameSlot,
    switchDeviceSlot,
    copySlotTo,
    resetSlot,
    applyTemplateToSlot,
    exportWorkspaceJson,
    importWorkspaceJson,
  } = useDevice();

  const [copySource, setCopySource] = useState<number | null>(null);
  const [templateTargetSlot, setTemplateTargetSlot] = useState<number>(currentSlot);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadBackup = async () => {
    const json = exportWorkspaceJson();
    await saveFileWithPicker(json, {
      suggestedName: 'ethane-xvi-8layers-backup.ethane.json',
      description: 'Ethane-XVI 整机 8 层备份文件',
      mimeType: 'application/json',
      extensions: ['.json'],
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* 顶部整机备份栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300">
            <FolderKanban className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">场景模板与 8 层配置管理</h2>
            <p className="text-xs text-slate-400">
              重命名配置层、一键套用行业场景预设、层间复制，以及整机 8 层全量备份导出与恢复
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => jsonInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 font-medium text-slate-200 hover:bg-slate-800"
          >
            <Download className="h-3.5 w-3.5" /> 恢复整机备份 (.json)
          </button>
          <button
            type="button"
            onClick={() => void handleDownloadBackup()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 font-semibold text-white hover:bg-indigo-500"
          >
            <Upload className="h-3.5 w-3.5" /> 导出 8 层整机备份
          </button>
          <input
            ref={jsonInputRef}
            type="file"
            accept=".json,.ethane.json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                importWorkspaceJson(await file.text());
                e.target.value = '';
              }
            }}
          />
        </div>
      </div>

      {/* 8 层全景卡片网格 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold text-slate-200">全部 8 个配置层</span>
          {copySource !== null && (
            <span className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-cyan-200">
              正在复制 L{copySource + 1}，请点击目标层的「粘贴到此层」
              <button
                type="button"
                onClick={() => setCopySource(null)}
                className="ml-2 underline"
              >
                取消
              </button>
            </span>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: SLOT_COUNT }, (_, i) => {
            const cfg = slotCfgs[i];
            const light = slotLights[i];
            const meta = slotMetas[i];
            const isEditing = currentSlot === i;
            const isActive = deviceActiveSlot === i;
            const isDirty = dirtySlots[i];

            return (
              <div
                key={i}
                className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
                  isEditing
                    ? 'border-indigo-400 bg-slate-900/90 ring-1 ring-indigo-500/30'
                    : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="rounded-md bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] font-bold text-indigo-300">
                        L{i + 1}
                      </span>
                      <span className="truncate text-sm font-semibold text-white">{meta?.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = window.prompt(`重命名 L${i + 1}：`, meta?.name ?? '');
                          if (next !== null) renameSlot(i, next);
                        }}
                        className="rounded p-0.5 text-slate-500 hover:text-slate-200"
                        title="重命名"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {cfg.priority && (
                        <span title="开机默认优先" className="inline-flex">
                          <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
                        </span>
                      )}
                      {isActive && (
                        <span
                          className="h-2 w-2 rounded-full bg-emerald-400"
                          title="硬件当前生效中"
                        />
                      )}
                      {isDirty && (
                        <span
                          className="h-2 w-2 rounded-full bg-amber-400"
                          title="有未写入设备的修改"
                        />
                      )}
                    </div>
                  </div>

                  {/* 4x4 迷你键位缩略图 */}
                  <div className="mb-3 grid grid-cols-4 gap-1 rounded-xl border border-slate-800/80 bg-slate-950/70 p-2">
                    {cfg.keys.map((k, kIdx) => {
                      const [r, g, b] = light.upColors[kIdx];
                      const hasColor = r + g + b > 0;
                      return (
                        <div
                          key={kIdx}
                          className="truncate rounded border border-slate-800 bg-slate-900 px-1 py-1 text-center text-[9px] font-medium text-slate-300"
                          style={
                            hasColor
                              ? { borderBottomColor: `rgb(${r},${g},${b})`, borderBottomWidth: 2 }
                              : undefined
                          }
                          title={`K${kIdx + 1}: ${getMiniKeyLabel(k.mode, k.key, k.func)}`}
                        >
                          {getMiniKeyLabel(k.mode, k.key, k.func)}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentSlot(i);
                      setActiveTab('keymap');
                    }}
                    className="rounded-lg bg-indigo-600/20 px-2.5 py-1 font-medium text-indigo-200 hover:bg-indigo-600/35"
                  >
                    去编辑
                  </button>

                  {copySource !== null && copySource !== i ? (
                    <button
                      type="button"
                      onClick={() => {
                        copySlotTo(copySource, i);
                        setCopySource(null);
                      }}
                      className="rounded-lg bg-cyan-600/25 px-2.5 py-1 font-semibold text-cyan-200 hover:bg-cyan-600/40"
                    >
                      粘贴到此层
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => void switchDeviceSlot(i)}
                          title="让硬件立即切换到此层"
                          className="rounded-lg border border-slate-800 bg-slate-950 p-1.5 text-emerald-400 hover:border-emerald-500/40"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setCopySource(i)}
                        title="复制此层到其他层"
                        className="rounded-lg border border-slate-800 bg-slate-950 p-1.5 text-slate-300 hover:border-slate-600"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`确认将 L${i + 1} 恢复为空白默认配置？`)) {
                            resetSlot(i);
                          }
                        }}
                        title="重置此层"
                        className="rounded-lg border border-slate-800 bg-slate-950 p-1.5 text-slate-400 hover:border-rose-500/40 hover:text-rose-300"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 内置 5 大场景模板库 */}
      <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">一键场景模板库（同时套用键位、摇杆/旋钮与配套灯效）</h3>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <span>套用到目标层：</span>
            <select
              value={templateTargetSlot}
              onChange={(e) => setTemplateTargetSlot(Number(e.target.value))}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-white"
            >
              {Array.from({ length: SLOT_COUNT }, (_, i) => (
                <option key={i} value={i}>
                  L{i + 1} · {slotMetas[i]?.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SCENARIO_TEMPLATES.map((tpl) => (
            <div
              key={tpl.id}
              className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/70 p-4"
            >
              <div>
                <div className="text-sm font-semibold text-white">{tpl.name}</div>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{tpl.desc}</p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {tpl.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md border border-slate-800 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      `将「${tpl.name}」套用到 L${templateTargetSlot + 1}？这会替换该层当前的未保存配置。`,
                    )
                  ) {
                    applyTemplateToSlot(
                      templateTargetSlot,
                      tpl.buildConfig(),
                      tpl.buildLight(),
                      tpl.name.split('（')[0],
                    );
                    setCurrentSlot(templateTargetSlot);
                  }
                }}
                className="mt-4 w-full rounded-lg border border-indigo-500/40 bg-indigo-600/15 py-1.5 text-xs font-semibold text-indigo-200 transition hover:bg-indigo-600/30"
              >
                套用到 L{templateTargetSlot + 1}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
