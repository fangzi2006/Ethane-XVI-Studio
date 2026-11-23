import {
  ChevronDown,
  Cpu,
  FlaskConical,
  Gamepad2,
  Keyboard,
  PlugZap,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { useState } from 'react';
import { isWebHidSupported } from '../services/transport';
import { useDevice } from '../store/useDeviceStore';
import { DEFAULT_PID, DEFAULT_VID } from '../types/config';

export function WelcomeScreen() {
  const { connectWebHid, connectMock } = useDevice();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [vid, setVid] = useState(DEFAULT_VID);
  const [pid, setPid] = useState(DEFAULT_PID);
  const webHidOk = isWebHidSupported();

  return (
    <main className="mx-auto flex min-h-[calc(100vh-64px)] max-w-5xl flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-blue-500 to-cyan-400 text-white shadow-xl shadow-indigo-500/25">
          <Cpu className="h-9 w-9" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Ethane-XVI 可视化配置中心
        </h2>
        <p className="mt-3 max-w-xl text-sm text-slate-400 sm:text-base">
          面向日常使用重新设计的网页版上位机。直接点选键帽改键、积木式编排宏指令、所见即所得调试 RGB 灯效与摇杆校准。
        </p>
      </div>

      {/* 主操作双卡片 */}
      <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-2">
        <div className="flex flex-col justify-between rounded-2xl border border-indigo-500/30 bg-slate-900/80 p-6 shadow-xl">
          <div>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400">
              <PlugZap className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-white">连接实体小键盘</h3>
            <p className="mt-1.5 text-sm text-slate-400">
              通过浏览器 WebHID 直连 Ethane-XVI（VID 0x1A86 / PID 0x5884），即插即用，无需安装额外驱动。
            </p>
            {!webHidOk && (
              <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                当前浏览器不支持 WebHID，请使用最新版 Chrome / Edge，或使用右侧“模拟设备”。
              </p>
            )}
          </div>
          <div className="mt-6">
            <button
              onClick={() => void connectWebHid(vid, pid)}
              disabled={!webHidOk}
              className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              选择并连接设备
            </button>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-violet-500/30 bg-slate-900/80 p-6 shadow-xl">
          <div>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
              <FlaskConical className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-white">演示 / 模拟设备</h3>
            <p className="mt-1.5 text-sm text-slate-400">
              手边没有小键盘？启动内置虚拟 CH549 硬件模拟器，完整体验改键、宏编排、灯效刷色与读写流程，也支持导入导出原版配置文件。
            </p>
          </div>
          <div className="mt-6">
            <button
              onClick={() => void connectMock()}
              className="w-full rounded-xl border border-violet-500/40 bg-violet-500/15 px-4 py-2.5 text-sm font-semibold text-violet-200 transition hover:bg-violet-500/25"
            >
              进入模拟演示模式
            </button>
          </div>
        </div>
      </div>

      {/* 高级 VID/PID 折叠 */}
      <div className="mt-6 w-full max-w-3xl">
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className="mx-auto flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-slate-300"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition ${showAdvanced ? 'rotate-180' : ''}`} />
          高级连接选项（自定义 VID / PID）
        </button>
        {showAdvanced && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs">
            <label className="flex items-center gap-2 text-slate-300">
              <span>VID (十进制):</span>
              <input
                type="number"
                value={vid}
                onChange={(e) => setVid(Number(e.target.value))}
                className="w-24 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-white"
              />
            </label>
            <label className="flex items-center gap-2 text-slate-300">
              <span>PID (十进制):</span>
              <input
                type="number"
                value={pid}
                onChange={(e) => setPid(Number(e.target.value))}
                className="w-24 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-white"
              />
            </label>
          </div>
        )}
      </div>

      {/* 特性概览 */}
      <div className="mt-12 grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: Keyboard, title: '16 键可视化', desc: '10 种模式所见即所得' },
          { icon: Gamepad2, title: '摇杆与双旋钮', desc: '支持 Dial 与范围校准' },
          { icon: Sparkles, title: 'RGB 实时刷色', desc: '上/下双层灯效与仿真' },
          { icon: Wrench, title: '全格式兼容', desc: '兼容 .etcfg / .etlight' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3.5 text-center"
            >
              <Icon className="mx-auto mb-2 h-5 w-5 text-slate-400" />
              <div className="text-xs font-medium text-slate-200">{item.title}</div>
              <div className="mt-0.5 text-[11px] text-slate-500">{item.desc}</div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
