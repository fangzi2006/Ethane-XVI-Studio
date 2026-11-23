import { Download, Paintbrush, Sparkles, Upload, Wand2 } from 'lucide-react';
import { useRef } from 'react';
import { exportPaletteTxt, parsePaletteTxt } from '../services/protocol';
import { useDevice } from '../store/useDeviceStore';
import { KEY_NUM, RgbTuple, hsvToRgb, rgbToHsv, simulateLedRgb } from '../types/config';

const WAVE_MODES = ['呼吸', '波动', '行列', '蛇行', '涡旋', '自定义', '循环列表', '随机列表'];
const SINGLE_WAVE_MODES = ['呼吸', '波动', '行列', '蛇行', '涡旋', '自定义'];
const DIR_OPTIONS = ['↓ / →↓', '↘ / ↓→', '→ / ↑→', '↗ / →↑', '↑ / ←↑', '↖ / ↑←', '← / ↓←', '↙ / ←↓'];
const SWITCH_POLICIES = ['跟随配置切换', '保持当前灯效', '临时切换时保持'];
const COLOR_SHIFT_TARGETS = ['不变色', '仅上配色变色', '仅下配色变色', '上下配色均变色'];

const PRESET_SWATCHES: RgbTuple[] = [
  [120, 0, 0],
  [120, 60, 0],
  [100, 100, 0],
  [0, 120, 40],
  [0, 110, 120],
  [0, 60, 140],
  [70, 30, 140],
  [140, 20, 100],
  [120, 120, 120],
  [0, 0, 0],
];

interface LightingEditorProps {
  layer: 'up' | 'down';
  setLayer: (layer: 'up' | 'down') => void;
  brushColor: RgbTuple;
  setBrushColor: (c: RgbTuple) => void;
  useSimulatedLed: boolean;
  setUseSimulatedLed: (v: boolean) => void;
}

export function LightingEditor({
  layer,
  setLayer,
  brushColor,
  setBrushColor,
  useSimulatedLed,
  setUseSimulatedLed,
}: LightingEditorProps) {
  const { lightConfig, setLightConfig, selection, pushToast } = useDevice();
  const txtInputRef = useRef<HTMLInputElement>(null);

  const selectedKeyIdx = selection.kind === 'key' ? selection.index : 0;
  const [h, s, v] = rgbToHsv(...brushColor);
  const [simR, simG, simB] = simulateLedRgb(...brushColor);

  const applyColorToAll = () => {
    setLightConfig((prev) => ({
      ...prev,
      [layer === 'up' ? 'upColors' : 'downColors']: Array.from(
        { length: KEY_NUM },
        () => [...brushColor] as RgbTuple,
      ),
    }));
    pushToast('success', `已将当前颜色应用到全部 16 颗按键（${layer === 'up' ? '上配色' : '下配色'}）`);
  };

  const applyRainbowPreset = () => {
    setLightConfig((prev) => ({
      ...prev,
      [layer === 'up' ? 'upColors' : 'downColors']: Array.from({ length: KEY_NUM }, (_, i) => {
        const row = Math.floor(i / 4);
        const col = i % 4;
        return hsvToRgb(((row + col) * 45) % 360, 220, 110);
      }),
    }));
    pushToast('success', '已生成斜向彩虹渐变配色');
  };

  const handleExportTxt = () => {
    const colors = layer === 'up' ? lightConfig.upColors : lightConfig.downColors;
    const text = exportPaletteTxt(colors);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `palette-${layer}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* 顶部配色层切换 + 仿真开关 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-fuchsia-500/15 text-fuchsia-300">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">键盘 RGB 灯效设计</h2>
            <p className="text-xs text-slate-400">
              选好画笔颜色后，直接点击左侧任意键帽即可上色
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-800 bg-slate-950 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setLayer('up')}
              className={`rounded-md px-3 py-1 font-medium transition ${
                layer === 'up' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              上配色 (常态)
            </button>
            <button
              type="button"
              onClick={() => setLayer('down')}
              className={`rounded-md px-3 py-1 font-medium transition ${
                layer === 'down' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              下配色 (按下)
            </button>
          </div>

          <label className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={useSimulatedLed}
              onChange={(e) => setUseSimulatedLed(e.target.checked)}
            />
            LED 低亮度仿真
          </label>
        </div>
      </div>

      {/* 调色画笔区 */}
      <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
            <Paintbrush className="h-4 w-4 text-fuchsia-400" />
            画笔调色盘
            <span className="ml-1 inline-flex items-center gap-1.5 font-normal text-slate-400">
              <span
                className="h-4 w-4 rounded border border-white/25"
                style={{ backgroundColor: `rgb(${brushColor.join(',')})` }}
                title="原始 RGB"
              />
              <span>→ 仿真</span>
              <span
                className="h-4 w-4 rounded border border-white/25"
                style={{ backgroundColor: `rgb(${simR},${simG},${simB})` }}
                title="物理 LED 仿真亮度"
              />
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={applyColorToAll}
              className="rounded-lg bg-indigo-600/20 px-2.5 py-1 font-medium text-indigo-200 hover:bg-indigo-600/30"
            >
              填充全部按键
            </button>
            <button
              type="button"
              onClick={applyRainbowPreset}
              className="inline-flex items-center gap-1 rounded-lg bg-fuchsia-500/20 px-2.5 py-1 font-medium text-fuchsia-200 hover:bg-fuchsia-500/30"
            >
              <Wand2 className="h-3.5 w-3.5" /> 彩虹渐变
            </button>
            <button
              type="button"
              onClick={() => txtInputRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-slate-300 hover:bg-slate-800"
            >
              <Upload className="h-3 w-3" /> 导入配色
            </button>
            <button
              type="button"
              onClick={handleExportTxt}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-slate-300 hover:bg-slate-800"
            >
              <Download className="h-3 w-3" /> 导出配色
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
                  pushToast('error', err instanceof Error ? err.message : '导入配色失败');
                }
                e.target.value = '';
              }}
            />
          </div>
        </div>

        {/* 快捷预设色块 */}
        <div className="flex flex-wrap items-center gap-2">
          {PRESET_SWATCHES.map((sw, i) => {
            const [sr, sg, sb] = simulateLedRgb(...sw);
            return (
              <button
                key={i}
                type="button"
                onClick={() => setBrushColor(sw)}
                className="h-7 w-7 rounded-lg border border-white/20 transition hover:scale-110"
                style={{ backgroundColor: `rgb(${sr},${sg},${sb})` }}
                title={`RGB(${sw.join(', ')})`}
              />
            );
          })}
        </div>

        {/* RGB / HSV 联动滑块 */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            {(['R 红', 'G 绿', 'B 蓝'] as const).map((lbl, idx) => (
              <label key={lbl} className="flex items-center gap-2 text-xs">
                <span className="w-10 text-slate-400">{lbl}</span>
                <input
                  type="range"
                  min={0}
                  max={255}
                  value={brushColor[idx]}
                  onChange={(e) => {
                    const next: RgbTuple = [...brushColor];
                    next[idx] = Number(e.target.value);
                    setBrushColor(next);
                  }}
                  className="flex-1 accent-indigo-500"
                />
                <span className="w-8 text-right font-mono text-slate-200">{brushColor[idx]}</span>
              </label>
            ))}
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs">
              <span className="w-10 text-slate-400">H 色相</span>
              <input
                type="range"
                min={0}
                max={359}
                value={h}
                onChange={(e) => setBrushColor(hsvToRgb(Number(e.target.value), s, v))}
                className="flex-1 accent-fuchsia-500"
              />
              <span className="w-8 text-right font-mono text-slate-200">{h}°</span>
            </label>
            <label className="flex items-center gap-2 text-xs">
              <span className="w-10 text-slate-400">S 饱和</span>
              <input
                type="range"
                min={0}
                max={255}
                value={s}
                onChange={(e) => setBrushColor(hsvToRgb(h, Number(e.target.value), v))}
                className="flex-1 accent-fuchsia-500"
              />
              <span className="w-8 text-right font-mono text-slate-200">{s}</span>
            </label>
            <label className="flex items-center gap-2 text-xs">
              <span className="w-10 text-slate-400">V 亮度</span>
              <input
                type="range"
                min={0}
                max={255}
                value={v}
                onChange={(e) => setBrushColor(hsvToRgb(h, s, Number(e.target.value)))}
                className="flex-1 accent-fuchsia-500"
              />
              <span className="w-8 text-right font-mono text-slate-200">{v}</span>
            </label>
          </div>
        </div>
      </div>

      {/* 动态灯效与全局参数 */}
      <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <h3 className="text-xs font-semibold text-slate-200">全局动态灯效</h3>
        <div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1">
            <span className="text-slate-400">变化模式</span>
            <select
              value={lightConfig.waveMode}
              onChange={(e) =>
                setLightConfig((p) => ({ ...p, waveMode: Number(e.target.value) }))
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-2 text-white"
            >
              {WAVE_MODES.map((m, i) => (
                <option key={m} value={i}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-slate-400">流水灯方向</span>
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

          <label className="space-y-1">
            <span className="text-slate-400">切层时灯效策略</span>
            <select
              value={lightConfig.switchPolicy}
              onChange={(e) =>
                setLightConfig((p) => ({ ...p, switchPolicy: Number(e.target.value) }))
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-2 text-white"
            >
              {SWITCH_POLICIES.map((s, i) => (
                <option key={s} value={i}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-slate-400">色环流转变色</span>
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
        </div>

        {/* 时间与渐变参数 */}
        <div className="grid gap-3 text-xs sm:grid-cols-3 lg:grid-cols-4">
          <label className="space-y-1">
            <span className="text-slate-400">变色周期 (秒, 0不流转)</span>
            <input
              type="number"
              min={0}
              max={255}
              value={lightConfig.colorShiftPeriod}
              onChange={(e) =>
                setLightConfig((p) => ({ ...p, colorShiftPeriod: Number(e.target.value) }))
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-400">动作时间 (ms, 0常亮)</span>
            <input
              type="number"
              min={0}
              max={10000}
              value={lightConfig.actionTimeMs}
              onChange={(e) =>
                setLightConfig((p) => ({ ...p, actionTimeMs: Number(e.target.value) }))
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-400">空闲等待 ({lightConfig.waitTime10ms * 10}ms)</span>
            <input
              type="number"
              min={0}
              max={65000}
              value={lightConfig.waitTime10ms}
              onChange={(e) =>
                setLightConfig((p) => ({ ...p, waitTime10ms: Number(e.target.value) }))
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-400">间隔 / 随机增量 (ms)</span>
            <div className="flex gap-1.5">
              <input
                type="number"
                min={0}
                max={65000}
                value={lightConfig.gapTimeMs}
                onChange={(e) =>
                  setLightConfig((p) => ({ ...p, gapTimeMs: Number(e.target.value) }))
                }
                className="w-1/2 rounded-xl border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
              />
              <input
                type="number"
                min={0}
                max={65000}
                value={lightConfig.randGapTimeMs}
                onChange={(e) =>
                  setLightConfig((p) => ({ ...p, randGapTimeMs: Number(e.target.value) }))
                }
                className="w-1/2 rounded-xl border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
              />
            </div>
          </label>
          <label className="space-y-1">
            <span className="text-slate-400">主光效亮/灭渐变 (0~30)</span>
            <div className="flex gap-1.5">
              <input
                type="number"
                min={0}
                max={30}
                value={lightConfig.fadeOn}
                onChange={(e) => setLightConfig((p) => ({ ...p, fadeOn: Number(e.target.value) }))}
                className="w-1/2 rounded-xl border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
              />
              <input
                type="number"
                min={0}
                max={30}
                value={lightConfig.fadeOff}
                onChange={(e) => setLightConfig((p) => ({ ...p, fadeOff: Number(e.target.value) }))}
                className="w-1/2 rounded-xl border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
              />
            </div>
          </label>
          <label className="space-y-1">
            <span className="text-slate-400">屏蔽亮/灭渐变 (0~30)</span>
            <div className="flex gap-1.5">
              <input
                type="number"
                min={0}
                max={30}
                value={lightConfig.shieldFadeOn}
                onChange={(e) =>
                  setLightConfig((p) => ({ ...p, shieldFadeOn: Number(e.target.value) }))
                }
                className="w-1/2 rounded-xl border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
              />
              <input
                type="number"
                min={0}
                max={30}
                value={lightConfig.shieldFadeOff}
                onChange={(e) =>
                  setLightConfig((p) => ({ ...p, shieldFadeOff: Number(e.target.value) }))
                }
                className="w-1/2 rounded-xl border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
              />
            </div>
          </label>
        </div>

        {/* 循环 / 随机列表（当模式为 6 或 7 时展开） */}
        {(lightConfig.waveMode === 6 || lightConfig.waveMode === 7) && (
          <div className="space-y-2 border-t border-slate-800 pt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-indigo-300">循环 / 随机灯效队列</span>
              <label className="flex items-center gap-2 text-slate-300">
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
                  className="w-14 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-white"
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
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white disabled:opacity-35"
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

      {/* 单键精细参数 */}
      <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-200">
            单键触发效果：当前选中 <span className="font-mono text-indigo-300">K{selectedKeyIdx + 1}</span>
          </h3>
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
              pushToast('success', '已将当前单键渐变与屏蔽参数复制到全部 16 键');
            }}
            className="text-[11px] text-indigo-300 hover:underline"
          >
            同步此键参数至全部 16 键
          </button>
        </div>
        <div className="grid gap-3 text-xs sm:grid-cols-4">
          <label className="space-y-1">
            <span className="text-slate-400">按下渐变 (0~30)</span>
            <input
              type="number"
              min={0}
              max={30}
              value={lightConfig.pressFade[selectedKeyIdx]}
              onChange={(e) => {
                const next = [...lightConfig.pressFade];
                next[selectedKeyIdx] = Number(e.target.value);
                setLightConfig((p) => ({ ...p, pressFade: next }));
              }}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-400">抬起渐变 (0~30)</span>
            <input
              type="number"
              min={0}
              max={30}
              value={lightConfig.releaseFade[selectedKeyIdx]}
              onChange={(e) => {
                const next = [...lightConfig.releaseFade];
                next[selectedKeyIdx] = Number(e.target.value);
                setLightConfig((p) => ({ ...p, releaseFade: next }));
              }}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-400">自定义次序 (0~15)</span>
            <input
              type="number"
              min={0}
              max={15}
              value={lightConfig.customOrder[selectedKeyIdx]}
              onChange={(e) => {
                const next = [...lightConfig.customOrder];
                next[selectedKeyIdx] = Number(e.target.value);
                setLightConfig((p) => ({ ...p, customOrder: next }));
              }}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-400">屏蔽剩余亮度 (0~255)</span>
            <input
              type="number"
              min={0}
              max={255}
              value={lightConfig.shieldRemain[selectedKeyIdx]}
              onChange={(e) => {
                const next = [...lightConfig.shieldRemain];
                next[selectedKeyIdx] = Number(e.target.value);
                setLightConfig((p) => ({ ...p, shieldRemain: next }));
              }}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
