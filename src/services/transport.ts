import {
  DEFAULT_PID,
  DEFAULT_USAGE_PAGE,
  DEFAULT_VID,
  SLOT_COUNT,
  createDefaultGlobalParams,
  createDefaultKeyboardConfig,
  createDefaultLightConfig,
  KeyMode,
  RockerMode,
} from '../types/config';

export type TransportStatus = 'disconnected' | 'connecting' | 'connected' | 'mock';

export interface DeviceInfo {
  vendorId: number;
  productId: number;
  productName: string;
  serialNumber?: string;
}

export interface ConnectOptions {
  vendorId?: number;
  productId?: number;
  usagePage?: number;
}

/**
 * 统一的底层通信传输接口。
 * 目前提供 WebHidTransport（浏览器 WebHID）和 MockTransport（离线演示模式），
 * 后续迁移 Tauri (Rust) 时仅需新增 TauriHidTransport 实现此接口，无需改动协议层和 UI。
 */
export interface ITransport {
  readonly kind: 'webhid' | 'mock' | 'tauri';
  getStatus(): TransportStatus;
  getDeviceInfo(): DeviceInfo | null;
  connect(options?: ConnectOptions): Promise<DeviceInfo>;
  disconnect(): Promise<void>;
  send(data: Uint8Array): Promise<void>;
  onReceive(listener: (data: Uint8Array) => void): () => void;
  onStatusChange(listener: (status: TransportStatus) => void): () => void;
}

export function isWebHidSupported(): boolean {
  return typeof navigator !== 'undefined' && 'hid' in navigator;
}

export class WebHidTransport implements ITransport {
  readonly kind = 'webhid' as const;
  private device: HIDDevice | null = null;
  private status: TransportStatus = 'disconnected';
  private deviceInfo: DeviceInfo | null = null;
  private receiveListeners = new Set<(data: Uint8Array) => void>();
  private statusListeners = new Set<(status: TransportStatus) => void>();

  private handleInputReport = (event: HIDInputReportEvent) => {
    const view = event.data;
    const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    const packet = new Uint8Array(64);
    packet.set(bytes.subarray(0, 64));
    this.receiveListeners.forEach((fn) => fn(packet));
  };

  private handleHardwareDisconnect = (event: HIDConnectionEvent) => {
    if (this.device && event.device === this.device) {
      this.cleanup();
    }
  };

  getStatus(): TransportStatus {
    return this.status;
  }

  getDeviceInfo(): DeviceInfo | null {
    return this.deviceInfo;
  }

  private setStatus(next: TransportStatus) {
    this.status = next;
    this.statusListeners.forEach((fn) => fn(next));
  }

  async connect(options?: ConnectOptions): Promise<DeviceInfo> {
    if (!isWebHidSupported()) {
      throw new Error('当前浏览器不支持 WebHID，请使用最新版 Chrome / Edge 或使用“模拟设备”体验');
    }

    const vendorId = options?.vendorId ?? DEFAULT_VID;
    const productId = options?.productId ?? DEFAULT_PID;
    const usagePage = options?.usagePage ?? DEFAULT_USAGE_PAGE;

    this.setStatus('connecting');
    try {
      const devices = await navigator.hid.requestDevice({
        filters: [{ vendorId, productId, usagePage }],
      });
      if (!devices.length) {
        this.setStatus('disconnected');
        throw new Error('未选择任何设备');
      }
      const target =
        devices.find((d) => d.collections.some((c) => c.usagePage === usagePage)) ?? devices[0];

      if (!target.opened) {
        await target.open();
      }

      this.device = target;
      this.device.addEventListener('inputreport', this.handleInputReport);
      navigator.hid.addEventListener('disconnect', this.handleHardwareDisconnect);

      this.deviceInfo = {
        vendorId: target.vendorId,
        productId: target.productId,
        productName: target.productName || 'Ethane-XVI',
      };
      this.setStatus('connected');
      return this.deviceInfo;
    } catch (err) {
      this.setStatus('disconnected');
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (this.device) {
      try {
        this.device.removeEventListener('inputreport', this.handleInputReport);
        if (this.device.opened) {
          await this.device.close();
        }
      } finally {
        this.cleanup();
      }
    }
  }

  private cleanup() {
    if (isWebHidSupported()) {
      navigator.hid.removeEventListener('disconnect', this.handleHardwareDisconnect);
    }
    this.device = null;
    this.deviceInfo = null;
    this.setStatus('disconnected');
  }

  async send(data: Uint8Array): Promise<void> {
    if (!this.device || !this.device.opened) {
      throw new Error('设备未连接');
    }
    const packet = new Uint8Array(64);
    packet.set(data.subarray(0, 64));
    await this.device.sendReport(0, packet);
  }

  onReceive(listener: (data: Uint8Array) => void): () => void {
    this.receiveListeners.add(listener);
    return () => this.receiveListeners.delete(listener);
  }

  onStatusChange(listener: (status: TransportStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }
}

/**
 * 模拟设备传输层（内置虚拟 CH549 固件协议状态机），
 * 允许在不插入物理键盘的情况下完整测试读写、校准、宏、灯效与诊断 UI。
 */
export class MockTransport implements ITransport {
  readonly kind = 'mock' as const;
  private status: TransportStatus = 'disconnected';
  private deviceInfo: DeviceInfo | null = null;
  private receiveListeners = new Set<(data: Uint8Array) => void>();
  private statusListeners = new Set<(status: TransportStatus) => void>();

  // 虚拟 Flash 与运行状态
  private activeSlot = 0; // 0..7
  private cfgFlash: Uint8Array[] = [];
  private lightFlash: Uint8Array[] = [];
  private globalParams = createDefaultGlobalParams();

  // 多包接收状态
  private rxMode: 'idle' | 'cfg' | 'light' = 'idle';
  private rxSlot = 0;
  private rxIndex = 0;
  private rxTotal = 0;
  private rxBuffer = new Uint8Array(512);

  // 模拟实时输入状态（支持外部或测试修改）
  public mockLiveInput = {
    rockerX: 2048,
    rockerY: 2048,
    ec1Count: 0,
    ec2Count: 0,
    keyMask: 0,
  };

  /** 模拟旧固件模式（用于测试 BCSI/BRKC/BRLC 返回 RINV 时的自动降级） */
  public simulateLegacyFirmware = false;

  constructor(
    seedEncoder?: {
      encodeCfg: (cfg: ReturnType<typeof createDefaultKeyboardConfig>) => Uint8Array;
      encodeLight: (light: ReturnType<typeof createDefaultLightConfig>) => Uint8Array;
    },
  ) {
    this.initFlash(seedEncoder);
  }

  private initFlash(seedEncoder?: {
    encodeCfg: (cfg: ReturnType<typeof createDefaultKeyboardConfig>) => Uint8Array;
    encodeLight: (light: ReturnType<typeof createDefaultLightConfig>) => Uint8Array;
  }) {
    this.cfgFlash = Array.from({ length: SLOT_COUNT }, () => new Uint8Array(512));
    this.lightFlash = Array.from({ length: SLOT_COUNT }, () => new Uint8Array(256));

    if (seedEncoder) {
      for (let s = 0; s < SLOT_COUNT; s++) {
        const cfg = createDefaultKeyboardConfig();
        if (s === 0) {
          cfg.priority = true;
          // 预设演示快捷键，让用户进入模拟模式即可看到直观的键帽标签
          cfg.keys[0] = { ...cfg.keys[0], mode: KeyMode.Shortcut, key: 6, func: 0x01 }; // Ctrl+C
          cfg.keys[1] = { ...cfg.keys[1], mode: KeyMode.Shortcut, key: 25, func: 0x01 }; // Ctrl+V
          cfg.keys[2] = { ...cfg.keys[2], mode: KeyMode.Shortcut, key: 29, func: 0x01 }; // Ctrl+Z
          cfg.keys[3] = { ...cfg.keys[3], mode: KeyMode.Shortcut, key: 22, func: 0x01 }; // Ctrl+S
          cfg.keys[4] = { ...cfg.keys[4], mode: KeyMode.Single, key: 41, func: 0 }; // Esc
          cfg.keys[5] = { ...cfg.keys[5], mode: KeyMode.Single, key: 44, func: 0 }; // Space
          cfg.keys[6] = { ...cfg.keys[6], mode: KeyMode.Single, key: 40, func: 0 }; // Enter
          cfg.keys[7] = { ...cfg.keys[7], mode: KeyMode.Single, key: 42, func: 0 }; // Backspace
          cfg.keys[8] = {
            ...cfg.keys[8],
            mode: KeyMode.Macro,
            macro: [
              { id: 'demo-1', type: 'shortcut', key: 4, func: 0x01 },
              { id: 'demo-2', type: 'delay', ms: 50 },
              { id: 'demo-3', type: 'shortcut', key: 6, func: 0x01 },
            ],
          };
          cfg.keys[11] = { ...cfg.keys[11], mode: KeyMode.Clicker, key: 246, func: 1, delayMs: 80 };
          cfg.keys[14] = { ...cfg.keys[14], mode: KeyMode.Buzzer };
          cfg.keys[15] = { ...cfg.keys[15], mode: KeyMode.SwitchSlot, key: 40, func: 0x82 }; // T2+Enter
          cfg.rocker.mode = RockerMode.FourWay;
          cfg.rocker.upKey = 26; // W
          cfg.rocker.downKey = 22; // S
          cfg.rocker.leftKey = 4; // A
          cfg.rocker.rightKey = 7; // D
        }
        this.cfgFlash[s] = seedEncoder.encodeCfg(cfg);
        this.lightFlash[s] = seedEncoder.encodeLight(createDefaultLightConfig());
      }
    }
  }

  getStatus(): TransportStatus {
    return this.status;
  }

  getDeviceInfo(): DeviceInfo | null {
    return this.deviceInfo;
  }

  private setStatus(next: TransportStatus) {
    this.status = next;
    this.statusListeners.forEach((fn) => fn(next));
  }

  async connect(): Promise<DeviceInfo> {
    this.setStatus('connecting');
    await new Promise((r) => setTimeout(r, 120));
    this.deviceInfo = {
      vendorId: DEFAULT_VID,
      productId: DEFAULT_PID,
      productName: 'Ethane-XVI (模拟演示设备)',
      serialNumber: 'E160DEMO2026',
    };
    this.setStatus('mock');
    return this.deviceInfo;
  }

  async disconnect(): Promise<void> {
    this.rxMode = 'idle';
    this.deviceInfo = null;
    this.setStatus('disconnected');
  }

  async send(data: Uint8Array): Promise<void> {
    if (this.status !== 'mock') {
      throw new Error('模拟设备未连接');
    }
    const req = new Uint8Array(64);
    req.set(data.subarray(0, 64));

    const resp = this.processPacket(req);
    queueMicrotask(() => {
      this.receiveListeners.forEach((fn) => fn(resp));
    });
  }

  private processPacket(req: Uint8Array): Uint8Array {
    const res = new Uint8Array(64);

    // 多包数据接收状态
    if (this.rxMode !== 'idle') {
      this.rxBuffer.set(req, this.rxIndex * 64);
      res[0] = 0x52; // 'R'
      res[1] = 0x44; // 'D'
      res[2] = this.rxIndex;
      this.rxIndex++;
      if (this.rxIndex >= this.rxTotal) {
        if (this.rxMode === 'cfg') {
          this.cfgFlash[this.rxSlot] = this.rxBuffer.slice(0, 512);
        } else {
          this.lightFlash[this.rxSlot] = this.rxBuffer.slice(0, 256);
        }
        this.rxMode = 'idle';
        this.rxIndex = 0;
      }
      return res;
    }

    const cmd = String.fromCharCode(req[0], req[1], req[2], req[3]);
    res[0] = 0x52; // 'R'
    res[1] = req[1];
    res[2] = req[2];
    res[3] = req[3];

    const writeU16BE = (offset: number, val: number) => {
      res[offset] = (val >> 8) & 0xff;
      res[offset + 1] = val & 0xff;
    };
    const readU16BE = (offset: number) => (req[offset] << 8) | req[offset + 1];

    switch (cmd) {
      case 'DKBC': {
        const slot = req[4] - 0x31;
        if (slot >= 0 && slot < SLOT_COUNT) {
          this.rxMode = 'cfg';
          this.rxSlot = slot;
          this.rxIndex = 0;
          this.rxTotal = 8;
          this.rxBuffer = new Uint8Array(512);
          return res;
        }
        break;
      }
      case 'DLTC': {
        const slot = req[4] - 0x31;
        if (slot >= 0 && slot < SLOT_COUNT) {
          this.rxMode = 'light';
          this.rxSlot = slot;
          this.rxIndex = 0;
          this.rxTotal = 4;
          this.rxBuffer = new Uint8Array(256);
          return res;
        }
        break;
      }
      case 'BCSI': {
        if (this.simulateLegacyFirmware) break;
        res[4] = 0x31 + this.activeSlot;
        return res;
      }
      case 'BRKC': {
        if (this.simulateLegacyFirmware) break;
        const slot = req[4] - 0x31;
        const chunk = req[5];
        if (slot >= 0 && slot < SLOT_COUNT && chunk < 16) {
          res[4] = req[4];
          res[5] = chunk;
          res.set(this.cfgFlash[slot].subarray(chunk * 32, chunk * 32 + 32), 6);
        } else {
          res[4] = 0xff;
        }
        return res;
      }
      case 'BRLC': {
        if (this.simulateLegacyFirmware) break;
        const slot = req[4] - 0x31;
        const chunk = req[5];
        if (slot >= 0 && slot < SLOT_COUNT && chunk < 8) {
          res[4] = req[4];
          res[5] = chunk;
          res.set(this.lightFlash[slot].subarray(chunk * 32, chunk * 32 + 32), 6);
        } else {
          res[4] = 0xff;
        }
        return res;
      }
      case 'BFWV': {
        res[4] = 2;
        res[5] = 1;
        res[6] = 0;
        res[7] = 1;
        return res;
      }
      case 'BUID': {
        const uid = [0xe1, 0x60, 0xde, 0x00, 0x20, 0x26];
        res.set(uid, 4);
        return res;
      }
      case 'BIPT': {
        writeU16BE(4, this.mockLiveInput.rockerX);
        writeU16BE(6, this.mockLiveInput.rockerY);
        res[10] = this.mockLiveInput.ec1Count & 0xff;
        res[11] = this.mockLiveInput.ec2Count & 0xff;
        const mask = this.mockLiveInput.keyMask >>> 0;
        res[12] = (mask >>> 24) & 0xff;
        res[13] = (mask >>> 16) & 0xff;
        res[14] = (mask >>> 8) & 0xff;
        res[15] = mask & 0xff;
        return res;
      }
      case 'BGPM': {
        // 偏移与 ParaConfig.c GlobalParaUpdate 一致：Min0, Min1, Max0, Max1, Mid0, Mid1
        writeU16BE(4 + 0, this.globalParams.rockerMinX);
        writeU16BE(4 + 2, this.globalParams.rockerMinY);
        writeU16BE(4 + 4, this.globalParams.rockerMaxX);
        writeU16BE(4 + 6, this.globalParams.rockerMaxY);
        writeU16BE(4 + 8, this.globalParams.rockerMidX);
        writeU16BE(4 + 10, this.globalParams.rockerMidY);
        res[4 + 16] = this.globalParams.keyDebounce;
        res[4 + 20] =
          (this.globalParams.ec2DoubleFreq ? 0x02 : 0) |
          (this.globalParams.ec1DoubleFreq ? 0x01 : 0);
        return res;
      }
      case 'BDGC': {
        // 模拟健康设备，全 0 错误计数
        return res;
      }
      case 'CKYT': {
        res[4] = this.globalParams.keyDebounce;
        this.globalParams.keyDebounce = Math.min(100, req[4]);
        res[5] = this.globalParams.keyDebounce;
        return res;
      }
      case 'CRKM': {
        writeU16BE(4, this.globalParams.rockerMidX);
        writeU16BE(6, this.globalParams.rockerMidY);
        this.globalParams.rockerMidX = Math.max(
          this.globalParams.rockerMinX + 1,
          Math.min(this.globalParams.rockerMaxX - 1, this.mockLiveInput.rockerX),
        );
        this.globalParams.rockerMidY = Math.max(
          this.globalParams.rockerMinY + 1,
          Math.min(this.globalParams.rockerMaxY - 1, this.mockLiveInput.rockerY),
        );
        writeU16BE(8, this.globalParams.rockerMidX);
        writeU16BE(10, this.globalParams.rockerMidY);
        return res;
      }
      case 'CRKZ': {
        const min0 = readU16BE(4);
        const max0 = readU16BE(6);
        const min1 = readU16BE(8);
        const max1 = readU16BE(10);
        writeU16BE(4, this.globalParams.rockerMinX);
        writeU16BE(6, this.globalParams.rockerMaxX);
        writeU16BE(8, this.globalParams.rockerMinY);
        writeU16BE(10, this.globalParams.rockerMaxY);
        if (
          min0 < this.globalParams.rockerMidX &&
          max0 > this.globalParams.rockerMidX &&
          min1 < this.globalParams.rockerMidY &&
          max1 > this.globalParams.rockerMidY
        ) {
          this.globalParams.rockerMinX = min0;
          this.globalParams.rockerMaxX = max0;
          this.globalParams.rockerMinY = min1;
          this.globalParams.rockerMaxY = max1;
          writeU16BE(12, min0);
          writeU16BE(14, max0);
          writeU16BE(16, min1);
          writeU16BE(18, max1);
        } else {
          writeU16BE(12, 0xffff);
        }
        return res;
      }
      case 'CECD': {
        res[4] = this.globalParams.ec1DoubleFreq ? 1 : 0;
        res[5] = this.globalParams.ec2DoubleFreq ? 1 : 0;
        this.globalParams.ec1DoubleFreq = Boolean(req[4]);
        this.globalParams.ec2DoubleFreq = Boolean(req[5]);
        res[6] = this.globalParams.ec1DoubleFreq ? 1 : 0;
        res[7] = this.globalParams.ec2DoubleFreq ? 1 : 0;
        return res;
      }
      case 'BCSC': {
        res[4] = 0x31 + this.activeSlot;
        const nextSlot = req[4] - 0x31;
        if (nextSlot >= 0 && nextSlot < SLOT_COUNT) {
          this.activeSlot = nextSlot;
          res[5] = req[4];
        } else {
          res[5] = 0xff;
        }
        return res;
      }
      case 'BRST':
      case 'BBOT':
      case 'BBUZ':
      case 'BBTV':
        return res;
    }

    // 非法命令
    res[0] = 0x52; // 'R'
    res[1] = 0x49; // 'I'
    res[2] = 0x4e; // 'N'
    res[3] = 0x56; // 'V'
    return res;
  }

  onReceive(listener: (data: Uint8Array) => void): () => void {
    this.receiveListeners.add(listener);
    return () => this.receiveListeners.delete(listener);
  }

  onStatusChange(listener: (status: TransportStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }
}
