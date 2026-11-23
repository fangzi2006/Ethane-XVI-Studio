import {
  AlertTriangle,
  Check,
  Cpu,
  Download,
  FlaskConical,
  Keyboard,
  Layers,
  Plug,
  PlugZap,
  RefreshCw,
  Save,
  Sliders,
  Sparkles,
  Star,
  Upload,
  X,
} from 'lucide-react';
import { useRef } from 'react';
import { ActiveTab, useDevice } from '../store/useDeviceStore';
import { SLOT_COUNT } from '../types/config';

export function TopBar() {
  const {
    status,
    firmwareVersion,
    serialNumber,
    firmwareSupportsReadback,
    legacyNoticeDismissed,
    dismissLegacyNotice,
    activeTab,
    setActiveTab,
    currentSlot,
    deviceActiveSlot,
    setCurrentSlot,
    switchDeviceSlot,
    keyboardConfig,
    setKeyboardConfig,
    isDirty,
    dirtySlots,
    busyText,
    busyProgress,
    connectWebHid,
    connectMock,
    disconnect,
    readAllFromDevice,
    writeAllToDevice,
    importEtcfgBytes,
    exportEtcfgBytes,
    importEtlightBytes,
    exportEtlightBytes,
  } = useDevice();

  const cfgFileRef = useRef<HTMLInputElement>(null);
  const lightFileRef = useRef<HTMLInputElement>(null);

  const isConnected = status === 'connected' || status === 'mock';

  const downloadBlob = (bytes: Uint8Array, filename: string) => {
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs: { id: ActiveTab; label: string; icon: typeof Keyboard }[] = [
    { id: 'keymap', label: '键位映射', icon: Keyboard },
    { id: 'lighting', label: '灯效设计', icon: Sparkles },
    { id: 'device', label: '设备校准', icon: Sliders },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/95 backdrop-blur-md">
      {/* 第一行：主导航与读写操作 */}
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white shadow-md shadow-indigo-500/20">
            <Cpu className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold tracking-tight text-white">Ethane-XVI</h1>
            {status === 'connected' && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {firmwareVersion} · {serialNumber.slice(-6)}
              </span>
            )}
            {status === 'mock' && (
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-300">
                <FlaskConical className="h-3 w-3" />
                模拟模式
              </span>
            )}
          </div>
        </div>

        {/* 主功能切换 */}
        {isConnected && (
          <nav className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    active
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </nav>
        )}

        {/* 右侧主操作 */}
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <button
                onClick={() => {
                  if (
                    isDirty &&
                    !window.confirm(`第 ${currentSlot + 1} 层有尚未写入设备的修改，读取将覆盖这些修改，确认继续？`)
                  ) {
                    return;
                  }
                  void readAllFromDevice(currentSlot);
                }}
                disabled={Boolean(busyText)}
                title="从设备手动读取当前层配置（需新版固件，旧版固件自动恢复本地缓存）"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${busyText ? 'animate-spin' : ''}`} />
                读取 L{currentSlot + 1}
              </button>

              <button
                onClick={() => void writeAllToDevice('both')}
                disabled={Boolean(busyText)}
                className="relative inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-indigo-600/25 transition hover:bg-indigo-500 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                写入第 {currentSlot + 1} 层
                {isDirty && (
                  <span
                    className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-slate-950"
                    title="有未写入设备的修改"
                  />
                )}
              </button>

              <div className="hidden items-center gap-1 border-l border-slate-800 pl-2 lg:flex">
                <button
                  onClick={() =>
                    activeTab === 'lighting'
                      ? lightFileRef.current?.click()
                      : cfgFileRef.current?.click()
                  }
                  title={activeTab === 'lighting' ? '导入 .etlight 文件' : '导入 .etcfg 文件'}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                >
                  <Upload className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() =>
                    activeTab === 'lighting'
                      ? downloadBlob(exportEtlightBytes(), `ethane-layer${currentSlot + 1}.etlight`)
                      : downloadBlob(exportEtcfgBytes(), `ethane-layer${currentSlot + 1}.etcfg`)
                  }
                  title={activeTab === 'lighting' ? '导出 .etlight 文件' : '导出 .etcfg 文件'}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              </div>

              <button
                onClick={() => void disconnect()}
                title="断开连接"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-400 transition hover:border-rose-500/40 hover:text-rose-300"
              >
                <Plug className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => void connectMock()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-200 transition hover:bg-violet-500/20"
              >
                <FlaskConical className="h-3.5 w-3.5" />
                演示/模拟设备
              </button>
              <button
                onClick={() => void connectWebHid()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500"
              >
                <PlugZap className="h-3.5 w-3.5" />
                连接设备
              </button>
            </>
          )}
        </div>
      </div>

      {/* 第二行：统一配置层切换条（仅在键位映射与灯效设计页显示） */}
      {isConnected && activeTab !== 'device' && (
        <div className="border-t border-slate-800/70 bg-slate-900/60">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2 px-4 py-1.5 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                <Layers className="h-3.5 w-3.5 text-indigo-400" />
                配置层
              </span>
              {Array.from({ length: SLOT_COUNT }, (_, i) => {
                const isEditing = currentSlot === i;
                const isHardwareActive = deviceActiveSlot === i;
                const slotDirty = dirtySlots[i];
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={Boolean(busyText)}
                    onClick={() => setCurrentSlot(i)}
                    className={`relative flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                      isEditing
                        ? 'border-indigo-400 bg-indigo-600/25 text-white'
                        : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {isHardwareActive && (
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                        title="设备当前正在使用此配置层"
                      />
                    )}
                    <span>L{i + 1}</span>
                    {slotDirty && (
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-amber-400"
                        title="此层有未写入设备的修改"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              {deviceActiveSlot !== currentSlot ? (
                <button
                  type="button"
                  onClick={() => void switchDeviceSlot(currentSlot)}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20"
                >
                  <Check className="h-3 w-3" />
                  让键盘立即切换至 L{currentSlot + 1}
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 text-[11px] text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  键盘当前生效中
                </span>
              )}

              <button
                type="button"
                onClick={() =>
                  setKeyboardConfig((p) => ({ ...p, priority: !p.priority }))
                }
                title="勾选后，小键盘上电启动将默认优先激活本配置层"
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                  keyboardConfig.priority
                    ? 'border-amber-400/40 bg-amber-500/15 text-amber-200'
                    : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Star
                  className={`h-3 w-3 ${keyboardConfig.priority ? 'fill-amber-300 text-amber-300' : ''}`}
                />
                开机默认优先
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 旧版固件不支持直接读取配置的明确提示横幅 */}
      {isConnected && firmwareSupportsReadback === false && !legacyNoticeDismissed && (
        <div className="border-t border-amber-500/30 bg-amber-950/60 px-4 py-2">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
              <span>
                <strong>旧版固件提示：</strong>
                当前固件（{firmwareVersion}）暂不支持从设备 Flash 直接读取按键与灯效配置，已自动载入本地缓存。如需使用“一键读取配置”功能，请重新编译并烧录本仓库更新后的 CH549 固件。
              </span>
            </div>
            <button
              type="button"
              onClick={dismissLegacyNotice}
              className="rounded p-1 text-amber-300 hover:bg-amber-900/50"
              title="收起提示"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 传输进度条 */}
      {busyText && (
        <div className="border-t border-slate-800 bg-slate-900/95 px-4 py-1.5">
          <div className="mx-auto flex max-w-[1400px] items-center gap-3 text-xs text-indigo-300">
            <span className="shrink-0">{busyText}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-150"
                style={{ width: `${busyProgress ?? 30}%` }}
              />
            </div>
            {busyProgress !== null && <span className="font-mono text-slate-400">{busyProgress}%</span>}
          </div>
        </div>
      )}

      <input
        ref={cfgFileRef}
        type="file"
        accept=".etcfg"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) {
            importEtcfgBytes(new Uint8Array(await file.arrayBuffer()));
            e.target.value = '';
          }
        }}
      />
      <input
        ref={lightFileRef}
        type="file"
        accept=".etlight"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) {
            importEtlightBytes(new Uint8Array(await file.arrayBuffer()));
            e.target.value = '';
          }
        }}
      />
    </header>
  );
}
