import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { useState } from 'react';
import { DeviceSettings } from './components/DeviceSettings';
import { KeyEditor } from './components/KeyEditor';
import { KeypadPreview } from './components/KeypadPreview';
import { LightingEditor } from './components/LightingEditor';
import { TopBar } from './components/TopBar';
import { WelcomeScreen } from './components/WelcomeScreen';
import { DeviceProvider, useDevice } from './store/useDeviceStore';
import { RgbTuple } from './types/config';

function Workspace() {
  const { status, activeTab, setLightConfig, toasts } = useDevice();
  const [lightSubTab, setLightSubTab] = useState<'keys' | 'sysled'>('keys');
  const [paintMode, setPaintMode] = useState(false);
  const [lightLayer, setLightLayer] = useState<'up' | 'down'>('up');
  const [brushColor, setBrushColor] = useState<RgbTuple>([0, 110, 140]);

  const isConnected = status === 'connected' || status === 'mock';

  const handlePaintKey = (keyIdx: number) => {
    setLightConfig((prev) => {
      const field = lightLayer === 'up' ? 'upColors' : 'downColors';
      const nextColors = [...prev[field]];
      nextColors[keyIdx] = [...brushColor] as RgbTuple;
      return { ...prev, [field]: nextColors };
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <TopBar />

      {!isConnected ? (
        <WelcomeScreen />
      ) : activeTab === 'device' ? (
        <main className="mx-auto max-w-[1400px] px-4 py-6">
          <DeviceSettings />
        </main>
      ) : (
        <main className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 lg:grid-cols-12">
          <aside className="lg:col-span-5 xl:col-span-4">
            <div className="lg:sticky lg:top-28">
              <KeypadPreview
                mode={activeTab === 'lighting' ? 'lighting' : 'keymap'}
                paintMode={paintMode}
                onPaintKey={handlePaintKey}
                onSelectLed={() => setLightSubTab('sysled')}
                lightingLayer={lightLayer}
              />
            </div>
          </aside>

          <section className="rounded-3xl border border-slate-800/90 bg-slate-900/40 p-5 shadow-xl lg:col-span-7 xl:col-span-8">
            {activeTab === 'keymap' && <KeyEditor />}
            {activeTab === 'lighting' && (
              <LightingEditor
                subTab={lightSubTab}
                setSubTab={setLightSubTab}
                paintMode={paintMode}
                setPaintMode={setPaintMode}
                layer={lightLayer}
                setLayer={setLightLayer}
                brushColor={brushColor}
                setBrushColor={setBrushColor}
              />
            )}
          </section>
        </main>
      )}

      {/* 全局 Toast 提示 */}
      <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col gap-2">
        {toasts.map((t) => {
          const styles = {
            success: 'border-emerald-500/40 bg-emerald-950/90 text-emerald-100',
            error: 'border-rose-500/40 bg-rose-950/90 text-rose-100',
            warning: 'border-amber-500/40 bg-amber-950/90 text-amber-100',
            info: 'border-indigo-500/40 bg-indigo-950/90 text-indigo-100',
          }[t.type];
          const Icon = {
            success: CheckCircle2,
            error: XCircle,
            warning: AlertTriangle,
            info: Info,
          }[t.type];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-xl border px-4 py-3 text-xs font-medium shadow-2xl backdrop-blur-md ${styles}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <DeviceProvider>
      <Workspace />
    </DeviceProvider>
  );
}
