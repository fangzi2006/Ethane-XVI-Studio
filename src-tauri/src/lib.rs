use hidapi::HidApi;
use serde::Serialize;
use std::sync::{
    mpsc::{self, Sender},
    Mutex,
};
use std::thread;
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HidDeviceInfoDto {
    pub vendor_id: u16,
    pub product_id: u16,
    pub product_name: String,
    pub serial_number: String,
}

enum WorkerCommand {
    Transact {
        data: Vec<u8>,
        timeout_ms: i32,
        reply: mpsc::Sender<Result<Vec<u8>, String>>,
    },
    TransactBatch {
        packets: Vec<Vec<u8>>,
        timeout_ms: i32,
        reply: mpsc::Sender<Result<Vec<Vec<u8>>, String>>,
    },
    Disconnect,
}

struct HidSession {
    tx: Sender<WorkerCommand>,
}

struct HidState {
    session: Mutex<Option<HidSession>>,
}

impl Default for HidState {
    fn default() -> Self {
        Self {
            session: Mutex::new(None),
        }
    }
}

fn close_existing_session(state: &HidState) {
    if let Ok(mut guard) = state.session.lock() {
        if let Some(sess) = guard.take() {
            let _ = sess.tx.send(WorkerCommand::Disconnect);
        }
    }
}

#[tauri::command]
fn hid_probe(vid: u16, pid: u16, usage_page: u16) -> Result<Option<HidDeviceInfoDto>, String> {
    let api = HidApi::new().map_err(|e| format!("初始化 HID 驱动失败: {e}"))?;
    let mut matches: Vec<_> = api
        .device_list()
        .filter(|d| d.vendor_id() == vid && d.product_id() == pid && d.usage_page() == usage_page)
        .collect();
    matches.sort_by_key(|d| d.interface_number());

    Ok(matches.first().map(|info| HidDeviceInfoDto {
        vendor_id: info.vendor_id(),
        product_id: info.product_id(),
        product_name: info
            .product_string()
            .filter(|s| !s.is_empty())
            .unwrap_or("Ethane-XVI")
            .to_string(),
        serial_number: info.serial_number().unwrap_or("").to_string(),
    }))
}

#[tauri::command]
fn hid_connect(
    app: AppHandle,
    state: State<'_, HidState>,
    vid: u16,
    pid: u16,
    usage_page: u16,
) -> Result<HidDeviceInfoDto, String> {
    close_existing_session(&state);

    let api = HidApi::new().map_err(|e| format!("初始化 HID 驱动失败: {e}"))?;
    let mut matches: Vec<_> = api
        .device_list()
        .filter(|d| d.vendor_id() == vid && d.product_id() == pid && d.usage_page() == usage_page)
        .collect();
    matches.sort_by_key(|d| d.interface_number());

    let target = matches
        .first()
        .ok_or_else(|| "未检测到 Ethane-XVI 键盘，请确认 USB 已连接".to_string())?;

    let dto = HidDeviceInfoDto {
        vendor_id: target.vendor_id(),
        product_id: target.product_id(),
        product_name: target
            .product_string()
            .filter(|s| !s.is_empty())
            .unwrap_or("Ethane-XVI")
            .to_string(),
        serial_number: target.serial_number().unwrap_or("").to_string(),
    };

    let device = api
        .open_path(target.path())
        .map_err(|e| format!("打开 HID 设备失败（可能被其他上位机占用）: {e}"))?;

    let (tx, rx) = mpsc::channel::<WorkerCommand>();

    // 单所有权直通同步收发线程：空闲时零 CPU 阻塞等待指令，收到指令后 0ms 延迟立即写包并阻塞等回包
    thread::spawn(move || {
        let mut read_buf = [0u8; 65];
        while let Ok(cmd) = rx.recv() {
            match cmd {
                WorkerCommand::Transact {
                    data,
                    timeout_ms,
                    reply,
                } => {
                    // Windows hidapi 写入必须带 1 字节 Report ID 前缀 (0x00) + 64 字节载荷
                    let mut packet = [0u8; 65];
                    let copy_len = data.len().min(64);
                    packet[1..1 + copy_len].copy_from_slice(&data[..copy_len]);

                    if let Err(e) = device.write(&packet) {
                        let _ = app.emit("hid-disconnected", ());
                        let _ = reply.send(Err(format!("HID 发送失败（设备可能已断开）: {e}")));
                        break;
                    }

                    match device.read_timeout(&mut read_buf, timeout_ms) {
                        Ok(n) if n > 0 => {
                            let payload: Vec<u8> = if n >= 65 && read_buf[0] == 0x00 {
                                read_buf[1..65].to_vec()
                            } else if n >= 64 {
                                read_buf[0..64].to_vec()
                            } else {
                                let mut padded = vec![0u8; 64];
                                padded[..n].copy_from_slice(&read_buf[..n]);
                                padded
                            };
                            let _ = reply.send(Ok(payload));
                        }
                        Ok(_) => {
                            let _ = reply.send(Err(format!("设备响应超时（{timeout_ms}ms）")));
                        }
                        Err(e) => {
                            let _ = app.emit("hid-disconnected", ());
                            let _ = reply.send(Err(format!("HID 读取失败（设备可能已断开）: {e}")));
                            break;
                        }
                    }
                }
                WorkerCommand::TransactBatch {
                    packets,
                    timeout_ms,
                    reply,
                } => {
                    let mut responses = Vec::with_capacity(packets.len());
                    let mut failed: Option<String> = None;
                    let mut disconnected = false;

                    for data in packets {
                        let mut packet = [0u8; 65];
                        let copy_len = data.len().min(64);
                        packet[1..1 + copy_len].copy_from_slice(&data[..copy_len]);

                        if let Err(e) = device.write(&packet) {
                            disconnected = true;
                            failed = Some(format!("HID 发送失败（设备可能已断开）: {e}"));
                            break;
                        }

                        match device.read_timeout(&mut read_buf, timeout_ms) {
                            Ok(n) if n > 0 => {
                                let payload: Vec<u8> = if n >= 65 && read_buf[0] == 0x00 {
                                    read_buf[1..65].to_vec()
                                } else if n >= 64 {
                                    read_buf[0..64].to_vec()
                                } else {
                                    let mut padded = vec![0u8; 64];
                                    padded[..n].copy_from_slice(&read_buf[..n]);
                                    padded
                                };
                                responses.push(payload);
                            }
                            Ok(_) => {
                                failed = Some(format!("设备响应超时（{timeout_ms}ms）"));
                                break;
                            }
                            Err(e) => {
                                disconnected = true;
                                failed = Some(format!("HID 读取失败（设备可能已断开）: {e}"));
                                break;
                            }
                        }
                    }

                    if disconnected {
                        let _ = app.emit("hid-disconnected", ());
                    }
                    if let Some(err) = failed {
                        let _ = reply.send(Err(err));
                        if disconnected {
                            break;
                        }
                    } else {
                        let _ = reply.send(Ok(responses));
                    }
                }
                WorkerCommand::Disconnect => break,
            }
        }
    });

    if let Ok(mut guard) = state.session.lock() {
        *guard = Some(HidSession { tx });
    }

    Ok(dto)
}

#[tauri::command]
fn hid_disconnect(state: State<'_, HidState>) -> Result<(), String> {
    close_existing_session(&state);
    Ok(())
}

#[tauri::command]
async fn hid_transact(
    state: State<'_, HidState>,
    data: Vec<u8>,
    timeout_ms: Option<i32>,
) -> Result<Vec<u8>, String> {
    let tx = {
        let guard = state.session.lock().map_err(|_| "HID 状态锁异常".to_string())?;
        guard
            .as_ref()
            .map(|s| s.tx.clone())
            .ok_or_else(|| "设备未连接".to_string())?
    };

    let timeout = timeout_ms.unwrap_or(600);
    tauri::async_runtime::spawn_blocking(move || {
        let (reply_tx, reply_rx) = mpsc::channel();
        tx.send(WorkerCommand::Transact {
            data,
            timeout_ms: timeout,
            reply: reply_tx,
        })
        .map_err(|_| "HID 通信线程已退出，请重新连接设备".to_string())?;

        reply_rx
            .recv()
            .map_err(|_| "等待 HID 响应失败".to_string())?
    })
    .await
    .map_err(|e| format!("HID 事务任务异常: {e}"))?
}

#[tauri::command]
async fn hid_transact_batch(
    state: State<'_, HidState>,
    packets: Vec<Vec<u8>>,
    timeout_ms: Option<i32>,
) -> Result<Vec<Vec<u8>>, String> {
    let tx = {
        let guard = state.session.lock().map_err(|_| "HID 状态锁异常".to_string())?;
        guard
            .as_ref()
            .map(|s| s.tx.clone())
            .ok_or_else(|| "设备未连接".to_string())?
    };

    let timeout = timeout_ms.unwrap_or(600);
    tauri::async_runtime::spawn_blocking(move || {
        let (reply_tx, reply_rx) = mpsc::channel();
        tx.send(WorkerCommand::TransactBatch {
            packets,
            timeout_ms: timeout,
            reply: reply_tx,
        })
        .map_err(|_| "HID 通信线程已退出，请重新连接设备".to_string())?;

        reply_rx
            .recv()
            .map_err(|_| "等待 HID 批量响应失败".to_string())?
    })
    .await
    .map_err(|e| format!("HID 批量事务任务异常: {e}"))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(HidState::default())
        .invoke_handler(tauri::generate_handler![
            hid_probe,
            hid_connect,
            hid_disconnect,
            hid_transact,
            hid_transact_batch,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Ethane-XVI Studio");
}
