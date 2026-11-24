import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { useState } from 'react';
import { DeviceSettings } from './components/DeviceSettings';
import { KeyEditor } from './components/KeyEditor';
import { KeypadPreview } from './components/KeypadPreview';
import { LightingEditor } from './components/LightingEditor';
import { ProfileManager } from './components/ProfileManager';
import { TopBar } from './components/TopBar';
import { WelcomeScreen } from './components/WelcomeScreen';
import { DeviceProvider, useDevice } from './store/useDeviceStore';
import { KEY_NUM, KeyConfig, RgbTuple } from './types/config';

function Workspace() {
  const { status, activeTab, setLightConfig, toasts } = useDevice();
  const [paintMode, setPaintMode] = useState(false);
  const [lightLayer, setLightLayer] = useState<'up' | 'down'>('up');
  const [brushColor, setBrushColor] = useState<RgbTuple>([0, 110, 140]);
  const [selectedKeys, setSelectedKeys] = useState<Set<number>>(() => new Set([0]));
  const [draftKeyPreview, setDraftKeyPreview] = useState<{
    index: number;
    config: KeyConfig;
  } | null>(null);

  const isConnected = status === 'connected' || status === 'mock';

  const handlePaintKey = (keyIdx: number) => {
    setLightConfig((prev) => {
      const field = lightLayer === 'up' ? 'upColors' : 'downColors';
      const nextColors = [...prev[field]];
      nextColors[keyIdx] = [...brushColor] as RgbTuple;
      return { ...prev, [field]: nextColors };
    });
  };

  const handleToggleKeySelect = (keyIdx: number, multi: boolean) => {
    setSelectedKeys((prev) => {
      if (!multi) return new Set([keyIdx]);
      const next = new Set(prev);
      if (next.has(keyIdx)) {
        if (next.size > 1) next.delete(keyIdx);
      } else {
        next.add(keyIdx);
      }
      return next;
    });
  };

  const handleSelectAllKeys = () => {
    setSelectedKeys(new Set(Array.from({ length: KEY_NUM }, (_, i) => i)));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <TopBar />

      {!isConnected ? (
        <WelcomeScreen />
      ) : activeTab === 'device' ? (
        <main className="mx-auto max-w-[1440px] px-4 py-6">
          <DeviceSettings />
        </main>
      ) : activeTab === 'profiles' ? (
        <main className="mx-auto max-w-[1440px] px-4 py-6">
          <ProfileManager />
        </main>
      ) : (
        <main className="mx-auto grid max-w-[1440px] gap-6 px-4 py-6 lg:grid-cols-12">
          <aside className="lg:col-span-5 xl:col-span-4">
            <div className="lg:sticky lg:top-28">
              <KeypadPreview
                mode={activeTab === 'lighting' ? 'lighting' : 'keymap'}
                paintMode={paintMode}
                onPaintKey={handlePaintKey}
                lightingLayer={lightLayer}
                selectedKeys={activeTab === 'lighting' ? selectedKeys : undefined}
                onToggleKeySelect={activeTab === 'lighting' ? handleToggleKeySelect : undefined}
                draftKeyPreview={activeTab === 'keymap' ? draftKeyPreview : null}
              />
            </div>
          </aside>

          <section className="rounded-3xl border border-slate-800/90 bg-slate-900/40 p-5 shadow-xl lg:col-span-7 xl:col-span-8">
            {activeTab === 'keymap' && <KeyEditor onDraftKeyPreview={setDraftKeyPreview} />}
            {activeTab === 'lighting' && (
              <LightingEditor
                paintMode={paintMode}
                setPaintMode={setPaintMode}
                layer={lightLayer}
                setLayer={setLightLayer}
                brushColor={brushColor}
                setBrushColor={setBrushColor}
                selectedKeys={selectedKeys}
                onSelectAllKeys={handleSelectAllKeys}
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
