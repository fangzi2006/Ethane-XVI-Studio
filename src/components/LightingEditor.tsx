import {
  ChevronDown,
  Download,
  Lightbulb,
  MousePointer2,
  Paintbrush,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { exportPaletteTxt, parsePaletteTxt } from '../services/protocol';
import { useDevice } from '../store/useDeviceStore';
import { saveFileWithPicker } from '../utils/saveFile';
import {
  IndicatorSource,
  KEY_NUM,
  RgbTuple,
  hexToRgb,
  hsvToRgb,
  rgbToHex,
  rgbToHsv,
} from '../types/config';

const WAVE_MODES = [
  { id: 0, label: '呼吸 / 常亮', hint: '全键同步呼吸或常亮' },
  { id: 1, label: '波浪扩散', hint: '斜向或直线波纹扫过' },
  { id: 2, label: '行列扫过', hint: '整行或整列依次点亮' },
  { id: 3, label: '蛇形穿梭', hint: 'S 形折返依次点亮' },
  { id: 4, label: '涡旋旋转', hint: '由外向内螺旋点亮' },
  { id: 5, label: '自定义顺序', hint: '按单键序号依次点亮' },
  { id: 6, label: '列表循环', hint: '按下方队列轮流播放' },
  { id: 7, label: '列表随机', hint: '从下方队列随机播放' },
];
const SINGLE_WAVE_MODES = ['呼吸', '波浪', '行列', '蛇形', '涡旋', '自定义顺序'];
const DIR_OPTIONS = [
  '从上到下 (↓)',
  '斜向右下 (↘)',
  '从左到右 (→)',
  '斜向右上 (↗)',
  '从下到上 (↑)',
  '斜向左上 (↖)',
  '从右到左 (←)',
  '斜向左下 (↙)',
];
const SWITCH_POLICIES = ['随配置层一起切换灯效', '切层时保持当前灯效', '仅临时切层时保持灯效'];
const COLOR_SHIFT_TARGETS = [
  '固定颜色不变',
  '平时颜色自动彩虹流转',
  '按下颜色自动彩虹流转',
  '平时与按下均彩虹流转',
];
const TAG_ON_OPTIONS = ['不亮', '极短', '0.01 秒', '0.05 秒', '0.1 秒', '0.5 秒', '1 秒', '2 秒'];
const TAG_FADE_OPTIONS = ['常亮不灭', '慢速渐灭', '中速渐灭', '快速渐灭', '立刻熄灭'];
const INDICATOR_OPTIONS = [
  { value: IndicatorSource.None, label: '不使用此通道' },
  { value: IndicatorSource.NumLock, label: '数字锁定 (NumLock)' },
  { value: IndicatorSource.CapsLock, label: '大写锁定 (CapsLock)' },
  { value: IndicatorSource.ScrollLock, label: '滚动锁定 (ScrollLock)' },
  { value: IndicatorSource.AutoClicker, label: '自动连点运行中' },
  { value: IndicatorSource.MacroRunning, label: '宏连招运行中' },
];

const PRESET_SWATCHES: RgbTuple[] = [
  [160, 0, 0],
  [180, 90, 0],
  [160, 160, 0],
  [0, 160, 60],
  [0, 150, 170],
  [0, 90, 200],
  [110, 50, 200],
  [200, 30, 140],
  [180, 180, 180],
  [0, 0, 0],
];

interface LightingEditorProps {
  paintMode: boolean;
  setPaintMode: (v: boolean) => void;
  layer: 'up' | 'down';
  setLayer: (layer: 'up' | 'down') => void;
  brushColor: RgbTuple;
  setBrushColor: (c: RgbTuple) => void;
  selectedKeys: Set<number>;
  onSelectAllKeys: () => void;
}

export function LightingEditor({
  paintMode,
  setPaintMode,
  layer,
  setLayer,
  brushColor,
  setBrushColor,
  selectedKeys,
  onSelectAllKeys,
}: LightingEditorProps) {
  const {
    lightConfig,
    setLightConfig,
    keyboardConfig,
    setKeyboardConfig,
    selection,
    pushToast,
  } = useDevice();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hexDraft, setHexDraft] = useState('');
  const txtInputRef = useRef<HTMLInputElement>(null);

  // 点击左侧 LED1 时直接切换至系统指示灯设置视图
  if (selection.kind === 'led') {
    const led = keyboardConfig.systemLed;
    const patchLed = (patch: Partial<typeof led>) =>
      setKeyboardConfig((prev) => ({ ...prev, systemLed: { ...prev.systemLed, ...patch } }));

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-fuchsia-500/15 text-fuchsia-300">
            <Lightbulb className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">系统指示灯 LED1</h2>
            <p className="text-xs text-slate-400">
              顶部独立 RGB 灯珠，点击左侧任意键帽即可切回 16 键背光编辑
            </p>
          </div>
        </div>

        <div className="space-y-2.5 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <div>
            <div className="text-xs font-semibold text-slate-200">
              1. 平时状态指示灯（红 / 绿 / 蓝三通道独立复用）
            </div>
            <div className="text-[11px] text-slate-500">
              左侧键盘上的 LED1 实时预览已启用通道的混合亮度；勾选“反向”则变为功能开启时熄灭
            </div>
          </div>
          {(
            [
              ['红灯通道', 'channelR', 0, 'text-rose-400'],
              ['绿灯通道', 'channelG', 1, 'text-emerald-400'],
              ['蓝灯通道', 'channelB', 2, 'text-sky-400'],
            ] as const
          ).map(([name, field, bIdx, colorCls]) => (
            <div
              key={field}
              className="grid items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-950/60 p-2.5 text-xs sm:grid-cols-12"
            >
              <span className={`font-semibold sm:col-span-3 ${colorCls}`}>{name}</span>
              <select
                value={led[field].source}
                onChange={(e) =>
                  patchLed({
                    [field]: { ...led[field], source: Number(e.target.value) as IndicatorSource },
                  })
                }
                className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-white sm:col-span-4"
              >
                {INDICATOR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 sm:col-span-3">
                <span className="text-slate-400">亮度</span>
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={led.indicatorBrightness[bIdx]}
                  onChange={(e) => {
                    const next: [number, number, number] = [...led.indicatorBrightness];
                    next[bIdx] = Math.max(0, Math.min(255, Number(e.target.value)));
                    patchLed({ indicatorBrightness: next });
                  }}
                  className="w-16 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-white"
                />
              </label>
              <label className="flex items-center gap-1 text-slate-300 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={led[field].invert}
                  onChange={(e) =>
                    patchLed({ [field]: { ...led[field], invert: e.target.checked } })
                  }
                />
                反向
              </label>
            </div>
          ))}
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-200">
                2. 切换配置层时的临时颜色提示
              </div>
              <div className="text-[11px] text-slate-500">
                切换至本层时临时亮起此颜色，之后自动恢复为上方状态指示灯
              </div>
            </div>
            <span
              className="h-6 w-6 rounded-full border border-white/30"
              style={{ backgroundColor: `rgb(${led.tagColor.join(',')})` }}
              title={`切层标签色 RGB(${led.tagColor.join(', ')})`}
            />
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            {(['红 R', '绿 G', '蓝 B'] as const).map((lbl, cIdx) => (
              <label key={lbl} className="space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>{lbl}</span>
                  <span className="font-mono text-white">{led.tagColor[cIdx]}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={255}
                  value={led.tagColor[cIdx]}
                  onChange={(e) => {
                    const next: [number, number, number] = [...led.tagColor];
                    next[cIdx] = Number(e.target.value);
                    patchLed({ tagColor: next });
                  }}
                  className="w-full accent-fuchsia-500"
                />
              </label>
            ))}
          </div>
          <div className="grid gap-3 border-t border-slate-800 pt-3 text-xs sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-slate-300">切层后亮多久？</span>
              <select
                value={led.tagOnTime}
                onChange={(e) => patchLed({ tagOnTime: Number(e.target.value) })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              >
                {TAG_ON_OPTIONS.map((t, i) => (
                  <option key={t} value={i}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-slate-300">亮完后怎么熄灭？</span>
              <select
                value={led.tagFadeSpeed}
                onChange={(e) => patchLed({ tagFadeSpeed: Number(e.target.value) })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              >
                {TAG_FADE_OPTIONS.map((t, i) => (
                  <option key={t} value={i}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>
    );
  }

  // ==================== 16 键 RGB 背光编辑 ====================
  const selectedKeyIdx = selection.kind === 'key' ? selection.index : 0;
  const multiTargets = selectedKeys.size > 1 ? Array.from(selectedKeys) : [selectedKeyIdx];
  const activeRgb = paintMode
    ? brushColor
    : layer === 'up'
      ? lightConfig.upColors[selectedKeyIdx]
      : lightConfig.downColors[selectedKeyIdx];

  const [h, s, v] = rgbToHsv(...activeRgb);
  const isFlowMode = lightConfig.waveMode >= 1 && lightConfig.waveMode <= 4;
  const shieldPct = Math.round((lightConfig.shieldRemain[selectedKeyIdx] / 255) * 100);

  const updateActiveColor = (next: RgbTuple) => {
    setHexDraft('');
    if (paintMode) {
      setBrushColor(next);
    } else {
      setLightConfig((prev) => {
        const field = layer === 'up' ? 'upColors' : 'downColors';
        const copy = [...prev[field]];
        for (const targetIdx of multiTargets) {
          copy[targetIdx] = next;
        }
        return { ...prev, [field]: copy };
      });
    }
  };

  const applyGradient = (kind: 'all' | 'horiz' | 'vert' | 'rainbow') => {
    const field = layer === 'up' ? 'upColors' : 'downColors';
    let colors: RgbTuple[];
    if (kind === 'all') {
      colors = Array.from({ length: KEY_NUM }, () => [...activeRgb] as RgbTuple);
    } else if (kind === 'horiz') {
      colors = Array.from({ length: KEY_NUM }, (_, i) =>
        hsvToRgb((h + (i % 4) * 35) % 360, Math.max(160, s), Math.max(80, v)),
      );
    } else if (kind === 'vert') {
      colors = Array.from({ length: KEY_NUM }, (_, i) =>
        hsvToRgb((h + Math.floor(i / 4) * 35) % 360, Math.max(160, s), Math.max(80, v)),
      );
    } else {
      colors = Array.from({ length: KEY_NUM }, (_, i) =>
        hsvToRgb(((Math.floor(i / 4) + (i % 4)) * 45) % 360, 220, Math.max(90, v)),
      );
    }
    setLightConfig((prev) => ({ ...prev, [field]: colors }));
    pushToast('success', '已生成配色方案');
  };

  const handleExportTxt = async () => {
    const colors = layer === 'up' ? lightConfig.upColors : lightConfig.downColors;
    await saveFileWithPicker(exportPaletteTxt(colors), {
      suggestedName: `palette-${layer}.txt`,
      description: 'Ethane-XVI 配色文本文件',
      mimeType: 'text/plain',
      extensions: ['.txt'],
    });
  };

  return (
    <div className="space-y-4">
      {/* ① 主板块：动态动画方式（独立一级选择器）+ 子参数与切层策略 */}
      <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-fuchsia-400" />
            <h2 className="text-sm font-semibold text-white">动态动画方式</h2>
          </div>
          <span className="text-[11px] text-slate-400">点击左侧 LED1 可配置顶部状态指示灯</span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {WAVE_MODES.map((m) => {
            const active = lightConfig.waveMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setLightConfig((p) => ({ ...p, waveMode: m.id }))}
                className={`rounded-xl border px-3 py-2 text-left transition ${
                  active
                    ? 'border-fuchsia-400 bg-fuchsia-600/20 text-white ring-1 ring-fuchsia-500/40'
                    : 'border-slate-800 bg-slate-950/80 text-slate-300 hover:border-slate-600'
                }`}
              >
                <div className="text-xs font-semibold">{m.label}</div>
                <div className="mt-0.5 truncate text-[10px] text-slate-400">{m.hint}</div>
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 border-t border-slate-800/80 pt-3.5 text-xs sm:grid-cols-2 lg:grid-cols-3">
          {isFlowMode && (
            <label className="space-y-1">
              <span className="text-slate-300">灯光流动方向</span>
              <select
                value={lightConfig.direction}
                onChange={(e) =>
                  setLightConfig((p) => ({ ...p, direction: Number(e.target.value) }))
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-2 text-white"
              >
                {DIR_OPTIONS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="space-y-1">
            <span className="text-slate-300">
              {lightConfig.waveMode === 0
                ? `呼吸一次耗时（${lightConfig.actionTimeMs === 0 ? '0 = 常亮' : `${(lightConfig.actionTimeMs / 1000).toFixed(1)} 秒`}）`
                : `每走一格耗时（${lightConfig.actionTimeMs}ms）`}
            </span>
            <input
              type="number"
              min={0}
              max={10000}
              step={lightConfig.waveMode === 0 ? 100 : 10}
              value={lightConfig.actionTimeMs}
              onChange={(e) =>
                setLightConfig((p) => ({ ...p, actionTimeMs: Number(e.target.value) }))
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
            />
          </label>

          <label className="space-y-1">
            <span className="text-slate-300">切换配置层时的灯效策略</span>
            <select
              value={lightConfig.switchPolicy}
              onChange={(e) =>
                setLightConfig((p) => ({ ...p, switchPolicy: Number(e.target.value) }))
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-2 text-white"
            >
              {SWITCH_POLICIES.map((sp, i) => (
                <option key={sp} value={i}>
                  {sp}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-slate-300">自动彩虹变色</span>
            <select
              value={lightConfig.colorShiftTarget}
              onChange={(e) =>
                setLightConfig((p) => ({ ...p, colorShiftTarget: Number(e.target.value) }))
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-2 text-white"
            >
              {COLOR_SHIFT_TARGETS.map((c, i) => (
                <option key={c} value={i}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          {lightConfig.colorShiftTarget !== 0 && (
            <label className="space-y-1">
              <span className="text-slate-300">彩虹转一圈耗时（秒）</span>
              <input
                type="number"
                min={1}
                max={255}
                value={lightConfig.colorShiftPeriod || 10}
                onChange={(e) =>
                  setLightConfig((p) => ({ ...p, colorShiftPeriod: Number(e.target.value) }))
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
              />
            </label>
          )}
        </div>

        {/* 当选中“自定义顺序(5)”时，直接在此展示 4x4 序号快速编排 */}
        {lightConfig.waveMode === 5 && (
          <div className="space-y-2 border-t border-slate-800/80 pt-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium text-fuchsia-300">自定义点亮顺序 (0~15，允许同号同时亮)</span>
              <button
                type="button"
                onClick={() =>
                  setLightConfig((p) => ({
                    ...p,
                    customOrder: Array.from({ length: KEY_NUM }, (_, i) => i),
                  }))
                }
                className="text-[11px] text-slate-400 hover:text-white"
              >
                恢复 0~15 顺序
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {lightConfig.customOrder.map((ord, idx) => (
                <label
                  key={idx}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-2 py-1"
                >
                  <span className="font-mono text-[10px] text-slate-400">K{idx + 1}</span>
                  <input
                    type="number"
                    min={0}
                    max={15}
                    value={ord}
                    onChange={(e) => {
                      const next = [...lightConfig.customOrder];
                      next[idx] = Math.max(0, Math.min(15, Number(e.target.value)));
                      setLightConfig((p) => ({ ...p, customOrder: next }));
                    }}
                    className="w-10 bg-transparent text-right font-mono text-white outline-none"
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        {/* 当选中“列表循环/随机(6/7)”时，直接在此展示队列编辑 */}
        {(lightConfig.waveMode === 6 || lightConfig.waveMode === 7) && (
          <div className="space-y-2 border-t border-slate-800/80 pt-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium text-fuchsia-300">循环 / 随机播放队列</span>
              <label className="flex items-center gap-1.5 text-slate-300">
                <span>启用前</span>
                <input
                  type="number"
                  min={1}
                  max={9}
                  value={lightConfig.effectListCount}
                  onChange={(e) =>
                    setLightConfig((p) => ({
                      ...p,
                      effectListCount: Math.max(1, Math.min(9, Number(e.target.value))),
                    }))
                  }
                  className="w-12 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-white"
                />
                <span>项</span>
              </label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {lightConfig.effectList.map((modeVal, i) => (
                <select
                  key={i}
                  disabled={i >= lightConfig.effectListCount}
                  value={modeVal}
                  onChange={(e) => {
                    const next = [...lightConfig.effectList];
                    next[i] = Number(e.target.value);
                    setLightConfig((p) => ({ ...p, effectList: next }));
                  }}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-white disabled:opacity-35"
                >
                  {SINGLE_WAVE_MODES.map((m, mi) => (
                    <option key={m} value={mi}>
                      #{i + 1} {m}
                    </option>
                  ))}
                </select>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ② 按键颜色编辑板块 */}
      <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-slate-800 bg-slate-950 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setPaintMode(false)}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition ${
                  !paintMode ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <MousePointer2 className="h-3 w-3" />
                {multiTargets.length > 1
                  ? `已多选 ${multiTargets.length} 键`
                  : `单独改 K${selectedKeyIdx + 1}`}
              </button>
              <button
                type="button"
                onClick={() => setPaintMode(true)}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition ${
                  paintMode ? 'bg-fuchsia-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Paintbrush className="h-3 w-3" /> 画笔涂色
              </button>
            </div>

            <div className="flex rounded-lg border border-slate-800 bg-slate-950 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setLayer('up')}
                className={`rounded-md px-2.5 py-1 font-medium ${
                  layer === 'up' ? 'bg-slate-700 text-white' : 'text-slate-400'
                }`}
              >
                平时颜色
              </button>
              <button
                type="button"
                onClick={() => setLayer('down')}
                className={`rounded-md px-2.5 py-1 font-medium ${
                  layer === 'down' ? 'bg-slate-700 text-white' : 'text-slate-400'
                }`}
              >
                按下时的颜色
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={onSelectAllKeys}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-slate-300 hover:border-indigo-400"
            >
              全选 16 键
            </button>
            <button
              type="button"
              onClick={() => txtInputRef.current?.click()}
              title="导入 .txt 配色"
              className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-300 hover:bg-slate-800"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => void handleExportTxt()}
              title="导出 .txt 配色（另存为）"
              className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-300 hover:bg-slate-800"
            >
              <Upload className="h-3.5 w-3.5" />
            </button>
            <input
              ref={txtInputRef}
              type="file"
              accept=".txt"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const colors = parsePaletteTxt(await file.text());
                  setLightConfig((prev) => ({
                    ...prev,
                    [layer === 'up' ? 'upColors' : 'downColors']: colors,
                  }));
                  pushToast('success', '已导入配色文件');
                } catch (err) {
                  pushToast('error', err instanceof Error ? err.message : '导入失败');
                }
                e.target.value = '';
              }}
            />
          </div>
        </div>

        {/* 色块 + Hex 输入 + 梯度生成工具 */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {PRESET_SWATCHES.map((sw, i) => (
              <button
                key={i}
                type="button"
                onClick={() => updateActiveColor(sw)}
                className="h-6 w-6 rounded-md border border-white/25 transition hover:scale-110"
                style={{ backgroundColor: `rgb(${sw.join(',')})` }}
                title={`RGB(${sw.join(', ')})`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <input
              type="text"
              value={hexDraft || rgbToHex(activeRgb)}
              onChange={(e) => {
                const val = e.target.value;
                setHexDraft(val);
                const parsed = hexToRgb(val);
                if (parsed) updateActiveColor(parsed);
              }}
              onBlur={() => setHexDraft('')}
              className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-white"
              title="输入十六进制色值，如 #FF6600"
            />
            <span
              className="h-5 w-5 rounded-md border border-white/30"
              style={{ backgroundColor: `rgb(${activeRgb.join(',')})` }}
            />
          </div>
        </div>

        <div className="grid gap-3 text-xs sm:grid-cols-2">
          <div className="space-y-1.5">
            {(['红 R', '绿 G', '蓝 B'] as const).map((lbl, idx) => (
              <label key={lbl} className="flex items-center gap-2">
                <span className="w-8 text-slate-400">{lbl}</span>
                <input
                  type="range"
                  min={0}
                  max={255}
                  value={activeRgb[idx]}
                  onChange={(e) => {
                    const next: RgbTuple = [...activeRgb];
                    next[idx] = Number(e.target.value);
                    updateActiveColor(next);
                  }}
                  className="flex-1 accent-indigo-500"
                />
                <span className="w-7 text-right font-mono text-slate-200">{activeRgb[idx]}</span>
              </label>
            ))}
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2">
              <span className="w-8 text-slate-400">色相</span>
              <input
                type="range"
                min={0}
                max={359}
                value={h}
                onChange={(e) => updateActiveColor(hsvToRgb(Number(e.target.value), s, v))}
                className="flex-1 accent-fuchsia-500"
              />
              <span className="w-7 text-right font-mono text-slate-200">{h}°</span>
            </label>
            <label className="flex items-center gap-2">
              <span className="w-8 text-slate-400">饱和</span>
              <input
                type="range"
                min={0}
                max={255}
                value={s}
                onChange={(e) => updateActiveColor(hsvToRgb(h, Number(e.target.value), v))}
                className="flex-1 accent-fuchsia-500"
              />
              <span className="w-7 text-right font-mono text-slate-200">{s}</span>
            </label>
            <label className="flex items-center gap-2">
              <span className="w-8 text-slate-400">亮度</span>
              <input
                type="range"
                min={0}
                max={255}
                value={v}
                onChange={(e) => updateActiveColor(hsvToRgb(h, s, Number(e.target.value)))}
                className="flex-1 accent-fuchsia-500"
              />
              <span className="w-7 text-right font-mono text-slate-200">{v}</span>
            </label>
          </div>
        </div>

        {/* 快捷批量填充/渐变生成器 */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-800 pt-2.5 text-[11px]">
          <span className="text-slate-500">批量配色生成：</span>
          <button
            type="button"
            onClick={() => applyGradient('all')}
            className="rounded-md border border-slate-800 bg-slate-950 px-2.5 py-1 text-slate-300 hover:border-indigo-400"
          >
            全键同色
          </button>
          <button
            type="button"
            onClick={() => applyGradient('horiz')}
            className="rounded-md border border-slate-800 bg-slate-950 px-2.5 py-1 text-slate-300 hover:border-indigo-400"
          >
            横向渐变
          </button>
          <button
            type="button"
            onClick={() => applyGradient('vert')}
            className="rounded-md border border-slate-800 bg-slate-950 px-2.5 py-1 text-slate-300 hover:border-indigo-400"
          >
            纵向渐变
          </button>
          <button
            type="button"
            onClick={() => applyGradient('rainbow')}
            className="rounded-md border border-slate-800 bg-slate-950 px-2.5 py-1 text-slate-300 hover:border-fuchsia-400"
          >
            对角彩虹
          </button>
        </div>
      </div>

      {/* ③ 折叠高级灯效细节 */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40">
        <button
          type="button"
          onClick={() => setShowAdvanced((s) => !s)}
          className="flex w-full items-center justify-between px-4 py-3 text-xs font-semibold text-slate-300 hover:text-white"
        >
          <span>高级灯效细节（按下变暗聚焦 / 渐变柔和度 / 节奏间隔）</span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
          />
        </button>

        {showAdvanced && (
          <div className="space-y-4 border-t border-slate-800 p-4 text-xs">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-indigo-300">
                  单键触发手感（当前键：K{selectedKeyIdx + 1}）
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const pf = lightConfig.pressFade[selectedKeyIdx];
                    const rf = lightConfig.releaseFade[selectedKeyIdx];
                    const sr = lightConfig.shieldRemain[selectedKeyIdx];
                    setLightConfig((p) => ({
                      ...p,
                      pressFade: Array(KEY_NUM).fill(pf),
                      releaseFade: Array(KEY_NUM).fill(rf),
                      shieldRemain: Array(KEY_NUM).fill(sr),
                    }));
                    pushToast('success', '已将此键触发手感同步至全部 16 键');
                  }}
                  className="text-[11px] text-indigo-300 hover:underline"
                >
                  应用到全部 16 键
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span>按下时其余按键保留亮度</span>
                    <span className="font-mono text-indigo-300">
                      {shieldPct === 100
                        ? '不变暗 (100%)'
                        : shieldPct === 0
                          ? '完全熄灭 (0%)'
                          : `保留 ${shieldPct}%`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={255}
                    value={lightConfig.shieldRemain[selectedKeyIdx]}
                    onChange={(e) => {
                      const next = [...lightConfig.shieldRemain];
                      next[selectedKeyIdx] = Number(e.target.value);
                      setLightConfig((p) => ({ ...p, shieldRemain: next }));
                    }}
                    className="w-full accent-indigo-500"
                  />
                </label>

                <label className="space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span>按下变色柔和度（0=瞬间）</span>
                    <span className="font-mono text-slate-200">
                      {lightConfig.pressFade[selectedKeyIdx]}/30
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={30}
                    value={lightConfig.pressFade[selectedKeyIdx]}
                    onChange={(e) => {
                      const next = [...lightConfig.pressFade];
                      next[selectedKeyIdx] = Number(e.target.value);
                      setLightConfig((p) => ({ ...p, pressFade: next }));
                    }}
                    className="w-full accent-indigo-500"
                  />
                </label>

                <label className="space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span>松手恢复柔和度（拖尾）</span>
                    <span className="font-mono text-slate-200">
                      {lightConfig.releaseFade[selectedKeyIdx]}/30
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={30}
                    value={lightConfig.releaseFade[selectedKeyIdx]}
                    onChange={(e) => {
                      const next = [...lightConfig.releaseFade];
                      next[selectedKeyIdx] = Number(e.target.value);
                      setLightConfig((p) => ({ ...p, releaseFade: next }));
                    }}
                    className="w-full accent-indigo-500"
                  />
                </label>
              </div>
            </div>

            <div className="grid gap-3 border-t border-slate-800 pt-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1">
                <span className="text-slate-300">
                  操作后延迟亮起（
                  {lightConfig.waitTime10ms === 0
                    ? '0 = 始终播放'
                    : `${(lightConfig.waitTime10ms / 100).toFixed(2)} 秒`}
                  ）
                </span>
                <input
                  type="number"
                  min={0}
                  max={65000}
                  value={lightConfig.waitTime10ms}
                  onChange={(e) =>
                    setLightConfig((p) => ({ ...p, waitTime10ms: Number(e.target.value) }))
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
                />
              </label>

              <label className="space-y-1">
                <span className="text-slate-300">两轮停顿 / 随机 (ms)</span>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={65000}
                    value={lightConfig.gapTimeMs}
                    onChange={(e) =>
                      setLightConfig((p) => ({ ...p, gapTimeMs: Number(e.target.value) }))
                    }
                    className="w-1/2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
                  />
                  <input
                    type="number"
                    min={0}
                    max={65000}
                    value={lightConfig.randGapTimeMs}
                    onChange={(e) =>
                      setLightConfig((p) => ({ ...p, randGapTimeMs: Number(e.target.value) }))
                    }
                    className="w-1/2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
                  />
                </div>
              </label>

              <label className="space-y-1">
                <span className="text-slate-300">流水亮 / 灭拖尾 (0~30)</span>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={lightConfig.fadeOn}
                    onChange={(e) =>
                      setLightConfig((p) => ({ ...p, fadeOn: Number(e.target.value) }))
                    }
                    className="w-1/2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
                  />
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={lightConfig.fadeOff}
                    onChange={(e) =>
                      setLightConfig((p) => ({ ...p, fadeOff: Number(e.target.value) }))
                    }
                    className="w-1/2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
                  />
                </div>
              </label>

              <label className="space-y-1">
                <span className="text-slate-300">其余键变暗 / 恢复柔和度</span>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={lightConfig.shieldFadeOn}
                    onChange={(e) =>
                      setLightConfig((p) => ({ ...p, shieldFadeOn: Number(e.target.value) }))
                    }
                    className="w-1/2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
                  />
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={lightConfig.shieldFadeOff}
                    onChange={(e) =>
                      setLightConfig((p) => ({ ...p, shieldFadeOff: Number(e.target.value) }))
                    }
                    className="w-1/2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
                  />
                </div>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
