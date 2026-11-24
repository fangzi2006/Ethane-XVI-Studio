import { describe, expect, it } from 'vitest';
import {
  AuxKeyMode,
  EncoderRotateMode,
  IndicatorSource,
  KEY_SECTION_MAX_BYTES,
  KeyMode,
  RockerMode,
  createDefaultKeyboardConfig,
  createDefaultLightConfig,
} from '../types/config';
import { SCENARIO_TEMPLATES } from '../data/presets';
import {
  cursorRangeKeyToPercent,
  decodeDialRotate,
  encodeDialRotate,
  percentToCursorRangeKey,
} from './keycodes';
import {
  EthaneProtocolClient,
  InvalidCommandError,
  calculateKeySectionSize,
  decodeKeyboardConfig,
  decodeLightConfig,
  decodeMacroFile,
  encodeKeyboardConfig,
  encodeLightConfig,
  encodeMacroFile,
  exportPaletteTxt,
  parsePaletteTxt,
} from './protocol';
import { MockTransport } from './transport';

describe('Ethane-XVI 二进制协议编解码', () => {
  it('512B 键盘配置全模式编解码应 100% 无损回环', () => {
    const cfg = createDefaultKeyboardConfig();
    cfg.keys[0] = { ...cfg.keys[0], mode: KeyMode.Single, key: 4 }; // A
    cfg.keys[1] = { ...cfg.keys[1], mode: KeyMode.Shortcut, key: 6, func: 0x05 }; // Ctrl+Alt+C
    cfg.keys[2] = {
      ...cfg.keys[2],
      mode: KeyMode.Macro,
      macro: [
        { id: '1', type: 'key', key: 30, shift: false },
        { id: '2', type: 'key', key: 31, shift: true },
        { id: '3', type: 'shortcut', key: 25, func: 0x01 },
        { id: '4', type: 'move', x: 640, y: 480 },
        { id: '5', type: 'press', x: 1280, y: 720 },
        { id: '6', type: 'delay', ms: 1500 },
        { id: '7', type: 'loopStart' },
        { id: '8', type: 'reportCtrl', end: true, gap: false },
        { id: '9', type: 'loopEnd', auto: true, count: 12 },
      ],
    };
    cfg.keys[3] = { ...cfg.keys[3], mode: KeyMode.CursorMove, x: 100, y: 200 };
    cfg.keys[4] = { ...cfg.keys[4], mode: KeyMode.CursorClick, x: 1900, y: 1050 };
    cfg.keys[5] = { ...cfg.keys[5], mode: KeyMode.SwitchSlot, key: 40, func: 0x84 };
    cfg.keys[6] = { ...cfg.keys[6], mode: KeyMode.Clicker, key: 246, func: 1, delayMs: 250 };
    cfg.keys[7] = { ...cfg.keys[7], mode: KeyMode.Buzzer };
    cfg.keys[8] = { ...cfg.keys[8], mode: KeyMode.Morse, func: (5 << 4) | 2, morseGap: 35, morseLong: 18 };

    cfg.rocker = {
      mode: RockerMode.EightWay,
      keyMode: AuxKeyMode.PermSwitch,
      invertX: true,
      invertY: false,
      rotateR90: true,
      centerKey: 31,
      centerFunc: 0,
      upKey: 26,
      downKey: 22,
      leftKey: 4,
      rightKey: 7,
      deadzone: 25,
      inertia: 12,
      nearParam: 5,
      farParam: 45,
    };

    cfg.encoders[0] = {
      rotateMode: EncoderRotateMode.Dial,
      keyMode: AuxKeyMode.Dial,
      invert: true,
      pressKey: 0,
      pressFunc: 0,
      ccwKey: 31,
      ccwFunc: 0x02,
      cwKey: 35,
      cwFunc: 0,
    };

    cfg.systemLed = {
      tagColor: [10, 200, 150],
      indicatorBrightness: [80, 60, 40],
      channelR: { source: IndicatorSource.MacroRunning, invert: true },
      channelG: { source: IndicatorSource.CapsLock, invert: false },
      channelB: { source: IndicatorSource.ScrollLock, invert: true },
      tagOnTime: 6,
      tagFadeSpeed: 3,
    };

    cfg.screenWidth = 2560;
    cfg.screenHeight = 1440;
    cfg.orientation = 2;
    cfg.priority = true;

    const encoded = encodeKeyboardConfig(cfg);
    expect(encoded.length).toBe(512);

    const decoded = decodeKeyboardConfig(encoded);
    expect(decoded.keys[0].key).toBe(4);
    expect(decoded.keys[1].func).toBe(0x05);
    expect(decoded.keys[2].macro.length).toBe(9);
    expect(decoded.keys[2].macro[4]).toMatchObject({ type: 'press', x: 1280, y: 720 });
    expect(decoded.keys[2].macro[8]).toMatchObject({ type: 'loopEnd', auto: true, count: 12 });
    expect(decoded.keys[6].delayMs).toBe(250);
    expect(decoded.keys[8]).toMatchObject({ mode: KeyMode.Morse, func: (5 << 4) | 2, morseGap: 35, morseLong: 18 });
    expect(decoded.rocker).toEqual(cfg.rocker);
    expect(decoded.encoders[0]).toEqual(cfg.encoders[0]);
    expect(decoded.systemLed).toEqual(cfg.systemLed);
    expect(decoded.screenWidth).toBe(2560);
    expect(decoded.screenHeight).toBe(1440);
    expect(decoded.orientation).toBe(2);
    expect(decoded.priority).toBe(true);
  });

  it('256B 灯效配置编解码应 100% 无损回环', () => {
    const light = createDefaultLightConfig();
    light.upColors[0] = [12, 34, 56];
    light.downColors[15] = [210, 120, 30];
    light.waitTime10ms = 350;
    light.actionTimeMs = 1234;
    light.gapTimeMs = 5678;
    light.randGapTimeMs = 999;
    light.effectListCount = 7;

    const encoded = encodeLightConfig(light);
    expect(encoded.length).toBe(256);
    const decoded = decodeLightConfig(encoded);
    expect(decoded).toEqual(light);
  });

  it('257B .etkey 与配色 .txt 编解码正常', () => {
    const steps = [
      { id: 'a', type: 'shortcut' as const, key: 6, func: 0x01 },
      { id: 'b', type: 'delay' as const, ms: 300 },
    ];
    const buf = encodeMacroFile(steps);
    expect(buf.length).toBe(257);
    const parsed = decodeMacroFile(buf);
    expect(parsed.length).toBe(2);
    expect(parsed[1]).toMatchObject({ type: 'delay', ms: 300 });

    const light = createDefaultLightConfig();
    const txt = exportPaletteTxt(light.upColors);
    expect(parsePaletteTxt(txt)).toEqual(light.upColors);
  });

  it('Dial 旋转角度与摇杆光标百分比辅助编码正确', () => {
    const dial = encodeDialRotate(25, 3);
    expect(decodeDialRotate(dial.ccwKey, dial.cwKey, dial.ccwFunc)).toEqual({
      angle: 25,
      interp: 3,
    });
    for (let pct = 5; pct <= 100; pct += 5) {
      expect(cursorRangeKeyToPercent(percentToCursorRangeKey(pct))).toBe(pct);
    }
  });
});

describe('MockTransport 与 EthaneProtocolClient 完整通信测试', () => {
  it('支持写入并回读键盘配置、灯效配置、全局参数与槽位切换', async () => {
    const transport = new MockTransport({
      encodeCfg: encodeKeyboardConfig,
      encodeLight: encodeLightConfig,
    });
    const client = new EthaneProtocolClient(transport);

    await transport.connect();
    expect(await client.readFirmwareVersion()).toBe('V2.1.0.1');
    expect(await client.readSerialNumber()).toBe('E160DE002026');
    expect(await client.readActiveSlot()).toBe(0);

    // 修改并写入槽位 2
    const cfg = createDefaultKeyboardConfig();
    cfg.keys[0] = { ...cfg.keys[0], mode: KeyMode.Single, key: 26 }; // W
    await client.writeKeyboardConfig(1, cfg);
    const readBack = await client.readKeyboardConfig(1);
    expect(readBack.keys[0].key).toBe(26);

    // 写入并回读灯效
    const light = createDefaultLightConfig();
    light.upColors[3] = [255, 0, 128];
    await client.writeLightConfig(1, light);
    const lightBack = await client.readLightConfig(1);
    expect(lightBack.upColors[3]).toEqual([255, 0, 128]);

    // 切换槽位与全局参数
    await client.switchActiveSlot(1);
    expect(await client.readActiveSlot()).toBe(1);
    await client.setKeyDebounce(8);
    await client.setEncoderDoubleFreq(true, false);
    const gp = await client.readGlobalParams();
    expect(gp.keyDebounce).toBe(8);
    expect(gp.ec1DoubleFreq).toBe(true);
    expect(gp.ec2DoubleFreq).toBe(false);
  });

  it('旧固件未实现回读命令时应抛出 InvalidCommandError 供上层降级', async () => {
    const transport = new MockTransport({
      encodeCfg: encodeKeyboardConfig,
      encodeLight: encodeLightConfig,
    });
    transport.simulateLegacyFirmware = true;
    const client = new EthaneProtocolClient(transport);
    await transport.connect();

    await expect(client.readKeyboardConfig(0)).rejects.toBeInstanceOf(InvalidCommandError);
    await expect(client.readLightConfig(0)).rejects.toBeInstanceOf(InvalidCommandError);
  });

  it('所有场景预设均满足 512B/256B 容量限制并可无损编解码', () => {
    expect(SCENARIO_TEMPLATES.length).toBe(5);
    for (const tpl of SCENARIO_TEMPLATES) {
      const cfg = tpl.buildConfig();
      const light = tpl.buildLight();
      expect(calculateKeySectionSize(cfg.keys)).toBeLessThanOrEqual(KEY_SECTION_MAX_BYTES);

      const cfgBytes = encodeKeyboardConfig(cfg);
      const lightBytes = encodeLightConfig(light);
      expect(cfgBytes.length).toBe(512);
      expect(lightBytes.length).toBe(256);

      const decodedCfg = decodeKeyboardConfig(cfgBytes);
      const decodedLight = decodeLightConfig(lightBytes);
      expect(encodeKeyboardConfig(decodedCfg)).toEqual(cfgBytes);
      expect(decodedLight).toEqual(light);
    }
  });
});
