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
import { SLOT_COUNT } from '../types/config';

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
    deviceActiveSlot,
    switchDeviceSlot,
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300">
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">设备与系统中心</h2>
            <p className="text-xs text-slate-400">
              管理配置槽位、屏幕参数、全局硬件校准、实时输入检测与诊断维护
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setLivePolling(!livePolling)}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
            livePolling
              ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300'
              : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
          }`}
        >
          <Activity className={`h-3.5 w-3.5 ${livePolling ? 'animate-pulse' : ''}`} />
          {livePolling ? '停止实时输入监控' : '开启实时输入监控'}
        </button>
      </div>

      {/* 1. 配置槽位与本套基础参数 */}
      <div className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200">立即切换设备生效配置槽 (实时生效)</span>
            <span className="text-slate-400">当前硬件激活：槽位 {deviceActiveSlot + 1}</span>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {Array.from({ length: SLOT_COUNT }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => void switchDeviceSlot(i)}
                className={`rounded-lg border py-1.5 text-xs font-semibold transition ${
                  deviceActiveSlot === i
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                    : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-600'
                }`}
              >
                槽位 {i + 1}
              </button>
            ))}
          </div>
        </div>

        <label className="space-y-1.5 text-xs">
          <span className="font-medium text-slate-300">键盘摆放旋转方向</span>
          <select
            value={keyboardConfig.orientation}
            onChange={(e) =>
              setKeyboardConfig((p) => ({ ...p, orientation: Number(e.target.value) }))
            }
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
          >
            <option value={0}>正常（USB-C 接口朝上）</option>
            <option value={1}>右旋 90°</option>
            <option value={2}>旋转 180°</option>
            <option value={3}>左旋 90°</option>
          </select>
        </label>

        <div className="flex items-end">
          <label className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-3.5 py-2.5 text-xs text-slate-200 cursor-pointer">
            <span>上电默认优先使用本配置</span>
            <input
              type="checkbox"
              checked={keyboardConfig.priority}
              onChange={(e) => setKeyboardConfig((p) => ({ ...p, priority: e.target.checked }))}
              className="h-4 w-4 accent-indigo-500"
            />
          </label>
        </div>

        {/* 屏幕宽高 */}
        <div className="space-y-2 sm:col-span-2">
          <div className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-300">
              <Monitor className="h-3.5 w-3.5 text-indigo-400" />
              屏幕分辨率（用于光标移位/点击与摇杆绝对光标模式）
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
              自动填入当前屏幕 ({window.screen.width}×{window.screen.height})
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              min={1}
              max={65535}
              value={keyboardConfig.screenWidth}
              onChange={(e) =>
                setKeyboardConfig((p) => ({ ...p, screenWidth: Number(e.target.value) }))
              }
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            />
            <input
              type="number"
              min={1}
              max={65535}
              value={keyboardConfig.screenHeight}
              onChange={(e) =>
                setKeyboardConfig((p) => ({ ...p, screenHeight: Number(e.target.value) }))
              }
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            />
          </div>
        </div>
      </div>

      {/* 2. 全局硬件参数：摇杆校准 + 按键消抖 + 旋钮倍频（实时写入 Flash） */}
      <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-200">
            硬件全局参数（修改后立即写入设备 Flash）
          </h3>
          {liveInput && (
            <span className="font-mono text-[11px] text-emerald-300">
              ADC: ({liveInput.rockerX}, {liveInput.rockerY}) · EC1:{liveInput.ec1Count} EC2:{liveInput.ec2Count}
            </span>
          )}
        </div>

        {/* 摇杆校准 */}
        <div className="grid gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 sm:grid-cols-12">
          <div className="flex flex-col items-center justify-center sm:col-span-4">
            <div className="relative h-28 w-28 rounded-xl border border-slate-700 bg-slate-900">
              {/* 十字准星 */}
              <div className="absolute inset-x-0 top-1/2 h-px bg-slate-800" />
              <div className="absolute inset-y-0 left-1/2 w-px bg-slate-800" />
              {/* 中位标记 */}
              <div
                className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-indigo-400"
                style={{
                  left: `${(globalParams.rockerMidX / 4095) * 100}%`,
                  top: `${(globalParams.rockerMidY / 4095) * 100}%`,
                }}
              />
              {/* 实时圆点 */}
              <div
                className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50"
                style={{
                  left: `${((liveInput?.rockerX ?? globalParams.rockerMidX) / 4095) * 100}%`,
                  top: `${((liveInput?.rockerY ?? globalParams.rockerMidY) / 4095) * 100}%`,
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => void calibrateRockerMid()}
              className="mt-2.5 inline-flex items-center gap-1 rounded-lg bg-indigo-600/25 px-3 py-1.5 text-[11px] font-semibold text-indigo-200 hover:bg-indigo-600/35"
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

          <div className="space-y-3 sm:col-span-8 text-xs">
            <div className="text-slate-300">
              当前中位：<strong className="font-mono text-white">({globalParams.rockerMidX}, {globalParams.rockerMidY})</strong>
              <span className="ml-2 text-slate-500">请保证摇杆回中后再点中位校准</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="space-y-1">
                <span className="text-slate-400">X 下限 (Min0)</span>
                <input
                  type="number"
                  min={0}
                  max={4094}
                  value={minX}
                  onChange={(e) => setMinX(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-white"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-400">X 上限 (Max0)</span>
                <input
                  type="number"
                  min={1}
                  max={4095}
                  value={maxX}
                  onChange={(e) => setMaxX(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-white"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-400">Y 下限 (Min1)</span>
                <input
                  type="number"
                  min={0}
                  max={4094}
                  value={minY}
                  onChange={(e) => setMinY(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-white"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-400">Y 上限 (Max1)</span>
                <input
                  type="number"
                  min={1}
                  max={4095}
                  value={maxY}
                  onChange={(e) => setMaxY(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-white"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => void applyRockerRange(minX, maxX, minY, maxY)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 font-medium text-slate-200 hover:bg-slate-700"
            >
              保存摇杆活动范围
            </button>
          </div>
        </div>

        {/* 按键消抖 + 旋钮倍频 */}
        <div className="grid gap-4 sm:grid-cols-2 text-xs">
          <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
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
              <span className="text-[11px] text-slate-500">立即触发，仅抑制释放/连击抖动</span>
              <button
                type="button"
                onClick={() => void applyKeyDebounce(debounceDraft)}
                className="rounded-lg bg-indigo-600/20 px-2.5 py-1 font-medium text-indigo-200 hover:bg-indigo-600/30"
              >
                应用
              </button>
            </div>
          </div>

          <div className="space-y-2.5 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
            <div className="font-medium text-slate-200">旋钮 2 脉冲倍频适配</div>
            <p className="text-[11px] text-slate-500">
              若某旋钮转两格才触发一次，请开启对应旋钮倍频
            </p>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={globalParams.ec1DoubleFreq}
                  onChange={(e) =>
                    void applyEncoderDoubleFreq(e.target.checked, globalParams.ec2DoubleFreq)
                  }
                />
                旋钮 1 (右侧)
              </label>
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={globalParams.ec2DoubleFreq}
                  onChange={(e) =>
                    void applyEncoderDoubleFreq(globalParams.ec1DoubleFreq, e.target.checked)
                  }
                />
                旋钮 2 (中间)
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* 3. 蜂鸣器试音 + 诊断与维护 */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* 蜂鸣器试音 */}
        <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-200">
              <Music className="h-4 w-4 text-amber-400" /> 蜂鸣器实时试音 (BBTV)
            </span>
            <span className="text-slate-400">音量 {buzzVol}</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={buzzVol}
            onChange={(e) => setBuzzVol(Number(e.target.value))}
            className="w-full accent-amber-500"
          />
          <div className="grid grid-cols-4 gap-1.5">
            {NOTES.map((n) => (
              <button
                key={n.label}
                type="button"
                onMouseDown={() => void playBuzzerNote(n.note, buzzVol)}
                onMouseUp={() => void playBuzzerNote(0, 0)}
                onMouseLeave={() => void playBuzzerNote(0, 0)}
                className="rounded-lg border border-slate-700 bg-slate-950 py-2 font-mono font-semibold text-slate-200 hover:border-amber-400 hover:bg-amber-500/15"
              >
                {n.label}
              </button>
            ))}
          </div>
        </div>

        {/* 诊断与高危维护 */}
        <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-200">
              <ShieldCheck className="h-4 w-4 text-emerald-400" /> 固件诊断与维护
            </span>
            <button
              type="button"
              onClick={() => void refreshDiagnostics()}
              className="inline-flex items-center gap-1 text-indigo-300 hover:underline"
            >
              <RefreshCw className="h-3 w-3" /> 读取诊断
            </button>
          </div>

          {diagnostics ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">综合健康状态</span>
                <span className={diagTotalErrors === 0 ? 'text-emerald-400' : 'text-amber-300'}>
                  {diagTotalErrors === 0 ? '全部正常 (0 异常)' : `累计 ${diagTotalErrors} 次记录`}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>看门狗重启 / 连续重启</span>
                <span className="font-mono text-slate-200">
                  {diagnostics.watchdogResets} / {diagnostics.consecutiveWatchdogResets}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>标志 / 校验 / 全局存储错误</span>
                <span className="font-mono text-slate-200">
                  {diagnostics.flagError} / {diagnostics.checksumError} / {diagnostics.globalError}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500">点击右上角“读取诊断”查看看门狗与 Flash 写入健康统计。</p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => void triggerBuzzerMode()}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-slate-300 hover:bg-slate-800"
            >
              进入蜂鸣器演奏模式
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('确认向设备发送软复位命令？')) {
                  void triggerSoftReset();
                }
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
                    '高危操作：Boot 预跳转会擦除固件首扇区，执行后需要重新拔插 USB 并使用烧录工具刷入固件。确认继续？',
                  )
                ) {
                  void triggerBootloader();
                }
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-rose-300 hover:bg-rose-500/20"
            >
              <AlertTriangle className="h-3.5 w-3.5" /> Boot 刷机模式
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
