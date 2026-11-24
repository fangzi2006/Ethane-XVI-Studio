import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  DiagnosticData,
  GlobalParams,
  KeyboardConfig,
  LightConfig,
  LiveInputState,
  SLOT_COUNT,
  SlotMeta,
  createDefaultGlobalParams,
  createDefaultKeyboardConfig,
  createDefaultLightConfig,
} from '../types/config';
import {
  EthaneProtocolClient,
  InvalidCommandError,
  decodeKeyboardConfig,
  decodeLightConfig,
  encodeKeyboardConfig,
  encodeLightConfig,
} from '../services/protocol';
import {
  DeviceInfo,
  ITransport,
  MockTransport,
  TransportStatus,
  WebHidTransport,
} from '../services/transport';

export type SelectionTarget =
  | { kind: 'key'; index: number }
  | { kind: 'rocker' }
  | { kind: 'encoder'; index: 0 | 1 } // 0=EC1(右), 1=EC2(中)
  | { kind: 'led' };

export type ActiveTab = 'keymap' | 'lighting' | 'profiles' | 'device';

export interface ToastItem {
  id: number;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

const STORAGE_PREFIX = 'ethane-xvi-studio-v1';

const DEFAULT_SLOT_NAMES = [
  '日常效率',
  '影音媒体',
  '剪辑创作',
  '游戏娱乐',
  '配置层 5',
  '配置层 6',
  '配置层 7',
  '配置层 8',
];

function createDefaultSlotMetas(): SlotMeta[] {
  return DEFAULT_SLOT_NAMES.map((name) => ({ name }));
}

function loadLocalSlot<T>(serial: string, kind: 'cfg' | 'light', slot: number): T | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}:${serial}:${kind}:${slot}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function saveLocalSlot(serial: string, kind: 'cfg' | 'light', slot: number, data: unknown) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}:${serial}:${kind}:${slot}`, JSON.stringify(data));
  } catch {
    // ignore quota error
  }
}

function loadSlotMetas(serial: string): SlotMeta[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}:${serial}:metas`);
    if (!raw) return createDefaultSlotMetas();
    const parsed = JSON.parse(raw) as SlotMeta[];
    if (!Array.isArray(parsed) || parsed.length !== SLOT_COUNT) return createDefaultSlotMetas();
    return parsed.map((m, i) => ({ name: m?.name?.trim() || DEFAULT_SLOT_NAMES[i] }));
  } catch {
    return createDefaultSlotMetas();
  }
}

function saveSlotMetas(serial: string, metas: SlotMeta[]) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}:${serial}:metas`, JSON.stringify(metas));
  } catch {
    // ignore quota error
  }
}

/**
 * 将单层键盘配置 + 灯效配置生成稳定的二进制签名，用于精确判断“是否真正有改动”。
 * 即使改完后又改回原样，签名也会恢复一致，彻底消除黄点误导。
 */
function computeSlotSignature(cfg: KeyboardConfig, light: LightConfig): string {
  try {
    const cfgBytes = encodeKeyboardConfig(cfg);
    const lightBytes = encodeLightConfig(light);
    return `${cfgBytes.join(',')}|${lightBytes.join(',')}`;
  } catch {
    return JSON.stringify({ cfg, light });
  }
}

interface DeviceContextValue {
  status: TransportStatus;
  deviceInfo: DeviceInfo | null;
  firmwareVersion: string;
  serialNumber: string;
  firmwareSupportsReadback: boolean | null;
  legacyNoticeDismissed: boolean;
  dismissLegacyNotice: () => void;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  selection: SelectionTarget;
  setSelection: (sel: SelectionTarget) => void;

  currentSlot: number; // 0..7
  deviceActiveSlot: number;
  setCurrentSlot: (slot: number) => void;

  slotCfgs: KeyboardConfig[];
  slotLights: LightConfig[];
  slotMetas: SlotMeta[];
  renameSlot: (slot: number, name: string) => void;

  keyboardConfig: KeyboardConfig;
  setKeyboardConfig: React.Dispatch<React.SetStateAction<KeyboardConfig>>;
  lightConfig: LightConfig;
  setLightConfig: React.Dispatch<React.SetStateAction<LightConfig>>;
  globalParams: GlobalParams;
  diagnostics: DiagnosticData | null;
  liveInput: LiveInputState | null;
  livePolling: boolean;
  setLivePolling: (on: boolean) => void;

  busyText: string | null;
  busyProgress: number | null;
  isDirty: boolean;
  dirtySlots: boolean[];
  toasts: ToastItem[];
  pushToast: (type: ToastItem['type'], message: string) => void;

  connectWebHid: (vid?: number, pid?: number) => Promise<void>;
  connectMock: () => Promise<void>;
  disconnect: () => Promise<void>;

  readAllFromDevice: (slotOverride?: number) => Promise<void>;
  writeAllToDevice: (mode?: 'both' | 'cfg' | 'light') => Promise<void>;
  writeDirtySlotsToDevice: () => Promise<void>;
  switchDeviceSlot: (slot: number) => Promise<void>;

  copySlotTo: (fromSlot: number, toSlot: number) => void;
  resetSlot: (slot: number) => void;
  applyTemplateToSlot: (
    slot: number,
    cfg: KeyboardConfig,
    light: LightConfig,
    name?: string,
  ) => void;
  swapKeysInCurrentSlot: (idxA: number, idxB: number) => void;
  exportWorkspaceJson: () => string;
  importWorkspaceJson: (jsonText: string) => void;

  applyKeyDebounce: (val: number) => Promise<void>;
  calibrateRockerMid: () => Promise<void>;
  applyRockerRange: (minX: number, maxX: number, minY: number, maxY: number) => Promise<void>;
  applyEncoderDoubleFreq: (ec1: boolean, ec2: boolean) => Promise<void>;
  refreshDiagnostics: () => Promise<void>;
  triggerSoftReset: () => Promise<void>;
  triggerBootloader: () => Promise<void>;
  triggerBuzzerMode: () => Promise<void>;
  playBuzzerNote: (note: number, vol: number) => Promise<void>;

  importEtcfgBytes: (bytes: Uint8Array) => void;
  exportEtcfgBytes: () => Uint8Array;
  importEtlightBytes: (bytes: Uint8Array) => void;
  exportEtlightBytes: () => Uint8Array;

  mockTransportRef: React.MutableRefObject<MockTransport | null>;
}

const DeviceContext = createContext<DeviceContextValue | null>(null);

function createInitialSlots() {
  const cfgs = Array.from({ length: SLOT_COUNT }, () => createDefaultKeyboardConfig());
  const lights = Array.from({ length: SLOT_COUNT }, () => createDefaultLightConfig());
  const sigs = cfgs.map((c, i) => computeSlotSignature(c, lights[i]));
  return { cfgs, lights, sigs };
}

export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const transportRef = useRef<ITransport | null>(null);
  const clientRef = useRef<EthaneProtocolClient | null>(null);
  const mockTransportRef = useRef<MockTransport | null>(null);

  const [status, setStatus] = useState<TransportStatus>('disconnected');
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [firmwareVersion, setFirmwareVersion] = useState('--');
  const [serialNumber, setSerialNumber] = useState('LOCAL');
  const [firmwareSupportsReadback, setFirmwareSupportsReadback] = useState<boolean | null>(null);
  const [legacyNoticeDismissed, setLegacyNoticeDismissed] = useState(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>('keymap');
  const [selection, setSelection] = useState<SelectionTarget>({ kind: 'key', index: 0 });
  const [currentSlot, setCurrentSlotState] = useState(0);
  const [deviceActiveSlot, setDeviceActiveSlot] = useState(0);

  const init = useMemo(() => createInitialSlots(), []);
  const [slotCfgs, setSlotCfgs] = useState<KeyboardConfig[]>(init.cfgs);
  const [slotLights, setSlotLights] = useState<LightConfig[]>(init.lights);
  const [savedSignatures, setSavedSignatures] = useState<string[]>(init.sigs);
  const [slotMetas, setSlotMetas] = useState<SlotMeta[]>(() => loadSlotMetas('LOCAL'));

  const [globalParams, setGlobalParams] = useState<GlobalParams>(() => createDefaultGlobalParams());
  const [diagnostics, setDiagnostics] = useState<DiagnosticData | null>(null);
  const [liveInput, setLiveInput] = useState<LiveInputState | null>(null);
  const [livePolling, setLivePolling] = useState(false);

  const [busyText, setBusyText] = useState<string | null>(null);
  const [busyProgress, setBusyProgress] = useState<number | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toastIdRef = useRef(1);
  const pushToast = useCallback((type: ToastItem['type'], message: string) => {
    const id = toastIdRef.current++;
    setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  const keyboardConfig = slotCfgs[currentSlot];
  const lightConfig = slotLights[currentSlot];

  const dirtySlots = useMemo(
    () =>
      slotCfgs.map(
        (cfg, i) => computeSlotSignature(cfg, slotLights[i]) !== savedSignatures[i],
      ),
    [slotCfgs, slotLights, savedSignatures],
  );
  const isDirty = dirtySlots[currentSlot];

  const renameSlot = useCallback(
    (slot: number, name: string) => {
      const trimmed = name.trim() || DEFAULT_SLOT_NAMES[slot];
      setSlotMetas((prev) => {
        const next = [...prev];
        next[slot] = { name: trimmed };
        saveSlotMetas(serialNumber, next);
        return next;
      });
    },
    [serialNumber],
  );

  const setKeyboardConfig: React.Dispatch<React.SetStateAction<KeyboardConfig>> = useCallback(
    (updater) => {
      setSlotCfgs((prev) => {
        const next = [...prev];
        next[currentSlot] =
          typeof updater === 'function' ? updater(prev[currentSlot]) : updater;
        return next;
      });
    },
    [currentSlot],
  );

  const setLightConfig: React.Dispatch<React.SetStateAction<LightConfig>> = useCallback(
    (updater) => {
      setSlotLights((prev) => {
        const next = [...prev];
        next[currentSlot] =
          typeof updater === 'function' ? updater(prev[currentSlot]) : updater;
        return next;
      });
    },
    [currentSlot],
  );

  const bindTransport = useCallback((transport: ITransport) => {
    transportRef.current = transport;
    clientRef.current = new EthaneProtocolClient(transport);
    transport.onStatusChange((next) => {
      setStatus(next);
      if (next === 'disconnected') {
        setDeviceInfo(null);
        setLivePolling(false);
        setLiveInput(null);
      }
    });
  }, []);

  const readAllFromDevice = useCallback(
    async (slotOverride?: number) => {
      const client = clientRef.current;
      if (!client) {
        pushToast('warning', '请先连接设备或进入模拟模式');
        return;
      }

      setBusyText('正在读取设备配置...');
      setBusyProgress(10);
      try {
        const [fw, uid, gp] = await Promise.all([
          client.readFirmwareVersion(),
          client.readSerialNumber(),
          client.readGlobalParams(),
        ]);
        setFirmwareVersion(fw);
        setSerialNumber(uid);
        setGlobalParams(gp);
        setSlotMetas(loadSlotMetas(uid));

        let targetSlot = slotOverride ?? currentSlot;
        let usedFallback = false;

        if (slotOverride === undefined) {
          try {
            targetSlot = await client.readActiveSlot();
            setDeviceActiveSlot(targetSlot);
            setCurrentSlotState(targetSlot);
          } catch (err) {
            if (!(err instanceof InvalidCommandError)) throw err;
          }
        }

        try {
          setBusyText(`正在从设备读取 L${targetSlot + 1} 按键配置...`);
          const cfg = await client.readKeyboardConfig(targetSlot, (p) =>
            setBusyProgress(15 + Math.round(p * 0.45)),
          );
          setBusyText(`正在从设备读取 L${targetSlot + 1} 灯效配置...`);
          const light = await client.readLightConfig(targetSlot, (p) =>
            setBusyProgress(60 + Math.round(p * 0.4)),
          );

          setSlotCfgs((prev) => {
            const next = [...prev];
            next[targetSlot] = cfg;
            return next;
          });
          setSlotLights((prev) => {
            const next = [...prev];
            next[targetSlot] = light;
            return next;
          });
          setSavedSignatures((prev) => {
            const next = [...prev];
            next[targetSlot] = computeSlotSignature(cfg, light);
            return next;
          });
          saveLocalSlot(uid, 'cfg', targetSlot, cfg);
          saveLocalSlot(uid, 'light', targetSlot, light);
          setFirmwareSupportsReadback(true);
        } catch (err) {
          if (err instanceof InvalidCommandError) {
            usedFallback = true;
            setFirmwareSupportsReadback(false);
            setLegacyNoticeDismissed(false);
            const cachedCfg = loadLocalSlot<KeyboardConfig>(uid, 'cfg', targetSlot);
            const cachedLight = loadLocalSlot<LightConfig>(uid, 'light', targetSlot);
            const finalCfg = cachedCfg ?? createDefaultKeyboardConfig();
            const finalLight = cachedLight ?? createDefaultLightConfig();
            setSlotCfgs((prev) => {
              const next = [...prev];
              next[targetSlot] = finalCfg;
              return next;
            });
            setSlotLights((prev) => {
              const next = [...prev];
              next[targetSlot] = finalLight;
              return next;
            });
            setSavedSignatures((prev) => {
              const next = [...prev];
              next[targetSlot] = computeSlotSignature(finalCfg, finalLight);
              return next;
            });
          } else {
            throw err;
          }
        }

        if (usedFallback) {
          pushToast(
            'warning',
            `当前为旧版固件，不支持直接从设备读取配置（已载入本地 L${targetSlot + 1} 缓存，如需支持请更新固件）`,
          );
        } else {
          pushToast('success', `已从设备读取 L${targetSlot + 1} 完整配置`);
        }
      } catch (err) {
        pushToast('error', `读取失败：${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setBusyText(null);
        setBusyProgress(null);
      }
    },
    [currentSlot, pushToast],
  );

  const connectWebHid = useCallback(
    async (vid?: number, pid?: number) => {
      if (transportRef.current) {
        await transportRef.current.disconnect();
      }
      mockTransportRef.current = null;
      const webhid = new WebHidTransport();
      bindTransport(webhid);
      try {
        const info = await webhid.connect({ vendorId: vid, productId: pid });
        setDeviceInfo(info);
        pushToast('success', `已连接设备：${info.productName}`);
        await readAllFromDevice();
      } catch (err) {
        pushToast('error', err instanceof Error ? err.message : '连接设备失败');
      }
    },
    [bindTransport, pushToast, readAllFromDevice],
  );

  const connectMock = useCallback(async () => {
    if (transportRef.current) {
      await transportRef.current.disconnect();
    }
    const mock = new MockTransport({
      encodeCfg: encodeKeyboardConfig,
      encodeLight: encodeLightConfig,
    });
    mockTransportRef.current = mock;
    bindTransport(mock);
    const info = await mock.connect();
    setDeviceInfo(info);
    pushToast('info', '已进入模拟演示模式，所有读写与校准均可无硬件体验');
    await readAllFromDevice(0);
  }, [bindTransport, pushToast, readAllFromDevice]);

  const disconnect = useCallback(async () => {
    setLivePolling(false);
    if (transportRef.current) {
      await transportRef.current.disconnect();
      transportRef.current = null;
      clientRef.current = null;
      mockTransportRef.current = null;
    }
    setFirmwareVersion('--');
    setSerialNumber('LOCAL');
    setFirmwareSupportsReadback(null);
    setLegacyNoticeDismissed(false);
    pushToast('info', '已断开设备连接');
  }, [pushToast]);

  const setCurrentSlot = useCallback((slot: number) => {
    const clamped = Math.max(0, Math.min(SLOT_COUNT - 1, slot));
    setCurrentSlotState(clamped);
  }, []);

  const writeAllToDevice = useCallback(
    async (mode: 'both' | 'cfg' | 'light' = 'both') => {
      const client = clientRef.current;
      if (!client) {
        pushToast('warning', '请先连接设备或点击“演示/模拟设备”');
        return;
      }

      const cfg = slotCfgs[currentSlot];
      const light = slotLights[currentSlot];

      setBusyText(`正在写入 L${currentSlot + 1}...`);
      setBusyProgress(5);
      try {
        if (mode === 'both' || mode === 'cfg') {
          setBusyText(`正在写入 L${currentSlot + 1} 按键配置...`);
          await client.writeKeyboardConfig(currentSlot, cfg, (p) =>
            setBusyProgress(mode === 'both' ? Math.round(p * 0.65) : p),
          );
          saveLocalSlot(serialNumber, 'cfg', currentSlot, cfg);
        }
        if (mode === 'both' || mode === 'light') {
          setBusyText(`正在写入 L${currentSlot + 1} 灯效配置...`);
          await client.writeLightConfig(currentSlot, light, (p) =>
            setBusyProgress(mode === 'both' ? 65 + Math.round(p * 0.35) : p),
          );
          saveLocalSlot(serialNumber, 'light', currentSlot, light);
        }
        setSavedSignatures((prev) => {
          const next = [...prev];
          next[currentSlot] = computeSlotSignature(cfg, light);
          return next;
        });
        const label = mode === 'cfg' ? '按键配置' : mode === 'light' ? '灯效配置' : '按键与灯效配置';
        pushToast('success', `L${currentSlot + 1} ${label}已成功写入设备！`);
      } catch (err) {
        pushToast('error', `写入失败：${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setBusyText(null);
        setBusyProgress(null);
      }
    },
    [currentSlot, slotCfgs, slotLights, serialNumber, pushToast],
  );

  const writeDirtySlotsToDevice = useCallback(async () => {
    const client = clientRef.current;
    if (!client) {
      pushToast('warning', '请先连接设备或进入模拟模式');
      return;
    }
    const targets = dirtySlots
      .map((dirty, idx) => (dirty ? idx : -1))
      .filter((idx) => idx !== -1);
    if (targets.length === 0) return;

    setBusyText(`准备同步 ${targets.length} 个配置层...`);
    setBusyProgress(5);
    try {
      for (let i = 0; i < targets.length; i++) {
        const slot = targets[i];
        const cfg = slotCfgs[slot];
        const light = slotLights[slot];
        const basePct = (i / targets.length) * 100;
        const spanPct = 100 / targets.length;

        setBusyText(`正在同步 L${slot + 1} 按键配置 (${i + 1}/${targets.length})...`);
        await client.writeKeyboardConfig(slot, cfg, (p) =>
          setBusyProgress(Math.round(basePct + (p / 100) * spanPct * 0.65)),
        );
        setBusyText(`正在同步 L${slot + 1} 灯效配置 (${i + 1}/${targets.length})...`);
        await client.writeLightConfig(slot, light, (p) =>
          setBusyProgress(Math.round(basePct + spanPct * 0.65 + (p / 100) * spanPct * 0.35)),
        );

        saveLocalSlot(serialNumber, 'cfg', slot, cfg);
        saveLocalSlot(serialNumber, 'light', slot, light);
        setSavedSignatures((prev) => {
          const next = [...prev];
          next[slot] = computeSlotSignature(cfg, light);
          return next;
        });
      }
      pushToast('success', `已同步全部 ${targets.length} 个修改的配置层到设备！`);
    } catch (err) {
      pushToast('error', `批量同步失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusyText(null);
      setBusyProgress(null);
    }
  }, [dirtySlots, slotCfgs, slotLights, serialNumber, pushToast]);

  const copySlotTo = useCallback(
    (fromSlot: number, toSlot: number) => {
      if (fromSlot === toSlot) return;
      const clonedCfg = decodeKeyboardConfig(encodeKeyboardConfig(slotCfgs[fromSlot]));
      const clonedLight = decodeLightConfig(encodeLightConfig(slotLights[fromSlot]));
      setSlotCfgs((prev) => {
        const next = [...prev];
        next[toSlot] = clonedCfg;
        return next;
      });
      setSlotLights((prev) => {
        const next = [...prev];
        next[toSlot] = clonedLight;
        return next;
      });
      pushToast('success', `已将 L${fromSlot + 1} 的键位与灯效复制到 L${toSlot + 1}（记得写入设备）`);
    },
    [slotCfgs, slotLights, pushToast],
  );

  const resetSlot = useCallback(
    (slot: number) => {
      setSlotCfgs((prev) => {
        const next = [...prev];
        next[slot] = createDefaultKeyboardConfig();
        return next;
      });
      setSlotLights((prev) => {
        const next = [...prev];
        next[slot] = createDefaultLightConfig();
        return next;
      });
      pushToast('info', `已重置 L${slot + 1} 为默认配置`);
    },
    [pushToast],
  );

  const applyTemplateToSlot = useCallback(
    (slot: number, cfg: KeyboardConfig, light: LightConfig, name?: string) => {
      setSlotCfgs((prev) => {
        const next = [...prev];
        next[slot] = cfg;
        return next;
      });
      setSlotLights((prev) => {
        const next = [...prev];
        next[slot] = light;
        return next;
      });
      if (name) {
        renameSlot(slot, name);
      }
      pushToast('success', `已将「${name ?? '场景模板'}」套用到 L${slot + 1}（记得写入设备）`);
    },
    [renameSlot, pushToast],
  );

  const swapKeysInCurrentSlot = useCallback(
    (idxA: number, idxB: number) => {
      if (idxA === idxB) return;
      setKeyboardConfig((prev) => {
        const nextKeys = [...prev.keys];
        const temp = nextKeys[idxA];
        nextKeys[idxA] = nextKeys[idxB];
        nextKeys[idxB] = temp;
        return { ...prev, keys: nextKeys };
      });
      pushToast('info', `已互换 K${idxA + 1} 与 K${idxB + 1} 的功能`);
    },
    [setKeyboardConfig, pushToast],
  );

  const exportWorkspaceJson = useCallback(() => {
    const payload = {
      format: 'ethane-xvi-workspace',
      version: 1,
      exportedAt: new Date().toISOString(),
      slots: Array.from({ length: SLOT_COUNT }, (_, i) => ({
        name: slotMetas[i]?.name || DEFAULT_SLOT_NAMES[i],
        cfg: Array.from(encodeKeyboardConfig(slotCfgs[i])),
        light: Array.from(encodeLightConfig(slotLights[i])),
      })),
    };
    return JSON.stringify(payload, null, 2);
  }, [slotMetas, slotCfgs, slotLights]);

  const importWorkspaceJson = useCallback(
    (jsonText: string) => {
      try {
        const parsed = JSON.parse(jsonText) as {
          format?: string;
          slots?: Array<{ name?: string; cfg?: number[]; light?: number[] }>;
        };
        if (parsed.format !== 'ethane-xvi-workspace' || !Array.isArray(parsed.slots)) {
          throw new Error('无效的 Ethane-XVI 全量备份文件');
        }
        const nextCfgs = [...slotCfgs];
        const nextLights = [...slotLights];
        const nextMetas = [...slotMetas];
        for (let i = 0; i < Math.min(SLOT_COUNT, parsed.slots.length); i++) {
          const item = parsed.slots[i];
          if (Array.isArray(item.cfg) && item.cfg.length === 512) {
            nextCfgs[i] = decodeKeyboardConfig(new Uint8Array(item.cfg));
          }
          if (Array.isArray(item.light) && item.light.length === 256) {
            nextLights[i] = decodeLightConfig(new Uint8Array(item.light));
          }
          if (item.name) {
            nextMetas[i] = { name: item.name };
          }
        }
        setSlotCfgs(nextCfgs);
        setSlotLights(nextLights);
        setSlotMetas(nextMetas);
        saveSlotMetas(serialNumber, nextMetas);
        pushToast('success', '已成功恢复 8 层整机备份（请点击“同步全部”写入设备）');
      } catch (err) {
        pushToast('error', err instanceof Error ? err.message : '导入整机备份失败');
      }
    },
    [slotCfgs, slotLights, slotMetas, serialNumber, pushToast],
  );

  const switchDeviceSlot = useCallback(
    async (slot: number) => {
      const client = clientRef.current;
      if (!client) return;
      try {
        await client.switchActiveSlot(slot);
        setDeviceActiveSlot(slot);
        pushToast('success', `设备已切换至 L${slot + 1}`);
      } catch (err) {
        pushToast('error', `切换失败：${err instanceof Error ? err.message : String(err)}`);
      }
    },
    [pushToast],
  );

  const applyKeyDebounce = useCallback(
    async (val: number) => {
      const client = clientRef.current;
      if (!client) return;
      try {
        const res = await client.setKeyDebounce(val);
        setGlobalParams((prev) => ({ ...prev, keyDebounce: res.newVal }));
        pushToast('success', `按键消抖已更新：${res.oldVal} → ${res.newVal}`);
      } catch (err) {
        pushToast('error', err instanceof Error ? err.message : '设置消抖失败');
      }
    },
    [pushToast],
  );

  const calibrateRockerMid = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    try {
      const res = await client.calibrateRockerMid();
      setGlobalParams((prev) => ({
        ...prev,
        rockerMidX: res.newMidX,
        rockerMidY: res.newMidY,
      }));
      pushToast('success', `摇杆中心点已校准为 (${res.newMidX}, ${res.newMidY})`);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : '中位校准失败');
    }
  }, [pushToast]);

  const applyRockerRange = useCallback(
    async (minX: number, maxX: number, minY: number, maxY: number) => {
      const client = clientRef.current;
      if (!client) return;
      try {
        await client.setRockerRange(minX, maxX, minY, maxY);
        setGlobalParams((prev) => ({
          ...prev,
          rockerMinX: minX,
          rockerMaxX: maxX,
          rockerMinY: minY,
          rockerMaxY: maxY,
        }));
        pushToast('success', '摇杆活动范围已保存至设备');
      } catch (err) {
        pushToast('error', err instanceof Error ? err.message : '摇杆范围设置失败');
      }
    },
    [pushToast],
  );

  const applyEncoderDoubleFreq = useCallback(
    async (ec1: boolean, ec2: boolean) => {
      const client = clientRef.current;
      if (!client) return;
      try {
        await client.setEncoderDoubleFreq(ec1, ec2);
        setGlobalParams((prev) => ({ ...prev, ec1DoubleFreq: ec1, ec2DoubleFreq: ec2 }));
        pushToast('success', '旋钮倍频设置已生效');
      } catch (err) {
        pushToast('error', err instanceof Error ? err.message : '旋钮倍频设置失败');
      }
    },
    [pushToast],
  );

  const refreshDiagnostics = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    try {
      const diag = await client.readDiagnostics();
      setDiagnostics(diag);
      pushToast('success', '诊断信息已刷新');
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : '读取诊断信息失败');
    }
  }, [pushToast]);

  const triggerSoftReset = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    try {
      await client.softReset();
      pushToast('info', '已发送软复位命令，设备正在重启');
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : '软复位失败');
    }
  }, [pushToast]);

  const triggerBootloader = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    try {
      await client.enterBootloader();
      pushToast('warning', '设备已进入 Boot 预跳转状态，请重新拔插 USB 进行固件烧录');
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Boot 预跳转失败');
    }
  }, [pushToast]);

  const triggerBuzzerMode = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    try {
      await client.enterBuzzerMode();
      pushToast('info', '设备已进入蜂鸣器演奏模式（按下摇杆或旋钮可退出）');
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : '进入蜂鸣器模式失败');
    }
  }, [pushToast]);

  const playBuzzerNote = useCallback(
    async (note: number, vol: number) => {
      const client = clientRef.current;
      if (!client) return;
      try {
        await client.playBuzzerNote(note, vol);
      } catch (err) {
        pushToast('error', err instanceof Error ? err.message : '蜂鸣器发声失败');
      }
    },
    [pushToast],
  );

  useEffect(() => {
    if (!livePolling || (status !== 'connected' && status !== 'mock')) return;
    let active = true;
    const tick = async () => {
      const client = clientRef.current;
      if (!client || !active) return;
      try {
        const input = await client.readLiveInput();
        if (active) setLiveInput(input);
      } catch {
        // ignore transient poll timeout
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), 120);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [livePolling, status]);

  const importEtcfgBytes = useCallback(
    (bytes: Uint8Array) => {
      try {
        const cfg = decodeKeyboardConfig(bytes);
        setKeyboardConfig(cfg);
        pushToast('success', '已导入 .etcfg 配置文件（请点击“写入”生效）');
      } catch (err) {
        pushToast('error', err instanceof Error ? err.message : '导入 .etcfg 失败');
      }
    },
    [setKeyboardConfig, pushToast],
  );

  const exportEtcfgBytes = useCallback(
    () => encodeKeyboardConfig(slotCfgs[currentSlot]),
    [slotCfgs, currentSlot],
  );

  const importEtlightBytes = useCallback(
    (bytes: Uint8Array) => {
      try {
        const light = decodeLightConfig(bytes);
        setLightConfig(light);
        pushToast('success', '已导入 .etlight 灯效文件（请点击“写入”生效）');
      } catch (err) {
        pushToast('error', err instanceof Error ? err.message : '导入 .etlight 失败');
      }
    },
    [setLightConfig, pushToast],
  );

  const exportEtlightBytes = useCallback(
    () => encodeLightConfig(slotLights[currentSlot]),
    [slotLights, currentSlot],
  );

  return (
    <DeviceContext.Provider
      value={{
        status,
        deviceInfo,
        firmwareVersion,
        serialNumber,
        firmwareSupportsReadback,
        legacyNoticeDismissed,
        dismissLegacyNotice: () => setLegacyNoticeDismissed(true),
        activeTab,
        setActiveTab,
        selection,
        setSelection,
        currentSlot,
        deviceActiveSlot,
        setCurrentSlot,
        slotCfgs,
        slotLights,
        slotMetas,
        renameSlot,
        keyboardConfig,
        setKeyboardConfig,
        lightConfig,
        setLightConfig,
        globalParams,
        diagnostics,
        liveInput,
        livePolling,
        setLivePolling,
        busyText,
        busyProgress,
        isDirty,
        dirtySlots,
        toasts,
        pushToast,
        connectWebHid,
        connectMock,
        disconnect,
        readAllFromDevice,
        writeAllToDevice,
        writeDirtySlotsToDevice,
        switchDeviceSlot,
        copySlotTo,
        resetSlot,
        applyTemplateToSlot,
        swapKeysInCurrentSlot,
        exportWorkspaceJson,
        importWorkspaceJson,
        applyKeyDebounce,
        calibrateRockerMid,
        applyRockerRange,
        applyEncoderDoubleFreq,
        refreshDiagnostics,
        triggerSoftReset,
        triggerBootloader,
        triggerBuzzerMode,
        playBuzzerNote,
        importEtcfgBytes,
        exportEtcfgBytes,
        importEtlightBytes,
        exportEtlightBytes,
        mockTransportRef,
      }}
    >
      {children}
    </DeviceContext.Provider>
  );
}

export function useDevice() {
  const ctx = useContext(DeviceContext);
  if (!ctx) throw new Error('useDevice must be used within DeviceProvider');
  return ctx;
}
