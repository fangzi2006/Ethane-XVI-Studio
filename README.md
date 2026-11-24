# Ethane-XVI Studio

基于 **Tauri v2 + Rust (`hidapi`) + React 19 + TypeScript + Tailwind CSS** 打造的 **Ethane-XVI** 机械小键盘现代化桌面配置工具。

以“用户直觉优先、底层协议 100% 兼容”为原则完全重构，彻底告别传统上位机的繁琐参数表，同时保留 CH549 固件的全部高阶自定义能力。

---

## 核心特性

- **原生 Rust USB HID 通信**：基于 `hidapi` 直连 CH549 Custom HID（`VID 0x1A86 / PID 0x5884 / UsagePage 0xFF00`），启动自动静默识别连接，无需额外驱动；采用 `hid_transact_batch` 批量直通收发，整机 8 层配置毫秒级读取。
- **四大工作台**：
  - **键位工作台**：1:1 还原 4×4 键帽 + 摇杆 + 双旋钮 + 系统指示灯画布；支持跟随桌面摆放方向（0°/90°/180°/270°）真实旋转、拖拽互换键位、可视化虚拟键盘选键器 + 实体按键录制、积木式宏编排（含真实间隔录制、收藏库与 255B 容量指示）、16:9 屏幕坐标拾取器、蜂鸣器音阶表与摩斯码速查。
  - **灯效工作室**：支持点击键帽或系统指示灯直接切换编辑；内置前端实时灯效动态预览、自定义扩散顺序 4×4 编辑器、多选批量上色与渐变生成器。
  - **场景与层管理**：8 层配置总览、自定义层名称、3 套精选高频场景模板（日常办公与网页 / 标准数字小键盘 / 剪辑与设计通用），以及 `.ethane.json` 整机 8 层全量备份导出与恢复。
  - **硬件与工具**：19 路输入实时测试仪（`K1~K16` + 摇杆中键 + 双旋钮按键）、摇杆自动捕获极值校准向导、15 键双八度蜂鸣器试音台、以及带中文错误码解析的固件诊断面板。
- **高可靠写入与防冲突**：
  - 写入后自动回读对应层数据并逐字节校验；
  - 精确基于二进制字节快照判断未保存状态（改回原样自动消除黄点）；
  - 三层并发写保护（UI 同步锁 + 协议写锁 + 固件 `RBSY` 忙重传），彻底杜绝多层连续写入时的 Flash 冲突；
  - 完整兼容原版 `.etcfg` (512B) / `.etlight` (256B) / `.etkey` (257B) / 配色 `.txt` 文件，导出调用 Windows 原生「另存为」系统对话框。
- **离线模拟模式**：内置虚拟 CH549 固件状态机，无硬件也可完整体验全部功能。

---

## 固件配套说明

- **推荐配套固件**：[fangzi2006/Ethane-XVI-CH549](https://github.com/fangzi2006/Ethane-XVI-CH549)（支持 `BCSI`/`BRKC`/`BRLC` 整机配置回读、`RBSY` 写入忙保护）。
- **旧版原厂固件兼容**：自动识别不支持回读的旧版固件并弹出提示，自动降级为本地缓存恢复，写入功能仍正常可用。

---

## 本地开发与构建

### 环境要求

- [Node.js](https://nodejs.org/) >= 20
- [Rust](https://www.rust-lang.org/)（stable，`x86_64-pc-windows-msvc`）
- Windows 下需安装 Visual Studio 2022 C++ Build Tools（MSVC + Windows SDK）与 Edge WebView2

### 常用命令

```bash
# 安装前端依赖
npm install

# 运行协议编解码与通信单元测试 (Vitest)
npm run test

# 启动桌面端热重载开发调试
npm run tauri dev

# 构建免安装绿色单文件 (.exe)
npm run tauri build -- --no-bundle

# 构建完整 Windows NSIS 安装包
npm run tauri build
```

构建产物位于：
- 绿色单文件：`src-tauri/target/release/ethane-xvi-studio.exe`
- Windows 安装包：`src-tauri/target/release/bundle/nsis/Ethane-XVI Studio_<version>_x64-setup.exe`

---

## 架构与文档

```text
Ethane-XVI-Studio/
├── src/
│   ├── services/
│   │   ├── transport.ts        # ITransport 抽象、TauriHidTransport、MockTransport
│   │   ├── protocol.ts         # 512B/256B/257B 二进制编解码、批量收发与回读校验
│   │   ├── keycodes.ts         # USB HID 键值、Dial 与坐标辅助编码
│   │   └── protocol.test.ts    # Vitest 协议与通信回归测试
│   ├── store/useDeviceStore.tsx # 8 层状态、字节快照脏检测与读写互斥锁
│   ├── components/             # 四大工作台与可视化交互组件
│   ├── data/presets.ts         # 场景模板、蜂鸣器与摩斯码数据
│   └── utils/saveFile.ts       # Tauri 原生「另存为」文件保存封装
├── src-tauri/
│   ├── src/lib.rs              # Rust hidapi 后端（单线程直通/批量收发与热拔出检测）
│   └── tauri.conf.json         # Tauri v2 窗口与 NSIS 打包配置
└── docs/DEVELOPMENT.md         # 详细协议规范与开发维护文档
```

更多协议字节定义、架构约束与维护指南，请参阅 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)。

---

## License

本项目采用 [MIT License](LICENSE) 开源。
