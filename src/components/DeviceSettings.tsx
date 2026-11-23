import {
  Activity,
  AlertTriangle,
  Crosshair,
  Monitor,
  Music,
  Power,
  RefreshCw,
  ShieldCheck,
  Sliders,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useDevice } from '../store/useDeviceStore';

const NOTES = [
  { label: 'C4', note: 12 },
  { label: 'D4', note: 14 },
  { label: 'E4', note: 16 },
  { label: 'F4', note: 17 },
  { label: 'G4', note: 19 },
  { label: 'A4', note: 21 },
  { label: 'B4', note: 23 },
  { label: 'C5', note: 24 },
];

export function DeviceSettings() {
  const {
    keyboardConfig,
    setKeyboardConfig,
    globalParams,
    diagnostics,
    liveInput,
    livePolling,
    setLivePolling,
    applyKeyDebounce,
    calibrateRockerMid,
    applyRockerRange,
    applyEncoderDoubleFreq,
    refreshDiagnostics,
    triggerSoftReset,
    triggerBootloader,
    triggerBuzzerMode,
    playBuzzerNote,
    status,
    mockTransportRef,
  } = useDevice();

  const [debounceDraft, setDebounceDraft] = useState(globalParams.keyDebounce);
  const [minX, setMinX] = useState(globalParams.rockerMinX);
  const [maxX, setMaxX] = useState(globalParams.rockerMaxX);
  const [minY, setMinY] = useState(globalParams.rockerMinY);
  const [maxY, setMaxY] = useState(globalParams.rockerMaxY);
  const [buzzVol, setBuzzVol] = useState(5);

  useEffect(() => {
    setDebounceDraft(globalParams.keyDebounce);
    setMinX(globalParams.rockerMinX);
    setMaxX(globalParams.rockerMaxX);
    setMinY(globalParams.rockerMinY);
    setMaxY(globalParams.rockerMaxY);
  }, [globalParams]);

  const diagTotalErrors = diagnostics
    ? diagnostics.flagError +
      diagnostics.checksumError +
      diagnostics.watchdogResets +
      diagnostics.globalError +
      diagnostics.cfgErrors.reduce((a, b) => a + b, 0) +
      diagnostics.lightErrors.reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* 标题与实时监控总开关 */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300">
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">设备校准与硬件工具</h2>
            <p className="text-xs text-slate-400">
              摇杆中位/范围校准、按键消抖、旋钮倍频、实时输入测试仪与固件诊断
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setLivePolling(!livePolling)}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
            livePolling
              ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300'
              : 'border-slate-700 bg-slate-950 text-slate-200 hover:border-slate-500'
          }`}
        >
          <Activity className={`h-4 w-4 ${livePolling ? 'animate-pulse' : ''}`} />
          {livePolling ? '实时硬件测试中（点击停止）' : '开启实时硬件测试'}
        </button>
      </div>

      {/* 2 列仪表盘卡片网格 */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* 卡片 1：摇杆可视化校准 */}
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">摇杆校准 (立即生效)</h3>
            {liveInput && (
              <span className="font-mono text-[11px] text-emerald-300">
                X:{liveInput.rockerX} Y:{liveInput.rockerY}
              </span>
            )}
          </div>

          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="flex flex-col items-center">
              <div className="relative h-32 w-32 rounded-xl border border-slate-700 bg-slate-950">
                <div className="absolute inset-x-0 top-1/2 h-px bg-slate-800" />
                <div className="absolute inset-y-0 left-1/2 w-px bg-slate-800" />
                <div
                  className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-indigo-400"
                  style={{
                    left: `${(globalParams.rockerMidX / 4095) * 100}%`,
                    top: `${(globalParams.rockerMidY / 4095) * 100}%`,
                  }}
                />
                <div
                  className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/60"
                  style={{
                    left: `${((liveInput?.rockerX ?? globalParams.rockerMidX) / 4095) * 100}%`,
                    top: `${((liveInput?.rockerY ?? globalParams.rockerMidY) / 4095) * 100}%`,
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => void calibrateRockerMid()}
                className="mt-2.5 inline-flex items-center gap-1 rounded-lg bg-indigo-600/25 px-3 py-1.5 text-xs font-semibold text-indigo-200 hover:bg-indigo-600/35"
              >
                <Crosshair className="h-3.5 w-3.5" /> 一键中位校准
              </button>
              {status === 'mock' && mockTransportRef.current && (
                <input
                  type="range"
                  min={0}
                  max={4095}
                  defaultValue={2048}
                  title="模拟摇杆 X 偏移"
                  onChange={(e) => {
                    if (mockTransportRef.current) {
                      mockTransportRef.current.mockLiveInput.rockerX = Number(e.target.value);
                    }
                  }}
                  className="mt-2 w-28 accent-violet-400"
                />
              )}
            </div>

            <div className="flex-1 space-y-2.5 text-xs">
              <div className="text-slate-400">
                当前中位：
                <strong className="font-mono text-white">
                  ({globalParams.rockerMidX}, {globalParams.rockerMidY})
                </strong>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-slate-400">X 下限</span>
                  <input
                    type="number"
                    min={0}
                    max={4094}
                    value={minX}
                    onChange={(e) => setMinX(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-400">X 上限</span>
                  <input
                    type="number"
                    min={1}
                    max={4095}
                    value={maxX}
                    onChange={(e) => setMaxX(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-400">Y 下限</span>
                  <input
                    type="number"
                    min={0}
                    max={4094}
                    value={minY}
                    onChange={(e) => setMinY(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-400">Y 上限</span>
                  <input
                    type="number"
                    min={1}
                    max={4095}
                    value={maxY}
                    onChange={(e) => setMaxY(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-white"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => void applyRockerRange(minX, maxX, minY, maxY)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 py-1.5 font-medium text-slate-200 hover:bg-slate-700"
              >
                保存摇杆范围
              </button>
            </div>
          </div>
        </div>

        {/* 卡片 2：实时按键测试矩阵 + 旋钮计数 */}
        <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">实时按键与旋钮测试</h3>
            <span className="font-mono text-xs text-slate-400">
              EC1: {liveInput?.ec1Count ?? '--'} · EC2: {liveInput?.ec2Count ?? '--'}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 16 }, (_, i) => {
              const pressed = liveInput ? Boolean(liveInput.keyMask & (1 << i)) : false;
              return (
                <div
                  key={i}
                  onMouseDown={() => {
                    if (status === 'mock' && mockTransportRef.current) {
                      mockTransportRef.current.mockLiveInput.keyMask |= 1 << i;
                    }
                  }}
                  onMouseUp={() => {
                    if (status === 'mock' && mockTransportRef.current) {
                      mockTransportRef.current.mockLiveInput.keyMask &= ~(1 << i);
                    }
                  }}
                  onMouseLeave={() => {
                    if (status === 'mock' && mockTransportRef.current) {
                      mockTransportRef.current.mockLiveInput.keyMask &= ~(1 << i);
                    }
                  }}
                  className={`flex h-10 items-center justify-center rounded-lg border font-mono text-xs font-semibold transition select-none ${
                    pressed
                      ? 'border-emerald-400 bg-emerald-500/25 text-emerald-200 shadow-inner'
                      : 'border-slate-800 bg-slate-950 text-slate-500'
                  }`}
                >
                  K{i + 1}
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-500">
            开启右上角“实时硬件测试”后，按下实体小键盘按键即可实时高亮对应键位（模拟模式下可直接点击测试）。
          </p>
        </div>

        {/* 卡片 3：消抖、旋钮倍频与屏幕分辨率 */}
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-5 text-xs">
          <h3 className="text-sm font-semibold text-white">基础硬件与屏幕参数</h3>

          <div className="space-y-1.5 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-200">按键后延迟消抖</span>
              <span className="font-mono text-indigo-300">{debounceDraft}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={debounceDraft}
              onChange={(e) => setDebounceDraft(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500">按下零延迟触发，仅防松手抖动</span>
              <button
                type="button"
                onClick={() => void applyKeyDebounce(debounceDraft)}
                className="rounded-lg bg-indigo-600/20 px-2.5 py-1 font-medium text-indigo-200 hover:bg-indigo-600/30"
              >
                立即写入
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div>
              <div className="font-medium text-slate-200">2 脉冲旋钮倍频适配</div>
              <div className="text-[11px] text-slate-500">转两格才响一次时勾选</div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={globalParams.ec1DoubleFreq}
                  onChange={(e) =>
                    void applyEncoderDoubleFreq(e.target.checked, globalParams.ec2DoubleFreq)
                  }
                />
                旋钮 1
              </label>
              <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={globalParams.ec2DoubleFreq}
                  onChange={(e) =>
                    void applyEncoderDoubleFreq(globalParams.ec1DoubleFreq, e.target.checked)
                  }
                />
                旋钮 2
              </label>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 font-medium text-slate-200">
                <Monitor className="h-3.5 w-3.5 text-indigo-400" /> 屏幕分辨率 (定位点击用)
              </span>
              <button
                type="button"
                onClick={() =>
                  setKeyboardConfig((p) => ({
                    ...p,
                    screenWidth: window.screen.width || 1920,
                    screenHeight: window.screen.height || 1080,
                  }))
                }
                className="text-[11px] text-indigo-300 hover:underline"
              >
                自动获取
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={keyboardConfig.screenWidth}
                onChange={(e) =>
                  setKeyboardConfig((p) => ({ ...p, screenWidth: Number(e.target.value) }))
                }
                className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-white"
              />
              <input
                type="number"
                value={keyboardConfig.screenHeight}
                onChange={(e) =>
                  setKeyboardConfig((p) => ({ ...p, screenHeight: Number(e.target.value) }))
                }
                className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-white"
              />
            </div>
          </div>
        </div>

        {/* 卡片 4：蜂鸣器试音 + 固件诊断与维护 */}
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-5 text-xs">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white">
                <Music className="h-4 w-4 text-amber-400" /> 蜂鸣器试音
              </span>
              <span className="text-slate-400">音量 {buzzVol}/10</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={buzzVol}
              onChange={(e) => setBuzzVol(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
            <div className="grid grid-cols-8 gap-1">
              {NOTES.map((n) => (
                <button
                  key={n.label}
                  type="button"
                  onMouseDown={() => void playBuzzerNote(n.note, buzzVol)}
                  onMouseUp={() => void playBuzzerNote(0, 0)}
                  onMouseLeave={() => void playBuzzerNote(0, 0)}
                  className="rounded-lg border border-slate-700 bg-slate-950 py-2 font-mono text-[11px] font-semibold text-slate-200 hover:border-amber-400 hover:bg-amber-500/15"
                >
                  {n.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5 border-t border-slate-800 pt-3.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white">
                <ShieldCheck className="h-4 w-4 text-emerald-400" /> 诊断与维护
              </span>
              <button
                type="button"
                onClick={() => void refreshDiagnostics()}
                className="inline-flex items-center gap-1 text-indigo-300 hover:underline"
              >
                <RefreshCw className="h-3 w-3" /> 刷新诊断
              </button>
            </div>

            {diagnostics && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-[11px]">
                <span className={diagTotalErrors === 0 ? 'text-emerald-400' : 'text-amber-300'}>
                  {diagTotalErrors === 0 ? '健康：0 异常' : `累计 ${diagTotalErrors} 次错误记录`}
                </span>
                <span className="font-mono text-slate-400">
                  看门狗 {diagnostics.watchdogResets} · 校验 {diagnostics.checksumError}
                </span>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void triggerBuzzerMode()}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-slate-300 hover:bg-slate-800"
              >
                蜂鸣器演奏模式
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('确认向设备发送软复位命令？')) void triggerSoftReset();
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-amber-200 hover:bg-amber-500/20"
              >
                <Power className="h-3.5 w-3.5" /> 软复位
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      '高危操作：Boot 预跳转会擦除固件首扇区，执行后需重新拔插 USB 刷入固件。确认继续？',
                    )
                  ) {
                    void triggerBootloader();
                  }
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-rose-300 hover:bg-rose-500/20"
              >
                <AlertTriangle className="h-3.5 w-3.5" /> Boot 刷机
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
