# Ethane-XVI Studio Maintainer & Agent Guide

本文档沉淀了 **Ethane-XVI Studio** 的核心架构约束、协议不变量与已确认的 UX 规范，确保后续迭代与维护不会产生回退。

## 1. 项目定位与技术栈
- **纯桌面端应用**：Tauri v2 + Rust (`hidapi 2`) + React 19 + TypeScript (strict) + Tailwind CSS v4。
- **不再维护浏览器 WebHID**：仅保留 `TauriHidTransport`（实机）与 `MockTransport`（离线演示与 Vitest 单元测试）。
- **版本与发布**：遵循 SemVer（当前基线 `v0.1.0`），发布新版本需同步更新 `package.json`、`package-lock.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`、`src-tauri/tauri.conf.json`、`CHANGELOG.md`，并推送 `v*` 标签触发 `.github/workflows/ci-release.yml`。

## 2. 协议与固件对齐（不可破坏）
- 二进制格式必须与 `Ethane-XVI-CH549` 固件 100% 兼容：
  - 键盘配置 `512B`（`.etcfg`，按键变长区 ≤ `468B`）
  - 灯效配置 `256B`（`.etlight`）
  - 宏序列 `257B`（`.etkey`）
- **高性能 HID 收发**（`src-tauri/src/lib.rs`）：
  - 必须保持单所有权直通线程（空闲阻塞在 `mpsc::Receiver::recv()`，禁止改回 `read_timeout` 轮询循环，否则会触发 Windows 15.6ms 时钟粒度导致读取慢 10 倍）。
  - `BRKC`（16 包）与 `BRLC`（8 包）优先走 `hid_transact_batch` 批量收发。
- **写入可靠性与防冲突**：
  - 保持三层并发保护：Store 同步互斥锁 `ioLockRef` + 协议层 `writingLock` + 固件 `RBSY` 自动重传；读写期间暂停 `livePolling`（`BIPT`）。
  - 写入后必须回读对应层数据逐字节校验（`verifyKeyboardConfig` / `verifyLightConfig`），校验通过后才清除脏标记；旧版不支持回读的固件（返回 `RINV`）需优雅降级提示。

## 3. 已定型的 UI / UX 规范（请勿回退）
- **精确脏标记**：基于当前 512B+256B 编码字节与上次读写快照比对；改回原样必须自动消除黄点。
- **切层保护**：切换配置层（`L1~L8`）仅切换内存草稿，绝不自动读取设备覆盖未保存修改。
- **连接与读取**：启动时静默探测并自动连接 Ethane-XVI，连接后自动读取整机 8 层配置与全局参数；顶部并列保留「读取 Lx」与「读取全部」，有未保存修改时使用按钮正下方锚定的紧凑小弹窗确认（不使用 `window.confirm`）。
- **键位编辑**：`K1~K16`、`RK1`、`EC1/EC2` 均采用本地草稿 +「确认 / 取消」机制，切换选中或切层时丢弃未确认草稿。
- **画布与灯效**：
  - 键帽右上角不显示颜色小圆点；无“LED 低亮度仿真”开关（键帽背景用柔和浅色光晕，中心色块保持真实 RGB）。
  - 画布上的 `LED1` 仅显示已启用状态指示灯三通道混合亮度；配置层标签色仅在右侧 `LED1` 编辑面板预览。
  - 灯效页无顶部“16键/LED1”切换栏，直接点击画布键帽或 `LED1` 切换；16 键灯效面板固定顺序：① 动态动画方式（含切换配置层灯效策略）→ ② 按键颜色编辑 → ③ 高级灯效细节（折叠）。
- **导入导出**：导入统一用向下箭头（`Download`）、导出统一用向上箭头（`Upload`），导出统一通过 `src/utils/saveFile.ts` 调用 Tauri 原生 Windows「另存为」对话框。

## 4. 校验命令（每次改动后必跑）
```powershell
npm run test
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```
