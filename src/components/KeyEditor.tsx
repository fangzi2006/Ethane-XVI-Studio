import { Gamepad2, Lightbulb, RotateCw } from 'lucide-react';
import {
  AuxKeyMode,
  EncoderConfig,
  EncoderRotateMode,
  IndicatorSource,
  KEY_MODE_LABELS,
  KEY_SECTION_MAX_BYTES,
  KeyConfig,
  KeyMode,
  RockerMode,
  SLOT_COUNT,
  simulateLedRgb,
} from '../types/config';
import {
  cursorRangeKeyToPercent,
  decodeDialRotate,
  digitToUsbKey,
  encodeDialRotate,
  percentToCursorRangeKey,
  usbKeyToDigit,
} from '../services/keycodes';
import { calculateKeySectionSize } from '../services/protocol';
import { useDevice } from '../store/useDeviceStore';
import { KeyCaptureInput } from './KeyCaptureInput';
import { MacroBuilder } from './MacroBuilder';

const TAG_ON_OPTIONS = ['无', '极短', '0.01s', '0.05s', '0.1s', '0.5s', '1s', '2s'];
const TAG_FADE_OPTIONS = ['不灭 (常亮)', '慢速', '中速', '快速', '立刻熄灭'];
const INDICATOR_OPTIONS = [
  { value: IndicatorSource.None, label: '不使用' },
  { value: IndicatorSource.NumLock, label: '数字锁定 (NumLock)' },
  { value: IndicatorSource.CapsLock, label: '大写锁定 (CapsLock)' },
  { value: IndicatorSource.ScrollLock, label: '滚动锁定 (ScrollLock)' },
  { value: IndicatorSource.AutoClicker, label: '自动连点运行中' },
  { value: IndicatorSource.MacroRunning, label: '宏（按键组）运行中' },
];

export function KeyEditor() {
  const { selection, keyboardConfig, setKeyboardConfig } = useDevice();
  const totalKeyBytes = calculateKeySectionSize(keyboardConfig.keys);

  // -------------------- 1. 机械按键 K1~K16 编辑 --------------------
  if (selection.kind === 'key') {
    const idx = selection.index;
    const keyCfg = keyboardConfig.keys[idx];

    const patchKey = (patch: Partial<KeyConfig>) => {
      setKeyboardConfig((prev) => {
        const nextKeys = [...prev.keys];
        nextKeys[idx] = { ...nextKeys[idx], ...patch };
        return { ...prev, keys: nextKeys };
      });
    };

    const isTempSwitch = Boolean(keyCfg.func & 0x80);
    const switchTarget = Math.max(1, Math.min(8, keyCfg.func & 0x0f || 1));
    const morseVol = (keyCfg.func >> 4) & 0x0f;
    const morseType = keyCfg.func & 0x03; // 0=点, 1=划, 2=单键

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15 font-mono text-sm font-bold text-indigo-300">
              K{idx + 1}
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">按键 K{idx + 1} 功能配置</h2>
              <p className="text-xs text-slate-400">{KEY_MODE_LABELS[keyCfg.mode].desc}</p>
            </div>
          </div>
          <div className="text-xs text-slate-400">
            总配置空间：
            <span
              className={`font-mono font-semibold ${
                totalKeyBytes > KEY_SECTION_MAX_BYTES ? 'text-rose-400' : 'text-slate-200'
              }`}
            >
              {totalKeyBytes} / {KEY_SECTION_MAX_BYTES} B
            </span>
          </div>
        </div>

        {/* 模式卡片选择器 */}
        <div>
          <label className="mb-2 block text-xs font-medium text-slate-400">选择工作模式</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(Object.keys(KEY_MODE_LABELS) as unknown as KeyMode[]).map((m) => {
              const modeNum = Number(m) as KeyMode;
              const active = keyCfg.mode === modeNum;
              return (
                <button
                  key={modeNum}
                  type="button"
                  onClick={() => patchKey({ mode: modeNum })}
                  className={`rounded-xl border px-2.5 py-2 text-left text-xs font-medium transition ${
                    active
                      ? 'border-indigo-400 bg-indigo-600/20 text-white ring-1 ring-indigo-500/50'
                      : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {KEY_MODE_LABELS[modeNum].name}
                </button>
              );
            })}
          </div>
        </div>

        {/* 按模式渲染专属表单 */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          {keyCfg.mode === KeyMode.None && (
            <p className="py-6 text-center text-sm text-slate-500">
              此按键当前已禁用，请在上方选择任意功能模式。
            </p>
          )}

          {keyCfg.mode === KeyMode.Single && (
            <KeyCaptureInput
              usbKey={keyCfg.key}
              allowModifierAsMainKey
              label="单键映射"
              onChange={(k) => patchKey({ key: k, func: 0 })}
            />
          )}

          {keyCfg.mode === KeyMode.Shortcut && (
            <KeyCaptureInput
              usbKey={keyCfg.key}
              func={keyCfg.func}
              allowModifiers
              label="组合快捷键（先勾选修饰键，再录制主键）"
              onChange={(k, f) => patchKey({ key: k, func: f })}
            />
          )}

          {keyCfg.mode === KeyMode.Macro && (
            <MacroBuilder
              steps={keyCfg.macro}
              screenWidth={keyboardConfig.screenWidth}
              screenHeight={keyboardConfig.screenHeight}
              onChange={(macro) => patchKey({ macro })}
            />
          )}

          {(keyCfg.mode === KeyMode.CursorMove || keyCfg.mode === KeyMode.CursorClick) && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                基于屏幕分辨率{' '}
                <strong className="text-slate-200">
                  {keyboardConfig.screenWidth} × {keyboardConfig.screenHeight}
                </strong>{' '}
                进行绝对坐标映射（可在“设备与系统”中修改屏幕分辨率）。
              </p>
              <div className="grid grid-cols-2 gap-4">
                <label className="space-y-1.5 text-xs">
                  <span className="text-slate-300">目标 X 坐标 (px)</span>
                  <input
                    type="number"
                    min={0}
                    max={keyboardConfig.screenWidth - 1}
                    value={keyCfg.x}
                    onChange={(e) => patchKey({ x: Math.max(0, Number(e.target.value)) })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="space-y-1.5 text-xs">
                  <span className="text-slate-300">目标 Y 坐标 (px)</span>
                  <input
                    type="number"
                    min={0}
                    max={keyboardConfig.screenHeight - 1}
                    value={keyCfg.y}
                    onChange={(e) => patchKey({ y: Math.max(0, Number(e.target.value)) })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </label>
              </div>
            </div>
          )}

          {keyCfg.mode === KeyMode.SwitchSlot && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => patchKey({ func: switchTarget | 0x80 })}
                  className={`rounded-xl border p-3 text-left transition ${
                    isTempSwitch
                      ? 'border-indigo-400 bg-indigo-600/20 text-white'
                      : 'border-slate-800 bg-slate-950 text-slate-400'
                  }`}
                >
                  <div className="text-xs font-semibold">临时切换 (Fn 风格)</div>
                  <div className="mt-1 text-[11px] text-slate-400">按住时生效目标配置，松开恢复</div>
                </button>
                <button
                  type="button"
                  onClick={() => patchKey({ key: 0, func: switchTarget })}
                  className={`rounded-xl border p-3 text-left transition ${
                    !isTempSwitch
                      ? 'border-indigo-400 bg-indigo-600/20 text-white'
                      : 'border-slate-800 bg-slate-950 text-slate-400'
                  }`}
                >
                  <div className="text-xs font-semibold">永久切换</div>
                  <div className="mt-1 text-[11px] text-slate-400">按下并抬起后永久切换至目标槽位</div>
                </button>
              </div>

              <div>
                <span className="mb-2 block text-xs font-medium text-slate-300">目标配置槽位</span>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                  {Array.from({ length: SLOT_COUNT }, (_, i) => {
                    const targetNum = i + 1;
                    return (
                      <button
                        key={targetNum}
                        type="button"
                        onClick={() =>
                          patchKey({ func: (isTempSwitch ? 0x80 : 0) | targetNum })
                        }
                        className={`rounded-lg border py-2 text-xs font-semibold transition ${
                          switchTarget === targetNum
                            ? 'border-indigo-400 bg-indigo-600 text-white'
                            : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        {targetNum}
                      </button>
                    );
                  })}
                </div>
              </div>

              {isTempSwitch && (
                <div className="border-t border-slate-800 pt-4">
                  <KeyCaptureInput
                    usbKey={keyCfg.key}
                    label="单点复用键（可选：若仅轻按该键未按其他键，则输出此单键）"
                    onChange={(k) => patchKey({ key: k })}
                  />
                </div>
              )}
            </div>
          )}

          {keyCfg.mode === KeyMode.Clicker && (
            <div className="space-y-4">
              <KeyCaptureInput
                usbKey={keyCfg.key}
                label="要连点的按键（支持键盘与鼠标左/右键）"
                onChange={(k) => patchKey({ key: k })}
              />
              <div className="grid gap-4 border-t border-slate-800 pt-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <span className="text-xs font-medium text-slate-300">触发方式</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => patchKey({ func: 0 })}
                      className={`rounded-lg border py-2 text-xs font-medium ${
                        keyCfg.func === 0
                          ? 'border-indigo-400 bg-indigo-600/20 text-white'
                          : 'border-slate-800 bg-slate-950 text-slate-400'
                      }`}
                    >
                      按住连点
                    </button>
                    <button
                      type="button"
                      onClick={() => patchKey({ func: 1 })}
                      className={`rounded-lg border py-2 text-xs font-medium ${
                        keyCfg.func === 1
                          ? 'border-indigo-400 bg-indigo-600/20 text-white'
                          : 'border-slate-800 bg-slate-950 text-slate-400'
                      }`}
                    >
                      按一次持续连点
                    </button>
                  </div>
                </div>
                <label className="space-y-1.5 text-xs">
                  <span className="text-slate-300">连点间隔周期 (ms，0 为长按)</span>
                  <input
                    type="number"
                    min={0}
                    max={65000}
                    value={keyCfg.delayMs}
                    onChange={(e) =>
                      patchKey({ delayMs: Math.max(0, Math.min(65000, Number(e.target.value))) })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </label>
              </div>
            </div>
          )}

          {keyCfg.mode === KeyMode.Buzzer && (
            <div className="space-y-2 text-xs text-slate-300">
              <p>按下此键后，小键盘将进入蜂鸣器音乐演奏模式（键盘 RGB 灯自动关闭，旋钮可调音量，按下摇杆或旋钮退出）。</p>
              <p className="text-amber-300/90">提示：蜂鸣器演奏模式下请勿执行上位机配置写入或校准操作。</p>
            </div>
          )}

          {keyCfg.mode === KeyMode.Morse && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { val: 2, label: '单键模式 (· / -)' },
                  { val: 0, label: '双键 · 点 (Dot)' },
                  { val: 1, label: '双键 · 划 (Dash)' },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => patchKey({ func: (morseVol << 4) | opt.val })}
                    className={`rounded-xl border py-2 text-xs font-medium transition ${
                      morseType === opt.val
                        ? 'border-indigo-400 bg-indigo-600/20 text-white'
                        : 'border-slate-800 bg-slate-950 text-slate-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="space-y-1.5 text-xs">
                  <span className="text-slate-300">发报音量 ({morseVol} / 10)</span>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={morseVol}
                    onChange={(e) =>
                      patchKey({ func: (Number(e.target.value) << 4) | morseType })
                    }
                    className="w-full accent-indigo-500"
                  />
                </label>
                <label className="space-y-1.5 text-xs">
                  <span className="text-slate-300">字符间隔 ({keyCfg.morseGap * 10} ms)</span>
                  <input
                    type="range"
                    min={1}
                    max={100}
                    value={keyCfg.morseGap}
                    onChange={(e) => patchKey({ morseGap: Number(e.target.value) })}
                    className="w-full accent-indigo-500"
                  />
                </label>
                {morseType === 2 && (
                  <label className="space-y-1.5 text-xs">
                    <span className="text-slate-300">长按阈值 ({keyCfg.morseLong * 10} ms)</span>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={keyCfg.morseLong}
                      onChange={(e) => patchKey({ morseLong: Number(e.target.value) })}
                      className="w-full accent-indigo-500"
                    />
                  </label>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // -------------------- 2. 摇杆 RK1 编辑 --------------------
  if (selection.kind === 'rocker') {
    const rk = keyboardConfig.rocker;
    const patchRocker = (patch: Partial<typeof rk>) =>
      setKeyboardConfig((prev) => ({ ...prev, rocker: { ...prev.rocker, ...patch } }));

    const permSlot = usbKeyToDigit(rk.centerKey) ?? 1;

    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2.5 border-b border-slate-800 pb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300">
            <Gamepad2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">模拟摇杆 RK1（左上角）</h2>
            <p className="text-xs text-slate-400">支持 4/8 向按键映射、速度鼠标、绝对光标位置与下压按键</p>
          </div>
        </div>

        {/* 推动功能 + 方向选项 */}
        <div className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs">
            <span className="font-medium text-slate-300">推动模式</span>
            <select
              value={rk.mode}
              onChange={(e) => patchRocker({ mode: Number(e.target.value) as RockerMode })}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              <option value={RockerMode.None}>禁用推动</option>
              <option value={RockerMode.FourWay}>4 向 4 键（十字方向）</option>
              <option value={RockerMode.EightWay}>8 向 4 键（支持斜向双键）</option>
              <option value={RockerMode.SpeedMouse}>速度鼠标（推越远越快）</option>
              <option value={RockerMode.CursorPos}>绝对光标位置（屏幕方形映射）</option>
            </select>
          </label>

          <label className="space-y-1.5 text-xs">
            <span className="font-medium text-slate-300">中心下压按键模式</span>
            <select
              value={rk.keyMode}
              onChange={(e) => patchRocker({ keyMode: Number(e.target.value) as AuxKeyMode })}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              <option value={AuxKeyMode.None}>禁用下压</option>
              <option value={AuxKeyMode.KeyOrShortcut}>按键 / 快捷键</option>
              <option value={AuxKeyMode.PermSwitch}>永久切换配置槽</option>
              <option value={AuxKeyMode.Dial}>Surface Dial 按压</option>
            </select>
          </label>

          <div className="flex flex-wrap items-center gap-4 text-xs sm:col-span-2">
            <label className="flex items-center gap-2 text-slate-300">
              <input
                type="checkbox"
                checked={rk.invertX}
                onChange={(e) => patchRocker({ invertX: e.target.checked })}
              />
              左右反向 (X)
            </label>
            <label className="flex items-center gap-2 text-slate-300">
              <input
                type="checkbox"
                checked={rk.invertY}
                onChange={(e) => patchRocker({ invertY: e.target.checked })}
              />
              上下反向 (Y)
            </label>
            <label className="flex items-center gap-2 text-slate-300">
              <input
                type="checkbox"
                checked={rk.rotateR90}
                onChange={(e) => patchRocker({ rotateR90: e.target.checked })}
              />
              摇杆坐标系右旋 90°
            </label>
          </div>
        </div>

        {/* 死区与动态参数 */}
        {rk.mode !== RockerMode.None && (
          <div className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:grid-cols-2">
            <label className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>死区阈值</span>
                <span className="font-mono text-indigo-300">{rk.deadzone} / 200</span>
              </div>
              <input
                type="range"
                min={0}
                max={200}
                value={rk.deadzone}
                onChange={(e) => patchRocker({ deadzone: Number(e.target.value) })}
                className="w-full accent-indigo-500"
              />
            </label>

            <label className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>{rk.mode === RockerMode.CursorPos ? '中心点 X 位置' : '惯性平滑度'}</span>
                <span className="font-mono text-indigo-300">{rk.inertia} / 50</span>
              </div>
              <input
                type="range"
                min={0}
                max={50}
                value={rk.inertia}
                onChange={(e) => patchRocker({ inertia: Number(e.target.value) })}
                className="w-full accent-indigo-500"
              />
            </label>

            <label className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>{rk.mode === RockerMode.CursorPos ? '中心点 Y 位置' : '近端幅度 (刚出死区)'}</span>
                <span className="font-mono text-indigo-300">{rk.nearParam} / 50</span>
              </div>
              <input
                type="range"
                min={0}
                max={50}
                value={rk.nearParam}
                onChange={(e) => patchRocker({ nearParam: Number(e.target.value) })}
                className="w-full accent-indigo-500"
              />
            </label>

            <label className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>{rk.mode === RockerMode.CursorPos ? '活动范围缩放 (k)' : '远端幅度 (推到极限)'}</span>
                <span className="font-mono text-indigo-300">{rk.farParam} / 50</span>
              </div>
              <input
                type="range"
                min={0}
                max={50}
                value={rk.farParam}
                onChange={(e) => patchRocker({ farParam: Number(e.target.value) })}
                className="w-full accent-indigo-500"
              />
            </label>
          </div>
        )}

        {/* 四方向按键绑定（4/8向模式）或 范围百分比（光标位置模式） */}
        {(rk.mode === RockerMode.FourWay || rk.mode === RockerMode.EightWay) && (
          <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:grid-cols-2">
            <KeyCaptureInput
              usbKey={rk.upKey}
              allowModifierAsMainKey
              label="向上推动 (↑)"
              onChange={(k) => patchRocker({ upKey: k })}
            />
            <KeyCaptureInput
              usbKey={rk.downKey}
              allowModifierAsMainKey
              label="向下推动 (↓)"
              onChange={(k) => patchRocker({ downKey: k })}
            />
            <KeyCaptureInput
              usbKey={rk.leftKey}
              allowModifierAsMainKey
              label="向左推动 (←)"
              onChange={(k) => patchRocker({ leftKey: k })}
            />
            <KeyCaptureInput
              usbKey={rk.rightKey}
              allowModifierAsMainKey
              label="向右推动 (→)"
              onChange={(k) => patchRocker({ rightKey: k })}
            />
          </div>
        )}

        {rk.mode === RockerMode.CursorPos && (
          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="text-xs font-medium text-slate-300">
              光标方形活动边界比例（自动编码为固件所需的数字键值）
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ['上边距', 'upKey'],
                  ['下边距', 'downKey'],
                  ['左边距', 'leftKey'],
                  ['右边距', 'rightKey'],
                ] as const
              ).map(([title, field]) => {
                const pct = cursorRangeKeyToPercent(rk[field]);
                return (
                  <label key={field} className="space-y-1 text-xs">
                    <span className="text-slate-400">
                      {title}: <strong className="text-indigo-300">{pct}%</strong>
                    </span>
                    <input
                      type="range"
                      min={5}
                      max={100}
                      step={5}
                      value={pct}
                      onChange={(e) =>
                        patchRocker({ [field]: percentToCursorRangeKey(Number(e.target.value)) })
                      }
                      className="w-full accent-indigo-500"
                    />
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* 摇杆中心按键配置 */}
        {rk.keyMode === AuxKeyMode.KeyOrShortcut && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <KeyCaptureInput
              usbKey={rk.centerKey}
              func={rk.centerFunc}
              allowModifiers
              label="摇杆下压按键 / 快捷键"
              onChange={(k, f) => patchRocker({ centerKey: k, centerFunc: f })}
            />
          </div>
        )}

        {rk.keyMode === AuxKeyMode.PermSwitch && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 space-y-2">
            <div className="text-xs font-medium text-slate-300">按下摇杆时切换到的目标配置槽</div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {Array.from({ length: SLOT_COUNT }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => patchRocker({ centerKey: digitToUsbKey(i + 1), centerFunc: 0 })}
                  className={`rounded-lg border py-2 text-xs font-semibold ${
                    permSlot === i + 1
                      ? 'border-indigo-400 bg-indigo-600 text-white'
                      : 'border-slate-800 bg-slate-950 text-slate-300'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------- 3. 旋钮 EC1 / EC2 编辑 --------------------
  if (selection.kind === 'encoder') {
    const eIdx = selection.index;
    const ec = keyboardConfig.encoders[eIdx];
    const title = eIdx === 0 ? '旋钮 1 EC1（最右侧）' : '旋钮 2 EC2（顶部靠中）';

    const patchEncoder = (patch: Partial<EncoderConfig>) => {
      setKeyboardConfig((prev) => {
        const next: [EncoderConfig, EncoderConfig] = [{ ...prev.encoders[0] }, { ...prev.encoders[1] }];
        next[eIdx] = { ...next[eIdx], ...patch };
        return { ...prev, encoders: next };
      });
    };

    const dial = decodeDialRotate(ec.ccwKey, ec.cwKey, ec.ccwFunc);
    const permSlot = usbKeyToDigit(ec.pressKey) ?? 1;

    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2.5 border-b border-slate-800 pb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
            <RotateCw className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">{title}</h2>
            <p className="text-xs text-slate-400">支持音量/滚轮/快捷键映射、Surface Dial 角度调节与下压功能</p>
          </div>
        </div>

        <div className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs">
            <span className="font-medium text-slate-300">旋转模式</span>
            <select
              value={ec.rotateMode}
              onChange={(e) =>
                patchEncoder({ rotateMode: Number(e.target.value) as EncoderRotateMode })
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              <option value={EncoderRotateMode.None}>禁用旋转</option>
              <option value={EncoderRotateMode.KeyOrShortcut}>按键 / 快捷键</option>
              <option value={EncoderRotateMode.Dial}>Surface Dial 轮盘</option>
            </select>
          </label>

          <label className="space-y-1.5 text-xs">
            <span className="font-medium text-slate-300">下压按键模式</span>
            <select
              value={ec.keyMode}
              onChange={(e) => patchEncoder({ keyMode: Number(e.target.value) as AuxKeyMode })}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              <option value={AuxKeyMode.None}>禁用下压</option>
              <option value={AuxKeyMode.KeyOrShortcut}>按键 / 快捷键</option>
              <option value={AuxKeyMode.PermSwitch}>永久切换配置槽</option>
              <option value={AuxKeyMode.Dial}>Surface Dial 按压</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs text-slate-300 sm:col-span-2">
            <input
              type="checkbox"
              checked={ec.invert}
              onChange={(e) => patchEncoder({ invert: e.target.checked })}
            />
            反转旋转方向（顺时针与逆时针互换）
          </label>
        </div>

        {ec.rotateMode === EncoderRotateMode.KeyOrShortcut && (
          <div className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:grid-cols-2">
            <KeyCaptureInput
              usbKey={ec.ccwKey}
              func={ec.ccwFunc}
              allowModifiers
              label="逆时针旋转 (↶)"
              onChange={(k, f) => patchEncoder({ ccwKey: k, ccwFunc: f })}
            />
            <KeyCaptureInput
              usbKey={ec.cwKey}
              func={ec.cwFunc}
              allowModifiers
              label="顺时针旋转 (↷)"
              onChange={(k, f) => patchEncoder({ cwKey: k, cwFunc: f })}
            />
          </div>
        )}

        {ec.rotateMode === EncoderRotateMode.Dial && (
          <div className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>单格旋转角度</span>
                <span className="font-mono text-indigo-300">{dial.angle}°</span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                value={dial.angle}
                onChange={(e) =>
                  patchEncoder(encodeDialRotate(Number(e.target.value), dial.interp))
                }
                className="w-full accent-indigo-500"
              />
            </label>
            <div className="space-y-1.5 text-xs">
              <span className="text-slate-300">平滑插值次数（推荐 2 次）</span>
              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => patchEncoder(encodeDialRotate(dial.angle, n))}
                    className={`rounded-lg border py-1.5 font-semibold ${
                      dial.interp === n
                        ? 'border-indigo-400 bg-indigo-600 text-white'
                        : 'border-slate-800 bg-slate-950 text-slate-300'
                    }`}
                  >
                    {n}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {ec.keyMode === AuxKeyMode.KeyOrShortcut && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <KeyCaptureInput
              usbKey={ec.pressKey}
              func={ec.pressFunc}
              allowModifiers
              label="旋钮下压功能"
              onChange={(k, f) => patchEncoder({ pressKey: k, pressFunc: f })}
            />
          </div>
        )}

        {ec.keyMode === AuxKeyMode.PermSwitch && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 space-y-2">
            <div className="text-xs font-medium text-slate-300">按下旋钮时切换到的目标配置槽</div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {Array.from({ length: SLOT_COUNT }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => patchEncoder({ pressKey: digitToUsbKey(i + 1), pressFunc: 0 })}
                  className={`rounded-lg border py-2 text-xs font-semibold ${
                    permSlot === i + 1
                      ? 'border-indigo-400 bg-indigo-600 text-white'
                      : 'border-slate-800 bg-slate-950 text-slate-300'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------- 4. 系统 RGB 指示灯 LED1 编辑 --------------------
  const led = keyboardConfig.systemLed;
  const patchLed = (patch: Partial<typeof led>) =>
    setKeyboardConfig((prev) => ({ ...prev, systemLed: { ...prev.systemLed, ...patch } }));
  const [simR, simG, simB] = simulateLedRgb(...led.tagColor);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2.5 border-b border-slate-800 pb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
          <Lightbulb className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">系统 RGB 指示灯 LED1</h2>
          <p className="text-xs text-slate-400">切换配置时显示标签色，其余时间 R/G/B 可独立复用为状态指示灯</p>
        </div>
      </div>

      {/* 标签色与亮起/渐灭时间 */}
      <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-200">配置标签颜色</span>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span>原始</span>
            <span
              className="h-5 w-5 rounded border border-white/20"
              style={{ backgroundColor: `rgb(${led.tagColor.join(',')})` }}
            />
            <span>LED 仿真</span>
            <span
              className="h-5 w-5 rounded border border-white/20"
              style={{ backgroundColor: `rgb(${simR},${simG},${simB})` }}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {(['R 红', 'G 绿', 'B 蓝'] as const).map((lbl, cIdx) => (
            <label key={lbl} className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>{lbl}</span>
                <span className="font-mono text-white">{led.tagColor[cIdx]}</span>
              </div>
              <input
                type="range"
                min={0}
                max={255}
                value={led.tagColor[cIdx]}
                onChange={(e) => {
                  const next: [number, number, number] = [...led.tagColor];
                  next[cIdx] = Number(e.target.value);
                  patchLed({ tagColor: next });
                }}
                className="w-full accent-indigo-500"
              />
            </label>
          ))}
        </div>

        <div className="grid gap-4 border-t border-slate-800 pt-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs">
            <span className="text-slate-300">切换标签亮起时长</span>
            <select
              value={led.tagOnTime}
              onChange={(e) => patchLed({ tagOnTime: Number(e.target.value) })}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            >
              {TAG_ON_OPTIONS.map((t, i) => (
                <option key={t} value={i}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-slate-300">标签渐灭速度</span>
            <select
              value={led.tagFadeSpeed}
              onChange={(e) => patchLed({ tagFadeSpeed: Number(e.target.value) })}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            >
              {TAG_FADE_OPTIONS.map((t, i) => (
                <option key={t} value={i}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* R/G/B 独立复用通道 */}
      <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="text-xs font-semibold text-slate-200">R / G / B 通道状态指示复用</div>
        {(
          [
            ['红灯通道 (R)', 'channelR', 0, 'text-rose-400'],
            ['绿灯通道 (G)', 'channelG', 1, 'text-emerald-400'],
            ['蓝灯通道 (B)', 'channelB', 2, 'text-sky-400'],
          ] as const
        ).map(([name, field, bIdx, colorCls]) => (
          <div
            key={field}
            className="grid items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs sm:grid-cols-12"
          >
            <span className={`font-semibold sm:col-span-3 ${colorCls}`}>{name}</span>
            <select
              value={led[field].source}
              onChange={(e) =>
                patchLed({
                  [field]: { ...led[field], source: Number(e.target.value) as IndicatorSource },
                })
              }
              className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-white sm:col-span-4"
            >
              {INDICATOR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 sm:col-span-3">
              <span className="text-slate-400">亮度</span>
              <input
                type="number"
                min={0}
                max={255}
                value={led.indicatorBrightness[bIdx]}
                onChange={(e) => {
                  const next: [number, number, number] = [...led.indicatorBrightness];
                  next[bIdx] = Math.max(0, Math.min(255, Number(e.target.value)));
                  patchLed({ indicatorBrightness: next });
                }}
                className="w-16 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-white"
              />
            </label>
            <label className="flex items-center gap-1.5 text-slate-300 sm:col-span-2">
              <input
                type="checkbox"
                checked={led[field].invert}
                onChange={(e) =>
                  patchLed({ [field]: { ...led[field], invert: e.target.checked } })
                }
              />
              反向
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
