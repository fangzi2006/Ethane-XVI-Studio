import {
  Cpu,
  Download,
  FlaskConical,
  Keyboard,
  Plug,
  PlugZap,
  RefreshCw,
  Save,
  Sliders,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useRef } from 'react';
import { ActiveTab, useDevice } from '../store/useDeviceStore';
import { SLOT_COUNT } from '../types/config';

export function TopBar() {
  const {
    status,
    deviceInfo,
    firmwareVersion,
    serialNumber,
    activeTab,
    setActiveTab,
    currentSlot,
    deviceActiveSlot,
    setCurrentSlot,
    isDirty,
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
    { id: 'keymap', label: '按键与控制', icon: Keyboard },
    { id: 'lighting', label: '灯效设计', icon: Sparkles },
    { id: 'device', label: '设备与系统', icon: Sliders },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3">
        {/* 左侧品牌 + 状态 */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white shadow-lg shadow-indigo-500/20">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold tracking-tight text-white">Ethane-XVI Studio</h1>
              {status === 'connected' && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  已连接 · {firmwareVersion}
                </span>
              )}
              {status === 'mock' && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-xs font-medium text-violet-300">
                  <FlaskConical className="h-3 w-3" />
                  模拟演示中 · {firmwareVersion}
                </span>
              )}
              {status === 'disconnected' && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/60 px-2.5 py-0.5 text-xs font-medium text-slate-400">
                  未连接
                </span>
              )}
            </div>
            {isConnected && (
              <p className="text-[11px] text-slate-400">
                {deviceInfo?.productName} · SN: <span className="font-mono text-slate-300">{serialNumber}</span>
              </p>
            )}
          </div>
        </div>

        {/* 中间主导航标签 */}
        {isConnected && (
          <nav className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/80 p-1">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
                    active
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </nav>
        )}

        {/* 右侧操作区 */}
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              {/* 配置槽位选择 */}
              <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs">
                <span className="text-slate-400">槽位</span>
                <select
                  value={currentSlot}
                  onChange={(e) => setCurrentSlot(Number(e.target.value))}
                  disabled={Boolean(busyText)}
                  className="bg-transparent font-semibold text-white outline-none cursor-pointer"
                >
                  {Array.from({ length: SLOT_COUNT }, (_, i) => (
                    <option key={i} value={i} className="bg-slate-900 text-slate-100">
                      配置 {i + 1} {i === deviceActiveSlot ? '(当前生效)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* 一键读取 */}
              <button
                onClick={() => void readAllFromDevice(currentSlot)}
                disabled={Boolean(busyText)}
                title="从设备一键读取当前槽位配置与全局参数"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${busyText ? 'animate-spin' : ''}`} />
                读取配置
              </button>

              {/* 一键写入 */}
              <button
                onClick={() => void writeAllToDevice('both')}
                disabled={Boolean(busyText)}
                className="relative inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-indigo-600/25 transition hover:bg-indigo-500 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                保存写入设备
                {isDirty && (
                  <span
                    className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-slate-950"
                    title="有未写入设备的修改"
                  />
                )}
              </button>

              {/* 文件导入导出快捷按钮 */}
              <div className="hidden items-center gap-1 border-l border-slate-800 pl-2 xl:flex">
                <button
                  onClick={() =>
                    activeTab === 'lighting'
                      ? lightFileRef.current?.click()
                      : cfgFileRef.current?.click()
                  }
                  title={activeTab === 'lighting' ? '导入 .etlight 灯效文件' : '导入 .etcfg 配置文件'}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                >
                  <Upload className="h-3.5 w-3.5" />
                  导入
                </button>
                <button
                  onClick={() =>
                    activeTab === 'lighting'
                      ? downloadBlob(exportEtlightBytes(), `ethane-slot${currentSlot + 1}.etlight`)
                      : downloadBlob(exportEtcfgBytes(), `ethane-slot${currentSlot + 1}.etcfg`)
                  }
                  title={activeTab === 'lighting' ? '导出 .etlight 灯效文件' : '导出 .etcfg 配置文件'}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                >
                  <Download className="h-3.5 w-3.5" />
                  导出
                </button>
              </div>

              <button
                onClick={() => void disconnect()}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-400 transition hover:border-rose-500/40 hover:text-rose-300"
              >
                <Plug className="h-3.5 w-3.5" />
                断开
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

      {/* 传输进度条 */}
      {busyText && (
        <div className="border-t border-slate-800 bg-slate-900/95 px-4 py-1.5">
          <div className="mx-auto flex max-w-[1440px] items-center gap-3 text-xs text-indigo-300">
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

      {/* 隐藏文件选择框 */}
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
