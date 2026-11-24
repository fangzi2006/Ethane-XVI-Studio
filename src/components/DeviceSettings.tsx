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
  { label: 'C3', note: 0 },
  { label: 'D3', note: 2 },
  { label: 'E3', note: 4 },
  { label: 'F3', note: 5 },
  { label: 'G3', note: 7 },
  { label: 'A3', note: 9 },
  { label: 'B3', note: 11 },
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
    pushToast,
  } = useDevice();

  const [debounceDraft, setDebounceDraft] = useState(globalParams.keyDebounce);
  const [minX, setMinX] = useState(globalParams.rockerMinX);
  const [maxX, setMaxX] = useState(globalParams.rockerMaxX);
  const [minY, setMinY] = useState(globalParams.rockerMinY);
  const [maxY, setMaxY] = useState(globalParams.rockerMaxY);
  const [capturingRange, setCapturingRange] = useState(false);
  const [buzzVol, setBuzzVol] = useState(5);
  const [showDiagDetails, setShowDiagDetails] = useState(false);

  useEffect(() => {
    setDebounceDraft(globalParams.keyDebounce);
    setMinX(globalParams.rockerMinX);
    setMaxX(globalParams.rockerMaxX);
    setMinY(globalParams.rockerMinY);
    setMaxY(globalParams.rockerMaxY);
  }, [globalParams]);

  // 自动采集摇杆极限范围
  useEffect(() => {
    if (!capturingRange || !liveInput) return;
    setMinX((prev) => Math.min(prev, liveInput.rockerX));
    setMaxX((prev) => Math.max(prev, liveInput.rockerX));
    setMinY((prev) => Math.min(prev, liveInput.rockerY));
    setMaxY((prev) => Math.max(prev, liveInput.rockerY));
  }, [capturingRange, liveInput]);

  const toggleRangeCapture = () => {
    if (!capturingRange) {
      if (!livePolling) setLivePolling(true);
      const cx = liveInput?.rockerX ?? globalParams.rockerMidX;
      const cy = liveInput?.rockerY ?? globalParams.rockerMidY;
      setMinX(cx);
      setMaxX(cx);
      setMinY(cy);
      setMaxY(cy);
      setCapturingRange(true);
      pushToast('info', '请将摇杆往上下左右推满一圈，完成后点“停止采集”');
    } else {
      setCapturingRange(false);
    }
  };

  const diagTotalErrors = diagnostics
    ? diagnostics.flagError +
      diagnostics.checksumError +
      diagnostics.watchdogResets +
      diagnostics.globalError +
      diagnostics.cfgErrors.reduce((a, b) => a + b, 0) +
      diagnostics.lightErrors.reduce((a, b) => a + b, 0)
    : 0;

  // auxMask: bit 0 = EC1, bit 1 = EC2, bit 2 = RK1
  const ec1Pressed = liveInput ? Boolean(liveInput.auxMask & 0x01) : false;
  const ec2Pressed = liveInput ? Boolean(liveInput.auxMask & 0x02) : false;
  const rkPressed = liveInput ? Boolean(liveInput.auxMask & 0x04) : false;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* 标题与实时监控总开关 */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300">
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">硬件校准与工具箱</h2>
            <p className="text-xs text-slate-400">
              摇杆中位与极限范围校准、19 路实时按键测试台、消抖/倍频、双八度试音与诊断
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
        {/* 卡片 1：摇杆可视化校准（含一键极限采集） */}
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">摇杆校准 (立即写入 Flash)</h3>
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
                {/* 范围边框可视化 */}
                <div
                  className="absolute border border-dashed border-cyan-500/50"
                  style={{
                    left: `${(minX / 4095) * 100}%`,
                    width: `${Math.max(2, ((maxX - minX) / 4095) * 100)}%`,
                    top: `${(minY / 4095) * 100}%`,
                    height: `${Math.max(2, ((maxY - minY) / 4095) * 100)}%`,
                  }}
                />
                {/* 中位标记 */}
                <div
                  className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-indigo-400"
                  style={{
                    left: `${(globalParams.rockerMidX / 4095) * 100}%`,
                    top: `${(globalParams.rockerMidY / 4095) * 100}%`,
                  }}
                />
                {/* 实时位置圆点 */}
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
                <div className="mt-2 flex flex-col gap-1">
                  <input
                    type="range"
                    min={0}
                    max={4095}
                    defaultValue={2048}
                    title="模拟摇杆 X 轴"
                    onChange={(e) => {
                      if (mockTransportRef.current) {
                        mockTransportRef.current.mockLiveInput.rockerX = Number(e.target.value);
                      }
                    }}
                    className="w-28 accent-violet-400"
                  />
                  <input
                    type="range"
                    min={0}
                    max={4095}
                    defaultValue={2048}
                    title="模拟摇杆 Y 轴"
                    onChange={(e) => {
                      if (mockTransportRef.current) {
                        mockTransportRef.current.mockLiveInput.rockerY = Number(e.target.value);
                      }
                    }}
                    className="w-28 accent-violet-400"
                  />
                </div>
              )}
            </div>

            <div className="flex-1 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">
                  中位：
                  <strong className="font-mono text-white">
                    ({globalParams.rockerMidX}, {globalParams.rockerMidY})
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={toggleRangeCapture}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                    capturingRange
                      ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200 animate-pulse'
                      : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-cyan-400'
                  }`}
                >
                  {capturingRange ? '停止极值采集' : '自动采集推满极值'}
                </button>
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
                保存摇杆活动范围
              </button>
            </div>
          </div>
        </div>

        {/* 卡片 2：19 路实时按键测试台 + 双旋钮计数 */}
        <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">19 路硬件输入测试台</h3>
            <span className="font-mono text-xs text-slate-400">
              EC1: {liveInput?.ec1Count ?? '--'} · EC2: {liveInput?.ec2Count ?? '--'}
            </span>
          </div>

          {/* 3 路辅助按键状态（摇杆下压 / EC2下压 / EC1下压） */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: '摇杆按下', active: rkPressed },
              { label: '旋钮2按下', active: ec2Pressed },
              { label: '旋钮1按下', active: ec1Pressed },
            ].map((aux) => (
              <div
                key={aux.label}
                className={`rounded-lg border py-1.5 text-center text-[11px] font-medium transition ${
                  aux.active
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                    : 'border-slate-800 bg-slate-950 text-slate-500'
                }`}
              >
                {aux.label}
              </div>
            ))}
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
                  className={`flex h-9 items-center justify-center rounded-lg border font-mono text-xs font-semibold transition select-none ${
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
            开启右上角“实时硬件测试”后，按下任意机械键、旋钮或摇杆按键即可实时点亮（模拟模式下可直接点按测试）。
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
              <span className="text-[11px] text-slate-500">按下零延迟触发，仅抑制松手抖动</span>
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
              <div className="text-[11px] text-slate-500">拧两格才触发一次时勾选对应旋钮</div>
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
                <Monitor className="h-3.5 w-3.5 text-indigo-400" /> 屏幕分辨率 (当前层定位点击用)
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

        {/* 卡片 4：双八度蜂鸣器迷你钢琴 + 固件诊断与维护 */}
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-5 text-xs">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white">
                <Music className="h-4 w-4 text-amber-400" /> 双八度蜂鸣器试音台
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
            <div className="grid grid-cols-5 gap-1 sm:grid-cols-8">
              {NOTES.map((n) => (
                <button
                  key={n.label}
                  type="button"
                  onMouseDown={() => void playBuzzerNote(n.note, buzzVol)}
                  onMouseUp={() => void playBuzzerNote(0, 0)}
                  onMouseLeave={() => void playBuzzerNote(0, 0)}
                  className="rounded-lg border border-slate-700 bg-slate-950 py-1.5 font-mono text-[10px] font-semibold text-slate-200 hover:border-amber-400 hover:bg-amber-500/15"
                >
                  {n.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5 border-t border-slate-800 pt-3.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white">
                <ShieldCheck className="h-4 w-4 text-emerald-400" /> 固件诊断与维护
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
              <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/70 p-2.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className={diagTotalErrors === 0 ? 'text-emerald-400' : 'text-amber-300'}>
                    {diagTotalErrors === 0 ? '健康：0 异常' : `累计 ${diagTotalErrors} 次错误记录`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowDiagDetails((v) => !v)}
                    className="text-indigo-300 hover:underline"
                  >
                    {showDiagDetails ? '收起明细' : '查看 8 槽位明细'}
                  </button>
                </div>
                <div className="font-mono text-slate-400">
                  看门狗 {diagnostics.watchdogResets} (连续 {diagnostics.consecutiveWatchdogResets}) ·
                  标志 {diagnostics.flagError} · 校验 {diagnostics.checksumError} · 全局{' '}
                  {diagnostics.globalError}
                </div>
                {showDiagDetails && (
                  <div className="space-y-1 border-t border-slate-800 pt-1.5 font-mono text-[10px] text-slate-400">
                    <div>配置槽错误: [{diagnostics.cfgErrors.join(', ')}]</div>
                    <div>灯效槽错误: [{diagnostics.lightErrors.join(', ')}]</div>
                    <div>
                      最后错误位置码: 0x{diagnostics.lastErrorPos.toString(16).padStart(2, '0')}（
                      {diagnostics.lastErrorPos === 0
                        ? '标志初始化'
                        : diagnostics.lastErrorPos === 1
                          ? '诊断区校验错误'
                          : diagnostics.lastErrorPos === 4
                            ? '看门狗复位'
                            : diagnostics.lastErrorPos === 5
                              ? '连续看门狗复位'
                              : diagnostics.lastErrorPos >= 8 && diagnostics.lastErrorPos <= 15
                                ? `L${diagnostics.lastErrorPos - 7} 按键配置存储校验失败`
                                : diagnostics.lastErrorPos >= 16 && diagnostics.lastErrorPos <= 23
                                  ? `L${diagnostics.lastErrorPos - 15} 灯效配置存储校验失败`
                                  : diagnostics.lastErrorPos === 24
                                    ? '全局参数存储校验失败'
                                    : '未知位置'}
                      ）
                    </div>
                    <div className="font-sans text-[10px] text-slate-500">
                      注：诊断计数为芯片 Flash 历史累计值，不会随断电清零。
                    </div>
                  </div>
                )}
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
