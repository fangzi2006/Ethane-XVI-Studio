import {
  AuxKeyMode,
  DiagnosticData,
  EC_NUM,
  EncoderRotateMode,
  GlobalParams,
  IndicatorSource,
  KEY_NUM,
  KEY_SECTION_MAX_BYTES,
  KeyConfig,
  KeyMode,
  KeyboardConfig,
  LIGHT_LIST_MAX,
  LightConfig,
  LiveInputState,
  MacroStep,
  RgbTuple,
  RockerMode,
  SLOT_COUNT,
  createDefaultKeyboardConfig,
  createDefaultLightConfig,
} from '../types/config';
import {
  KV_DELAY,
  KV_LOOP,
  KV_MOVE,
  KV_PRESS,
  KV_REPORT,
  KV_SHIFT,
  KV_SHORTCUT,
} from './keycodes';
import type { ITransport } from './transport';

export class InvalidCommandError extends Error {
  constructor(public readonly command: string) {
    super(`设备不支持指令 ${command}（返回 RINV）`);
    this.name = 'InvalidCommandError';
  }
}

function encodeMacroSteps(steps: MacroStep[]): number[] {
  const bytes: number[] = [];
  for (const step of steps) {
    switch (step.type) {
      case 'key':
        if (step.shift) bytes.push(KV_SHIFT);
        bytes.push(step.key & 0xff);
        break;
      case 'shortcut':
        bytes.push(KV_SHORTCUT, step.key & 0xff, step.func & 0xff);
        break;
      case 'move':
      case 'press':
        bytes.push(
          step.type === 'press' ? KV_PRESS : KV_MOVE,
          (step.x >> 8) & 0xff,
          step.x & 0xff,
          (step.y >> 8) & 0xff,
          step.y & 0xff,
        );
        break;
      case 'delay':
        bytes.push(KV_DELAY, (step.ms >> 8) & 0xff, step.ms & 0xff);
        break;
      case 'loopStart':
        bytes.push(KV_LOOP, 0x02, 0, 0);
        break;
      case 'loopEnd':
        bytes.push(
          KV_LOOP,
          step.auto ? 0x01 : 0x00,
          (step.count >> 8) & 0xff,
          step.count & 0xff,
        );
        break;
      case 'reportCtrl':
        bytes.push(KV_REPORT, (step.end ? 0x02 : 0) | (step.gap ? 0x01 : 0));
        break;
    }
  }
  return bytes;
}

function decodeMacroBytes(buf: Uint8Array, start: number, len: number): MacroStep[] {
  const steps: MacroStep[] = [];
  let i = start;
  const end = Math.min(buf.length, start + len);
  let seq = 0;

  while (i < end) {
    const code = buf[i];
    const id = `m-${start}-${seq++}`;
    if (code === KV_SHORTCUT && i + 2 < end) {
      steps.push({ id, type: 'shortcut', key: buf[i + 1], func: buf[i + 2] });
      i += 3;
    } else if ((code === KV_MOVE || code === KV_PRESS) && i + 4 < end) {
      const x = (buf[i + 1] << 8) | buf[i + 2];
      const y = (buf[i + 3] << 8) | buf[i + 4];
      steps.push({ id, type: code === KV_PRESS ? 'press' : 'move', x, y });
      i += 5;
    } else if (code === KV_DELAY && i + 2 < end) {
      const ms = (buf[i + 1] << 8) | buf[i + 2];
      steps.push({ id, type: 'delay', ms });
      i += 3;
    } else if (code === KV_SHIFT && i + 1 < end) {
      steps.push({ id, type: 'key', key: buf[i + 1], shift: true });
      i += 2;
    } else if (code === KV_LOOP && i + 3 < end) {
      const func = buf[i + 1];
      const count = (buf[i + 2] << 8) | buf[i + 3];
      if (func === 0x02) {
        steps.push({ id, type: 'loopStart' });
      } else {
        steps.push({ id, type: 'loopEnd', auto: Boolean(func & 0x01), count });
      }
      i += 4;
    } else if (code === KV_REPORT && i + 1 < end) {
      const func = buf[i + 1];
      steps.push({
        id,
        type: 'reportCtrl',
        end: Boolean(func & 0x02),
        gap: Boolean(func & 0x01),
      });
      i += 2;
    } else {
      steps.push({ id, type: 'key', key: code, shift: false });
      i += 1;
    }
  }
  return steps;
}

export function getMacroByteLength(steps: MacroStep[]): number {
  return encodeMacroSteps(steps).length;
}

export function calculateKeySectionSize(keys: KeyConfig[]): number {
  let size = 0;
  for (let idx = 0; idx < KEY_NUM; idx++) {
    const k = keys[idx];
    size += 2; // id + mode
    switch (k.mode) {
      case KeyMode.Single:
        size += 1;
        break;
      case KeyMode.Shortcut:
      case KeyMode.SwitchSlot:
        size += 2;
        break;
      case KeyMode.Macro:
        size += 1 + encodeMacroSteps(k.macro).length;
        break;
      case KeyMode.CursorMove:
      case KeyMode.CursorClick:
      case KeyMode.Clicker:
        size += 4;
        break;
      case KeyMode.Morse:
        size += 3;
        break;
      default:
        break;
    }
  }
  return size;
}

/** 序列化 512 字节键盘配置 (.etcfg) */
export function encodeKeyboardConfig(cfg: KeyboardConfig): Uint8Array {
  const buf = new Uint8Array(512);
  let i = 0;

  for (let keyi = 0; keyi < KEY_NUM; keyi++) {
    const k = cfg.keys[keyi];
    buf[i++] = keyi + 1;
    buf[i++] = k.mode & 0xff;
    switch (k.mode) {
      case KeyMode.Single:
        buf[i++] = k.key & 0xff;
        break;
      case KeyMode.Shortcut:
      case KeyMode.SwitchSlot:
        buf[i++] = k.key & 0xff;
        buf[i++] = k.func & 0xff;
        break;
      case KeyMode.Macro: {
        const macroBytes = encodeMacroSteps(k.macro);
        if (macroBytes.length > 255) {
          throw new Error(`按键 K${keyi + 1} 宏数据超过 255 字节上限`);
        }
        buf[i++] = macroBytes.length;
        for (const b of macroBytes) {
          buf[i++] = b;
        }
        break;
      }
      case KeyMode.CursorMove:
      case KeyMode.CursorClick:
        buf[i++] = (k.x >> 8) & 0xff;
        buf[i++] = k.x & 0xff;
        buf[i++] = (k.y >> 8) & 0xff;
        buf[i++] = k.y & 0xff;
        break;
      case KeyMode.Clicker:
        buf[i++] = k.key & 0xff;
        buf[i++] = k.func & 0xff;
        buf[i++] = (k.delayMs >> 8) & 0xff;
        buf[i++] = k.delayMs & 0xff;
        break;
      case KeyMode.Morse:
        buf[i++] = k.func & 0xff;
        buf[i++] = k.morseGap & 0xff;
        buf[i++] = k.morseLong & 0xff;
        break;
      default:
        break;
    }
  }

  if (i > KEY_SECTION_MAX_BYTES) {
    throw new Error(`按键总配置长度 ${i}B 超过固件 468B 上限，请精简部分宏步骤`);
  }

  // 摇杆 (468..479)
  i = 468;
  const rk = cfg.rocker;
  buf[i++] = (rk.mode & 0x0f) | ((rk.keyMode & 0x0f) << 4);
  buf[i++] = (rk.rotateR90 ? 0x04 : 0) | (rk.invertY ? 0x02 : 0) | (rk.invertX ? 0x01 : 0);
  buf[i++] = rk.centerKey & 0xff;
  buf[i++] = rk.upKey & 0xff;
  buf[i++] = rk.downKey & 0xff;
  buf[i++] = rk.leftKey & 0xff;
  buf[i++] = rk.rightKey & 0xff;
  buf[i++] = rk.centerFunc & 0xff;
  buf[i++] = rk.deadzone & 0xff;
  buf[i++] = rk.inertia & 0xff;
  buf[i++] = rk.nearParam & 0xff;
  buf[i++] = rk.farParam & 0xff;

  // 双旋钮 (480..495)
  for (let e = 0; e < EC_NUM; e++) {
    const ec = cfg.encoders[e];
    buf[i++] = (ec.rotateMode & 0x0f) | ((ec.keyMode & 0x0f) << 4);
    buf[i++] = ec.invert ? 0x01 : 0x00;
    buf[i++] = ec.pressKey & 0xff;
    buf[i++] = ec.ccwKey & 0xff;
    buf[i++] = ec.cwKey & 0xff;
    buf[i++] = ec.pressFunc & 0xff;
    buf[i++] = ec.ccwFunc & 0xff;
    buf[i++] = ec.cwFunc & 0xff;
  }

  // 系统指示灯 (496..505)
  const led = cfg.systemLed;
  buf[i++] = led.tagColor[0] & 0xff;
  buf[i++] = led.tagColor[1] & 0xff;
  buf[i++] = led.tagColor[2] & 0xff;
  buf[i++] = led.indicatorBrightness[0] & 0xff;
  buf[i++] = led.indicatorBrightness[1] & 0xff;
  buf[i++] = led.indicatorBrightness[2] & 0xff;
  buf[i++] = (led.channelR.source & 0x0f) | (led.channelR.invert ? 0x80 : 0);
  buf[i++] = (led.channelG.source & 0x0f) | (led.channelG.invert ? 0x80 : 0);
  buf[i++] = (led.channelB.source & 0x0f) | (led.channelB.invert ? 0x80 : 0);
  buf[i++] = ((led.tagOnTime & 0x0f) << 4) | (led.tagFadeSpeed & 0x0f);

  // 系统设置 (506..511)
  buf[i++] = (cfg.screenWidth >> 8) & 0xff;
  buf[i++] = cfg.screenWidth & 0xff;
  buf[i++] = (cfg.screenHeight >> 8) & 0xff;
  buf[i++] = cfg.screenHeight & 0xff;
  buf[i++] = cfg.orientation & 0xff;
  buf[i] = cfg.priority ? 0x01 : 0x00;

  return buf;
}

/** 反序列化 512 字节键盘配置 (.etcfg) */
export function decodeKeyboardConfig(buf: Uint8Array): KeyboardConfig {
  if (buf.length !== 512) {
    throw new Error(`无效的键盘配置文件长度：期望 512 字节，实际 ${buf.length} 字节`);
  }
  const cfg = createDefaultKeyboardConfig();
  let i = 0;

  // 若 Flash 全为 0xFF 或 0x00（未初始化槽位），返回默认配置
  if (buf[0] !== 1) {
    return cfg;
  }

  for (let keyi = 0; keyi < KEY_NUM; keyi++) {
    if (buf[i++] !== keyi + 1) {
      throw new Error(`键盘配置按键 ID 校验失败（位于 K${keyi + 1}）`);
    }
    const mode = buf[i++] as KeyMode;
    if (mode > KeyMode.Morse) {
      throw new Error(`按键 K${keyi + 1} 包含未知模式 ${mode}`);
    }
    const k = cfg.keys[keyi];
    k.mode = mode;

    switch (mode) {
      case KeyMode.Single:
        k.key = buf[i++];
        break;
      case KeyMode.Shortcut:
      case KeyMode.SwitchSlot:
        k.key = buf[i++];
        k.func = buf[i++];
        break;
      case KeyMode.Macro: {
        const len = buf[i++];
        k.macro = decodeMacroBytes(buf, i, len);
        i += len;
        break;
      }
      case KeyMode.CursorMove:
      case KeyMode.CursorClick:
        k.x = (buf[i] << 8) | buf[i + 1];
        k.y = (buf[i + 2] << 8) | buf[i + 3];
        i += 4;
        break;
      case KeyMode.Clicker:
        k.key = buf[i++];
        k.func = buf[i++];
        k.delayMs = (buf[i] << 8) | buf[i + 1];
        i += 2;
        break;
      case KeyMode.Morse:
        k.func = buf[i++];
        k.morseGap = buf[i++];
        k.morseLong = buf[i++];
        break;
      default:
        break;
    }
  }

  i = 468;
  cfg.rocker = {
    mode: (buf[i] & 0x0f) as RockerMode,
    keyMode: ((buf[i++] >> 4) & 0x0f) as AuxKeyMode,
    rotateR90: Boolean(buf[i] & 0x04),
    invertY: Boolean(buf[i] & 0x02),
    invertX: Boolean(buf[i++] & 0x01),
    centerKey: buf[i++],
    upKey: buf[i++],
    downKey: buf[i++],
    leftKey: buf[i++],
    rightKey: buf[i++],
    centerFunc: buf[i++],
    deadzone: buf[i++],
    inertia: buf[i++],
    nearParam: buf[i++],
    farParam: buf[i++],
  };

  for (let e = 0; e < EC_NUM; e++) {
    cfg.encoders[e] = {
      rotateMode: (buf[i] & 0x0f) as EncoderRotateMode,
      keyMode: ((buf[i++] >> 4) & 0x0f) as AuxKeyMode,
      invert: Boolean(buf[i++] & 0x01),
      pressKey: buf[i++],
      ccwKey: buf[i++],
      cwKey: buf[i++],
      pressFunc: buf[i++],
      ccwFunc: buf[i++],
      cwFunc: buf[i++],
    };
  }

  cfg.systemLed = {
    tagColor: [buf[i++], buf[i++], buf[i++]],
    indicatorBrightness: [buf[i++], buf[i++], buf[i++]],
    channelR: { source: (buf[i] & 0x0f) as IndicatorSource, invert: Boolean(buf[i++] & 0x80) },
    channelG: { source: (buf[i] & 0x0f) as IndicatorSource, invert: Boolean(buf[i++] & 0x80) },
    channelB: { source: (buf[i] & 0x0f) as IndicatorSource, invert: Boolean(buf[i++] & 0x80) },
    tagOnTime: (buf[i] >> 4) & 0x0f,
    tagFadeSpeed: buf[i++] & 0x0f,
  };

  cfg.screenWidth = (buf[i] << 8) | buf[i + 1];
  i += 2;
  cfg.screenHeight = (buf[i] << 8) | buf[i + 1];
  i += 2;
  cfg.orientation = Math.min(3, buf[i++]);
  cfg.priority = buf[i] === 0x01;

  return cfg;
}

/** 序列化 256 字节灯效配置 (.etlight) */
export function encodeLightConfig(light: LightConfig): Uint8Array {
  const buf = new Uint8Array(256);

  for (let k = 0; k < KEY_NUM; k++) {
    buf[k * 3 + 0] = light.upColors[k][0] & 0xff;
    buf[k * 3 + 1] = light.upColors[k][1] & 0xff;
    buf[k * 3 + 2] = light.upColors[k][2] & 0xff;

    buf[48 + k * 3 + 0] = light.downColors[k][0] & 0xff;
    buf[48 + k * 3 + 1] = light.downColors[k][1] & 0xff;
    buf[48 + k * 3 + 2] = light.downColors[k][2] & 0xff;

    buf[96 + k] = light.pressFade[k] & 0xff;
    buf[112 + k] = light.releaseFade[k] & 0xff;
    buf[128 + k] = light.shieldRemain[k] & 0xff;
    buf[144 + k] = light.customOrder[k] & 0xff;
  }

  for (let j = 0; j < LIGHT_LIST_MAX; j++) {
    buf[224 + j] = (light.effectList[j] ?? 0) & 0xff;
  }
  buf[235] = Math.max(0, Math.min(LIGHT_LIST_MAX - 1, light.effectListCount - 1));
  buf[238] = light.switchPolicy & 0xff;
  buf[240] = light.direction & 0xff;
  buf[241] = light.waveMode & 0xff;
  buf[242] = light.colorShiftTarget & 0xff;
  buf[243] = light.colorShiftPeriod & 0xff;

  const writeU16BE = (offset: number, val: number) => {
    buf[offset] = (val >> 8) & 0xff;
    buf[offset + 1] = val & 0xff;
  };
  writeU16BE(244, light.waitTime10ms);
  writeU16BE(246, light.actionTimeMs);
  writeU16BE(248, light.gapTimeMs);
  writeU16BE(250, light.randGapTimeMs);

  buf[252] = light.fadeOn & 0xff;
  buf[253] = light.fadeOff & 0xff;
  buf[254] = light.shieldFadeOn & 0xff;
  buf[255] = light.shieldFadeOff & 0xff;

  return buf;
}

/** 反序列化 256 字节灯效配置 (.etlight) */
export function decodeLightConfig(buf: Uint8Array): LightConfig {
  if (buf.length !== 256) {
    throw new Error(`无效的灯效文件长度：期望 256 字节，实际 ${buf.length} 字节`);
  }
  // 判断是否为擦除态全 0xFF Flash
  if (buf[238] === 0xff && buf[241] === 0xff && buf[235] === 0xff) {
    return createDefaultLightConfig();
  }
  const light = createDefaultLightConfig();

  for (let k = 0; k < KEY_NUM; k++) {
    light.upColors[k] = [buf[k * 3], buf[k * 3 + 1], buf[k * 3 + 2]];
    light.downColors[k] = [buf[48 + k * 3], buf[48 + k * 3 + 1], buf[48 + k * 3 + 2]];
    light.pressFade[k] = Math.min(30, buf[96 + k]);
    light.releaseFade[k] = Math.min(30, buf[112 + k]);
    light.shieldRemain[k] = buf[128 + k];
    light.customOrder[k] = Math.min(15, buf[144 + k]);
  }

  for (let j = 0; j < LIGHT_LIST_MAX; j++) {
    light.effectList[j] = Math.min(5, buf[224 + j]);
  }
  light.effectListCount = Math.max(1, Math.min(LIGHT_LIST_MAX, buf[235] + 1));
  light.switchPolicy = Math.min(2, buf[238]);
  light.direction = Math.min(7, buf[240]);
  light.waveMode = Math.min(7, buf[241]);
  light.colorShiftTarget = Math.min(3, buf[242]);
  light.colorShiftPeriod = buf[243];

  const readU16BE = (offset: number) => (buf[offset] << 8) | buf[offset + 1];
  light.waitTime10ms = readU16BE(244);
  light.actionTimeMs = readU16BE(246);
  light.gapTimeMs = readU16BE(248);
  light.randGapTimeMs = readU16BE(250);

  light.fadeOn = Math.min(30, buf[252]);
  light.fadeOff = Math.min(30, buf[253]);
  light.shieldFadeOn = Math.min(30, buf[254]);
  light.shieldFadeOff = Math.min(30, buf[255]);

  return light;
}

/** 257 字节 .etkey 宏文件编解码 */
export function encodeMacroFile(steps: MacroStep[]): Uint8Array {
  const raw = encodeMacroSteps(steps);
  if (raw.length > 255) {
    throw new Error('宏数据超过 255 字节上限');
  }
  const buf = new Uint8Array(257);
  buf.set(raw, 0);
  buf[256] = raw.length;
  return buf;
}

export function decodeMacroFile(buf: Uint8Array): MacroStep[] {
  if (buf.length !== 257) {
    throw new Error(`无效的 .etkey 文件长度：期望 257 字节，实际 ${buf.length} 字节`);
  }
  return decodeMacroBytes(buf, 0, buf[256]);
}

/** 配色明文 .txt 导入导出（16 组 R,G,B） */
export function parsePaletteTxt(text: string): RgbTuple[] {
  const nums = (text.match(/\d+/g) ?? []).map((n) => Math.max(0, Math.min(255, parseInt(n, 10))));
  if (nums.length < KEY_NUM * 3) {
    throw new Error(`配色文件数值不足（需要 48 个 0~255 数值，当前仅有 ${nums.length} 个）`);
  }
  return Array.from({ length: KEY_NUM }, (_, i) => [
    nums[i * 3],
    nums[i * 3 + 1],
    nums[i * 3 + 2],
  ]);
}

export function exportPaletteTxt(colors: RgbTuple[]): string {
  const lines: string[] = [];
  for (let row = 0; row < 4; row++) {
    const parts: string[] = [];
    for (let col = 0; col < 4; col++) {
      const [r, g, b] = colors[row * 4 + col];
      parts.push(
        `${String(r).padStart(3, '0')},${String(g).padStart(3, '0')},${String(b).padStart(3, '0')},`,
      );
    }
    lines.push(parts.join(' '));
  }
  return lines.join('\n') + '\n';
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Ethane-XVI 协议客户端：负责指令封包、解包、多包分片与串行事务调度，完全与 UI 解耦。
 */
export class EthaneProtocolClient {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly transport: ITransport) {}

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => {});
    return run;
  }

  private async transact(packet: Uint8Array, timeoutMs = 600): Promise<Uint8Array> {
    return new Promise<Uint8Array>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          unsub();
          reject(new Error('设备响应超时（500ms）'));
        }
      }, timeoutMs);

      const unsub = this.transport.onReceive((resp) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          unsub();
          resolve(resp);
        }
      });

      this.transport.send(packet).catch((err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          unsub();
          reject(err);
        }
      });
    });
  }

  private buildCommandPacket(cmd: string, payload?: number[]): Uint8Array {
    const pkt = new Uint8Array(64);
    for (let i = 0; i < 4; i++) pkt[i] = cmd.charCodeAt(i);
    if (payload) {
      for (let i = 0; i < payload.length && i < 60; i++) {
        pkt[4 + i] = payload[i] & 0xff;
      }
    }
    return pkt;
  }

  private assertValidResponse(cmd: string, resp: Uint8Array): void {
    if (
      resp[0] === 0x52 &&
      resp[1] === 0x49 &&
      resp[2] === 0x4e &&
      resp[3] === 0x56
    ) {
      throw new InvalidCommandError(cmd);
    }
    if (
      resp[0] !== 0x52 ||
      resp[1] !== cmd.charCodeAt(1) ||
      resp[2] !== cmd.charCodeAt(2) ||
      resp[3] !== cmd.charCodeAt(3)
    ) {
      throw new Error(`命令 ${cmd} 收到异常响应头`);
    }
  }

  async readFirmwareVersion(): Promise<string> {
    return this.enqueue(async () => {
      const resp = await this.transact(this.buildCommandPacket('BFWV'));
      this.assertValidResponse('BFWV', resp);
      return `V${resp[4]}.${resp[5]}.${resp[6]}.${resp[7]}`;
    });
  }

  async readSerialNumber(): Promise<string> {
    return this.enqueue(async () => {
      const resp = await this.transact(this.buildCommandPacket('BUID'));
      this.assertValidResponse('BUID', resp);
      return Array.from(resp.subarray(4, 10))
        .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
        .join('');
    });
  }

  async readGlobalParams(): Promise<GlobalParams> {
    return this.enqueue(async () => {
      const resp = await this.transact(this.buildCommandPacket('BGPM'));
      this.assertValidResponse('BGPM', resp);
      const u16 = (off: number) => (resp[4 + off] << 8) | resp[4 + off + 1];
      return {
        rockerMinX: u16(0),
        rockerMinY: u16(2),
        rockerMaxX: u16(4),
        rockerMaxY: u16(6),
        rockerMidX: u16(8),
        rockerMidY: u16(10),
        keyDebounce: resp[4 + 16],
        ec1DoubleFreq: Boolean(resp[4 + 20] & 0x01),
        ec2DoubleFreq: Boolean(resp[4 + 20] & 0x02),
      };
    });
  }

  async readLiveInput(): Promise<LiveInputState> {
    return this.enqueue(async () => {
      const resp = await this.transact(this.buildCommandPacket('BIPT'));
      this.assertValidResponse('BIPT', resp);
      const rockerX = (resp[4] << 8) | resp[5];
      const rockerY = (resp[6] << 8) | resp[7];
      const ec1Count = resp[10];
      const ec2Count = resp[11];
      const auxMask = (resp[12] << 8) | resp[13];
      const keyMask = (resp[14] << 8) | resp[15];
      return { rockerX, rockerY, ec1Count, ec2Count, keyMask, auxMask };
    });
  }

  async readDiagnostics(): Promise<DiagnosticData> {
    return this.enqueue(async () => {
      const resp = await this.transact(this.buildCommandPacket('BDGC'));
      this.assertValidResponse('BDGC', resp);
      const u16 = (idx: number) => (resp[4 + idx * 2] << 8) | resp[4 + idx * 2 + 1];
      return {
        flagError: u16(0),
        checksumError: u16(1),
        watchdogResets: u16(4),
        consecutiveWatchdogResets: u16(5),
        cfgErrors: Array.from({ length: 8 }, (_, i) => u16(8 + i)),
        lightErrors: Array.from({ length: 8 }, (_, i) => u16(16 + i)),
        globalError: u16(24),
        lastErrorPos: (u16(27) >> 8) & 0xff,
      };
    });
  }

  /** 扩展协议：读取设备当前激活的配置槽位 (0..7) */
  async readActiveSlot(): Promise<number> {
    return this.enqueue(async () => {
      const resp = await this.transact(this.buildCommandPacket('BCSI'));
      this.assertValidResponse('BCSI', resp);
      const slot = resp[4] - 0x31;
      if (slot < 0 || slot >= SLOT_COUNT) throw new Error('设备返回了非法的配置槽位');
      return slot;
    });
  }

  /** 扩展协议：从设备 Flash 分 16 包回读 512B 键盘配置 */
  async readKeyboardConfig(
    slot: number,
    onProgress?: (pct: number) => void,
  ): Promise<KeyboardConfig> {
    return this.enqueue(async () => {
      const buf = new Uint8Array(512);
      const slotChar = 0x31 + slot;
      for (let chunk = 0; chunk < 16; chunk++) {
        const resp = await this.transact(this.buildCommandPacket('BRKC', [slotChar, chunk]));
        this.assertValidResponse('BRKC', resp);
        if (resp[4] !== slotChar || resp[5] !== chunk) {
          throw new Error(`键盘配置回读分片校验失败（chunk ${chunk}）`);
        }
        buf.set(resp.subarray(6, 38), chunk * 32);
        onProgress?.(Math.round(((chunk + 1) / 16) * 100));
      }
      return decodeKeyboardConfig(buf);
    });
  }

  /** 扩展协议：从设备 Flash 分 8 包回读 256B 灯效配置 */
  async readLightConfig(
    slot: number,
    onProgress?: (pct: number) => void,
  ): Promise<LightConfig> {
    return this.enqueue(async () => {
      const buf = new Uint8Array(256);
      const slotChar = 0x31 + slot;
      for (let chunk = 0; chunk < 8; chunk++) {
        const resp = await this.transact(this.buildCommandPacket('BRLC', [slotChar, chunk]));
        this.assertValidResponse('BRLC', resp);
        if (resp[4] !== slotChar || resp[5] !== chunk) {
          throw new Error(`灯效配置回读分片校验失败（chunk ${chunk}）`);
        }
        buf.set(resp.subarray(6, 38), chunk * 32);
        onProgress?.(Math.round(((chunk + 1) / 8) * 100));
      }
      return decodeLightConfig(buf);
    });
  }

  /** 写入指定槽位的 512B 键盘配置 */
  async writeKeyboardConfig(
    slot: number,
    cfg: KeyboardConfig,
    onProgress?: (pct: number) => void,
  ): Promise<void> {
    const raw = encodeKeyboardConfig(cfg);
    return this.enqueue(async () => {
      const initResp = await this.transact(this.buildCommandPacket('DKBC', [0x31 + slot]));
      this.assertValidResponse('DKBC', initResp);
      for (let pack = 0; pack < 8; pack++) {
        await sleep(5);
        const chunk = raw.subarray(pack * 64, (pack + 1) * 64);
        const resp = await this.transact(chunk);
        if (resp[0] !== 0x52 || resp[1] !== 0x44 || resp[2] !== pack) {
          throw new Error(`键盘配置第 ${pack + 1}/8 包写入确认失败`);
        }
        onProgress?.(Math.round(((pack + 1) / 8) * 100));
      }
    });
  }

  /** 写入指定槽位的 256B 灯效配置 */
  async writeLightConfig(
    slot: number,
    light: LightConfig,
    onProgress?: (pct: number) => void,
  ): Promise<void> {
    const raw = encodeLightConfig(light);
    return this.enqueue(async () => {
      const initResp = await this.transact(this.buildCommandPacket('DLTC', [0x31 + slot]));
      this.assertValidResponse('DLTC', initResp);
      for (let pack = 0; pack < 4; pack++) {
        await sleep(5);
        const chunk = raw.subarray(pack * 64, (pack + 1) * 64);
        const resp = await this.transact(chunk);
        if (resp[0] !== 0x52 || resp[1] !== 0x44 || resp[2] !== pack) {
          throw new Error(`灯效配置第 ${pack + 1}/4 包写入确认失败`);
        }
        onProgress?.(Math.round(((pack + 1) / 4) * 100));
      }
    });
  }

  async setKeyDebounce(val: number): Promise<{ oldVal: number; newVal: number }> {
    return this.enqueue(async () => {
      const resp = await this.transact(this.buildCommandPacket('CKYT', [val]));
      this.assertValidResponse('CKYT', resp);
      return { oldVal: resp[4], newVal: resp[5] };
    });
  }

  async calibrateRockerMid(): Promise<{
    oldMidX: number;
    oldMidY: number;
    newMidX: number;
    newMidY: number;
  }> {
    return this.enqueue(async () => {
      const resp = await this.transact(this.buildCommandPacket('CRKM'));
      this.assertValidResponse('CRKM', resp);
      const u16 = (off: number) => (resp[off] << 8) | resp[off + 1];
      return {
        oldMidX: u16(4),
        oldMidY: u16(6),
        newMidX: u16(8),
        newMidY: u16(10),
      };
    });
  }

  async setRockerRange(minX: number, maxX: number, minY: number, maxY: number): Promise<void> {
    return this.enqueue(async () => {
      const payload = [
        (minX >> 8) & 0xff, minX & 0xff,
        (maxX >> 8) & 0xff, maxX & 0xff,
        (minY >> 8) & 0xff, minY & 0xff,
        (maxY >> 8) & 0xff, maxY & 0xff,
      ];
      const resp = await this.transact(this.buildCommandPacket('CRKZ', payload));
      this.assertValidResponse('CRKZ', resp);
      const status = (resp[12] << 8) | resp[13];
      if (status === 0xffff) {
        throw new Error('摇杆范围被设备拒绝，请确认满足 Min < 中位 < Max');
      }
    });
  }

  async setEncoderDoubleFreq(ec1: boolean, ec2: boolean): Promise<void> {
    return this.enqueue(async () => {
      const resp = await this.transact(
        this.buildCommandPacket('CECD', [ec1 ? 1 : 0, ec2 ? 1 : 0]),
      );
      this.assertValidResponse('CECD', resp);
    });
  }

  async switchActiveSlot(slot: number): Promise<{ oldSlot: number; newSlot: number }> {
    return this.enqueue(async () => {
      const resp = await this.transact(this.buildCommandPacket('BCSC', [0x31 + slot]));
      this.assertValidResponse('BCSC', resp);
      if (resp[5] === 0xff) throw new Error('槽位切换被设备拒绝');
      return { oldSlot: resp[4] - 0x31, newSlot: resp[5] - 0x31 };
    });
  }

  async softReset(): Promise<void> {
    return this.enqueue(async () => {
      const resp = await this.transact(this.buildCommandPacket('BRST'));
      this.assertValidResponse('BRST', resp);
    });
  }

  async enterBootloader(): Promise<void> {
    return this.enqueue(async () => {
      const resp = await this.transact(this.buildCommandPacket('BBOT'));
      this.assertValidResponse('BBOT', resp);
    });
  }

  async enterBuzzerMode(): Promise<void> {
    return this.enqueue(async () => {
      const resp = await this.transact(this.buildCommandPacket('BBUZ'));
      this.assertValidResponse('BBUZ', resp);
    });
  }

  async playBuzzerNote(note: number, volume: number): Promise<void> {
    return this.enqueue(async () => {
      const resp = await this.transact(this.buildCommandPacket('BBTV', [note, volume]));
      this.assertValidResponse('BBTV', resp);
    });
  }
}
