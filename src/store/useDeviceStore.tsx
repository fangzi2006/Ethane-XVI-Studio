import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  DiagnosticData,
  GlobalParams,
  KeyboardConfig,
  LightConfig,
  LiveInputState,
  SLOT_COUNT,
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

export type ActiveTab = 'keymap' | 'lighting' | 'device';

export interface ToastItem {
  id: number;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

const STORAGE_PREFIX = 'ethane-xvi-studio-v1';

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
    // 忽略配额限制
  }
}

interface DeviceContextValue {
  status: TransportStatus;
  deviceInfo: DeviceInfo | null;
  firmwareVersion: string;
  serialNumber: string;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  selection: SelectionTarget;
  setSelection: (sel: SelectionTarget) => void;

  currentSlot: number; // 0..7
  deviceActiveSlot: number; // 设备当前生效槽位
  setCurrentSlot: (slot: number) => void;

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
  toasts: ToastItem[];
  pushToast: (type: ToastItem['type'], message: string) => void;

  // 连接操作
  connectWebHid: (vid?: number, pid?: number) => Promise<void>;
  connectMock: () => Promise<void>;
  disconnect: () => Promise<void>;

  // 一键读写操作
  readAllFromDevice: (slotOverride?: number) => Promise<void>;
  writeAllToDevice: (mode?: 'both' | 'cfg' | 'light') => Promise<void>;
  switchDeviceSlot: (slot: number) => Promise<void>;

  // 全局参数与诊断
  applyKeyDebounce: (val: number) => Promise<void>;
  calibrateRockerMid: () => Promise<void>;
  applyRockerRange: (minX: number, maxX: number, minY: number, maxY: number) => Promise<void>;
  applyEncoderDoubleFreq: (ec1: boolean, ec2: boolean) => Promise<void>;
  refreshDiagnostics: () => Promise<void>;
  triggerSoftReset: () => Promise<void>;
  triggerBootloader: () => Promise<void>;
  triggerBuzzerMode: () => Promise<void>;
  playBuzzerNote: (note: number, vol: number) => Promise<void>;

  // 文件导入导出
  importEtcfgBytes: (bytes: Uint8Array) => void;
  exportEtcfgBytes: () => Uint8Array;
  importEtlightBytes: (bytes: Uint8Array) => void;
  exportEtlightBytes: () => Uint8Array;

  // 模拟设备交互
  mockTransportRef: React.MutableRefObject<MockTransport | null>;
}

const DeviceContext = createContext<DeviceContextValue | null>(null);

export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const transportRef = useRef<ITransport | null>(null);
  const clientRef = useRef<EthaneProtocolClient | null>(null);
  const mockTransportRef = useRef<MockTransport | null>(null);

  const [status, setStatus] = useState<TransportStatus>('disconnected');
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [firmwareVersion, setFirmwareVersion] = useState('--');
  const [serialNumber, setSerialNumber] = useState('LOCAL');

  const [activeTab, setActiveTab] = useState<ActiveTab>('keymap');
  const [selection, setSelection] = useState<SelectionTarget>({ kind: 'key', index: 0 });
  const [currentSlot, setCurrentSlotState] = useState(0);
  const [deviceActiveSlot, setDeviceActiveSlot] = useState(0);

  const [keyboardConfig, setKeyboardConfigRaw] = useState<KeyboardConfig>(() =>
    createDefaultKeyboardConfig(),
  );
  const [lightConfig, setLightConfigRaw] = useState<LightConfig>(() => createDefaultLightConfig());
  const [globalParams, setGlobalParams] = useState<GlobalParams>(() => createDefaultGlobalParams());
  const [diagnostics, setDiagnostics] = useState<DiagnosticData | null>(null);
  const [liveInput, setLiveInput] = useState<LiveInputState | null>(null);
  const [livePolling, setLivePolling] = useState(false);

  const [busyText, setBusyText] = useState<string | null>(null);
  const [busyProgress, setBusyProgress] = useState<number | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toastIdRef = useRef(1);
  const pushToast = useCallback((type: ToastItem['type'], message: string) => {
    const id = toastIdRef.current++;
    setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  const setKeyboardConfig: React.Dispatch<React.SetStateAction<KeyboardConfig>> = useCallback(
    (updater) => {
      setKeyboardConfigRaw(updater);
      setIsDirty(true);
    },
    [],
  );

  const setLightConfig: React.Dispatch<React.SetStateAction<LightConfig>> = useCallback(
    (updater) => {
      setLightConfigRaw(updater);
      setIsDirty(true);
    },
    [],
  );

  const bindTransport = useCallback(
    (transport: ITransport) => {
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
    },
    [],
  );

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
          setBusyText(`正在从设备回读槽位 ${targetSlot + 1} 按键配置...`);
          const cfg = await client.readKeyboardConfig(targetSlot, (p) =>
            setBusyProgress(15 + Math.round(p * 0.45)),
          );
          setBusyText(`正在从设备回读槽位 ${targetSlot + 1} 灯效配置...`);
          const light = await client.readLightConfig(targetSlot, (p) =>
            setBusyProgress(60 + Math.round(p * 0.4)),
          );
          setKeyboardConfigRaw(cfg);
          setLightConfigRaw(light);
          saveLocalSlot(uid, 'cfg', targetSlot, cfg);
          saveLocalSlot(uid, 'light', targetSlot, light);
          setIsDirty(false);
        } catch (err) {
          if (err instanceof InvalidCommandError) {
            usedFallback = true;
            const cachedCfg = loadLocalSlot<KeyboardConfig>(uid, 'cfg', targetSlot);
            const cachedLight = loadLocalSlot<LightConfig>(uid, 'light', targetSlot);
            if (cachedCfg) setKeyboardConfigRaw(cachedCfg);
            if (cachedLight) setLightConfigRaw(cachedLight);
            setIsDirty(false);
          } else {
            throw err;
          }
        }

        if (usedFallback) {
          pushToast(
            'info',
            `已读取设备全局参数（旧版固件暂不支持 Flash 回读，已自动恢复本地槽位 ${targetSlot + 1} 缓存）`,
          );
        } else {
          pushToast('success', `已成功从设备读取槽位 ${targetSlot + 1} 的完整配置`);
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
    pushToast('info', '已断开设备连接');
  }, [pushToast]);

  const setCurrentSlot = useCallback(
    (slot: number) => {
      const clamped = Math.max(0, Math.min(SLOT_COUNT - 1, slot));
      setCurrentSlotState(clamped);
      if (status === 'connected' || status === 'mock') {
        void readAllFromDevice(clamped);
      } else {
        const cachedCfg = loadLocalSlot<KeyboardConfig>(serialNumber, 'cfg', clamped);
        const cachedLight = loadLocalSlot<LightConfig>(serialNumber, 'light', clamped);
        setKeyboardConfigRaw(cachedCfg ?? createDefaultKeyboardConfig());
        setLightConfigRaw(cachedLight ?? createDefaultLightConfig());
        setIsDirty(false);
      }
    },
    [status, serialNumber, readAllFromDevice],
  );

  const writeAllToDevice = useCallback(
    async (mode: 'both' | 'cfg' | 'light' = 'both') => {
      const client = clientRef.current;
      if (!client) {
        pushToast('warning', '请先连接设备或点击“演示/模拟设备”');
        return;
      }

      setBusyText(`正在写入槽位 ${currentSlot + 1}...`);
      setBusyProgress(5);
      try {
        if (mode === 'both' || mode === 'cfg') {
          setBusyText(`正在写入槽位 ${currentSlot + 1} 按键配置...`);
          await client.writeKeyboardConfig(currentSlot, keyboardConfig, (p) =>
            setBusyProgress(mode === 'both' ? Math.round(p * 0.65) : p),
          );
          saveLocalSlot(serialNumber, 'cfg', currentSlot, keyboardConfig);
        }
        if (mode === 'both' || mode === 'light') {
          setBusyText(`正在写入槽位 ${currentSlot + 1} 灯效配置...`);
          await client.writeLightConfig(currentSlot, lightConfig, (p) =>
            setBusyProgress(mode === 'both' ? 65 + Math.round(p * 0.35) : p),
          );
          saveLocalSlot(serialNumber, 'light', currentSlot, lightConfig);
        }
        setIsDirty(false);
        const label = mode === 'cfg' ? '按键配置' : mode === 'light' ? '灯效配置' : '按键与灯效配置';
        pushToast('success', `槽位 ${currentSlot + 1} ${label}已成功写入设备！`);
      } catch (err) {
        pushToast('error', `写入失败：${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setBusyText(null);
        setBusyProgress(null);
      }
    },
    [currentSlot, keyboardConfig, lightConfig, serialNumber, pushToast],
  );

  const switchDeviceSlot = useCallback(
    async (slot: number) => {
      const client = clientRef.current;
      if (!client) return;
      try {
        await client.switchActiveSlot(slot);
        setDeviceActiveSlot(slot);
        pushToast('success', `设备已切换至槽位 ${slot + 1}`);
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
      pushToast('success', `摇杆中位校准完成：(${res.newMidX}, ${res.newMidY})`);
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

  // 实时输入轮询
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
        // 忽略偶发轮询超时
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
        setKeyboardConfigRaw(cfg);
        setIsDirty(true);
        pushToast('success', '已成功导入 .etcfg 键盘配置文件');
      } catch (err) {
        pushToast('error', err instanceof Error ? err.message : '导入 .etcfg 失败');
      }
    },
    [pushToast],
  );

  const exportEtcfgBytes = useCallback(() => encodeKeyboardConfig(keyboardConfig), [keyboardConfig]);

  const importEtlightBytes = useCallback(
    (bytes: Uint8Array) => {
      try {
        const light = decodeLightConfig(bytes);
        setLightConfigRaw(light);
        setIsDirty(true);
        pushToast('success', '已成功导入 .etlight 灯效配置文件');
      } catch (err) {
        pushToast('error', err instanceof Error ? err.message : '导入 .etlight 失败');
      }
    },
    [pushToast],
  );

  const exportEtlightBytes = useCallback(() => encodeLightConfig(lightConfig), [lightConfig]);

  return (
    <DeviceContext.Provider
      value={{
        status,
        deviceInfo,
        firmwareVersion,
        serialNumber,
        activeTab,
        setActiveTab,
        selection,
        setSelection,
        currentSlot,
        deviceActiveSlot,
        setCurrentSlot,
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
        toasts,
        pushToast,
        connectWebHid,
        connectMock,
        disconnect,
        readAllFromDevice,
        writeAllToDevice,
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
