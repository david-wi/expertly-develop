use crate::metrics::{collect_system_metrics, get_system_info, is_system_overloaded};
use crate::state::{AppState, ConnectionStatus, QueuedTask};
use crate::tools::execute_tool;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::net::TcpStream;
use tokio::sync::mpsc;
use tokio::time::{interval, Duration};
use tokio_tungstenite::{
    connect_async, tungstenite::protocol::Message, MaybeTlsStream, WebSocketStream,
};

const VERSION: &str = "0.1.0";
const STATUS_INTERVAL_MS: u64 = 5000;
const RECONNECT_DELAY_MS: u64 = 5000;
const PING_INTERVAL_MS: u64 = 30000;

/// Messages sent to the WebSocket server
#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum OutgoingMessage {
    AgentRegister {
        #[serde(rename = "workingDir")]
        working_dir: String,
        platform: String,
        version: String,
        #[serde(rename = "systemInfo")]
        system_info: crate::metrics::SystemInfo,
    },
    ToolResponse {
        #[serde(rename = "requestId")]
        request_id: String,
        #[serde(rename = "sessionId")]
        session_id: String,
        result: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        error: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        metrics: Option<crate::state::ProcessMetrics>,
        #[serde(skip_serializing_if = "Option::is_none")]
        queued: Option<bool>,
        #[serde(rename = "queuePosition", skip_serializing_if = "Option::is_none")]
        queue_position: Option<usize>,
    },
    ToolQueued {
        #[serde(rename = "requestId")]
        request_id: String,
        #[serde(rename = "sessionId")]
        session_id: String,
        #[serde(rename = "queuePosition")]
        queue_position: usize,
        reason: String,
    },
    AgentStatusUpdate {
        metrics: crate::state::SystemMetrics,
    },
}

/// Messages received from the WebSocket server
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum IncomingMessage {
    AgentRegistered {
        #[serde(rename = "agentId")]
        agent_id: String,
    },
    ToolRequest {
        #[serde(rename = "requestId")]
        request_id: String,
        #[serde(rename = "sessionId")]
        session_id: String,
        tool: String,
        input: serde_json::Value,
        cwd: Option<String>,
    },
    GetStatus,
}

/// Channel message for sending data to the WebSocket
#[derive(Debug)]
pub enum WsCommand {
    Send(String),
    Close,
}

/// Start the WebSocket connection manager
pub async fn start_connection(app_handle: AppHandle, state: Arc<AppState>) {
    loop {
        let settings = state.settings.read().clone();
        let server_url = settings.server_url.clone();
        let working_dir = settings.working_directory.clone();
        let max_concurrent = settings.max_concurrent_commands;

        state.set_status(ConnectionStatus::Connecting);
        state.log_info(format!("Connecting to {}...", server_url));
        emit_status_update(&app_handle, &state);

        match connect_async(&server_url).await {
            Ok((ws_stream, _)) => {
                state.set_status(ConnectionStatus::Connected);
                *state.is_connected.write() = true;
                state.log_success("Connected to server");
                emit_status_update(&app_handle, &state);

                // Run the connection handler
                handle_connection(
                    ws_stream,
                    app_handle.clone(),
                    state.clone(),
                    working_dir,
                    max_concurrent,
                )
                .await;

                // Connection closed
                *state.is_connected.write() = false;
                state.set_status(ConnectionStatus::Disconnected);
                state.log_warning("Disconnected from server");
                emit_status_update(&app_handle, &state);
            }
            Err(e) => {
                state.set_status(ConnectionStatus::Disconnected);
                state.log_error(format!("Connection failed: {}", e));
                emit_status_update(&app_handle, &state);
            }
        }

        // Check if we should reconnect
        if !state.settings.read().auto_connect_on_launch {
            break;
        }

        state.log_info(format!(
            "Reconnecting in {} seconds...",
            RECONNECT_DELAY_MS / 1000
        ));
        tokio::time::sleep(Duration::from_millis(RECONNECT_DELAY_MS)).await;
    }
}

async fn handle_connection(
    ws_stream: WebSocketStream<MaybeTlsStream<TcpStream>>,
    app_handle: AppHandle,
    state: Arc<AppState>,
    working_dir: String,
    max_concurrent: u32,
) {
    let (mut write, mut read) = ws_stream.split();

    // Create channel for sending messages to the WebSocket
    let (tx, mut rx) = mpsc::channel::<WsCommand>(100);

    // Send registration message
    let system_info = get_system_info();
    let register_msg = OutgoingMessage::AgentRegister {
        working_dir: working_dir.clone(),
        platform: std::env::consts::OS.to_string(),
        version: VERSION.to_string(),
        system_info,
    };

    if let Ok(msg) = serde_json::to_string(&register_msg) {
        let _ = write.send(Message::Text(msg.into())).await;
    }

    // Clone state for tasks
    let state_for_status = state.clone();
    let tx_for_status = tx.clone();

    // Status update task
    let status_task = tokio::spawn(async move {
        let mut status_interval = interval(Duration::from_millis(STATUS_INTERVAL_MS));
        loop {
            status_interval.tick().await;
            let metrics = collect_system_metrics(&state_for_status);
            state_for_status.update_metrics(metrics.clone());

            let msg = OutgoingMessage::AgentStatusUpdate { metrics };
            if let Ok(json) = serde_json::to_string(&msg) {
                if tx_for_status.send(WsCommand::Send(json)).await.is_err() {
                    break;
                }
            }
        }
    });

    // Ping task
    let tx_for_ping = tx.clone();
    let ping_task = tokio::spawn(async move {
        let mut ping_interval = interval(Duration::from_millis(PING_INTERVAL_MS));
        loop {
            ping_interval.tick().await;
            // Just send empty command to keep alive - the write loop handles pings
            if tx_for_ping.send(WsCommand::Send("".to_string())).await.is_err() {
                break;
            }
        }
    });

    // Write task - sends messages from channel to WebSocket
    let write_task = tokio::spawn(async move {
        while let Some(cmd) = rx.recv().await {
            match cmd {
                WsCommand::Send(msg) => {
                    if msg.is_empty() {
                        // Ping
                        if write.send(Message::Ping(vec![])).await.is_err() {
                            break;
                        }
                    } else if write.send(Message::Text(msg.into())).await.is_err() {
                        break;
                    }
                }
                WsCommand::Close => {
                    let _ = write.close().await;
                    break;
                }
            }
        }
    });

    // Read task - processes incoming messages
    let tx_for_read = tx.clone();
    let state_for_read = state.clone();
    let app_for_read = app_handle.clone();

    while let Some(msg_result) = read.next().await {
        match msg_result {
            Ok(Message::Text(text)) => {
                if let Ok(msg) = serde_json::from_str::<IncomingMessage>(&text) {
                    handle_message(
                        msg,
                        tx_for_read.clone(),
                        state_for_read.clone(),
                        app_for_read.clone(),
                        &working_dir,
                        max_concurrent,
                    )
                    .await;
                }
            }
            Ok(Message::Close(_)) => {
                break;
            }
            Err(_) => {
                break;
            }
            _ => {}
        }
    }

    // Cleanup
    let _ = tx.send(WsCommand::Close).await;
    status_task.abort();
    ping_task.abort();
    write_task.abort();
}

async fn handle_message(
    msg: IncomingMessage,
    tx: mpsc::Sender<WsCommand>,
    state: Arc<AppState>,
    app_handle: AppHandle,
    working_dir: &str,
    max_concurrent: u32,
) {
    match msg {
        IncomingMessage::AgentRegistered { agent_id } => {
            *state.agent_id.write() = Some(agent_id.clone());
            state.log_success(format!("Registered as agent: {}", agent_id));

            let info = get_system_info();
            state.log_info(format!(
                "System: {} CPUs, {}MB RAM",
                info.cpus, info.total_memory_mb
            ));
            emit_status_update(&app_handle, &state);
        }
        IncomingMessage::ToolRequest {
            request_id,
            session_id,
            tool,
            input,
            cwd,
        } => {
            let metrics = collect_system_metrics(&state);
            let active = state.get_active_commands();
            let should_queue =
                active >= max_concurrent || (tool == "run_command" && is_system_overloaded(&metrics));

            if should_queue && tool == "run_command" {
                // Queue the task
                let task = QueuedTask {
                    request_id: request_id.clone(),
                    session_id: session_id.clone(),
                    tool: tool.clone(),
                    input,
                    cwd: cwd.unwrap_or_else(|| working_dir.to_string()),
                    queued_at: chrono::Utc::now(),
                };

                let position = state.enqueue_task(task);
                state.log_warning(format!(
                    "Queued: {} [position {}] (CPU: {}%, Mem: {}%)",
                    tool, position, metrics.cpu_percent, metrics.memory_percent
                ));

                // Notify server
                let reason = if active >= max_concurrent {
                    format!("Max concurrent commands ({}) reached", max_concurrent)
                } else {
                    format!(
                        "System load high (CPU: {}%, Mem: {}%)",
                        metrics.cpu_percent, metrics.memory_percent
                    )
                };

                let queued_msg = OutgoingMessage::ToolQueued {
                    request_id,
                    session_id,
                    queue_position: position,
                    reason,
                };

                if let Ok(json) = serde_json::to_string(&queued_msg) {
                    let _ = tx.send(WsCommand::Send(json)).await;
                }
            } else {
                // Execute immediately
                execute_task(
                    request_id,
                    session_id,
                    tool,
                    input,
                    cwd.unwrap_or_else(|| working_dir.to_string()),
                    tx.clone(),
                    state.clone(),
                    app_handle.clone(),
                    false,
                )
                .await;
            }

            emit_status_update(&app_handle, &state);
        }
        IncomingMessage::GetStatus => {
            let metrics = collect_system_metrics(&state);
            let msg = OutgoingMessage::AgentStatusUpdate { metrics };
            if let Ok(json) = serde_json::to_string(&msg) {
                let _ = tx.send(WsCommand::Send(json)).await;
            }
        }
    }
}

async fn execute_task(
    request_id: String,
    session_id: String,
    tool: String,
    input: serde_json::Value,
    cwd: String,
    tx: mpsc::Sender<WsCommand>,
    state: Arc<AppState>,
    app_handle: AppHandle,
    was_queued: bool,
) {
    state.increment_active_commands();
    state.set_status(ConnectionStatus::Working);
    state.log_info(format!(
        "Executing: {} [{} active, {} queued]",
        tool,
        state.get_active_commands(),
        state.get_queue_length()
    ));
    emit_status_update(&app_handle, &state);

    // Execute the tool
    let result = execute_tool(&tool, &input, &cwd).await;

    // Send response
    let response = OutgoingMessage::ToolResponse {
        request_id: request_id.clone(),
        session_id: session_id.clone(),
        result: result.result,
        error: result.error.clone(),
        metrics: result.metrics,
        queued: if was_queued { Some(true) } else { None },
        queue_position: if was_queued { Some(0) } else { None },
    };

    if let Ok(json) = serde_json::to_string(&response) {
        let _ = tx.send(WsCommand::Send(json)).await;
    }

    state.decrement_active_commands();

    if result.error.is_some() {
        state.log_error(format!(
            "Failed: {} [{} active, {} queued]",
            tool,
            state.get_active_commands(),
            state.get_queue_length()
        ));
    } else {
        state.log_success(format!(
            "Completed: {} [{} active, {} queued]",
            tool,
            state.get_active_commands(),
            state.get_queue_length()
        ));
    }

    // Update status
    if state.get_active_commands() == 0 && *state.is_connected.read() {
        state.set_status(ConnectionStatus::Connected);
    }

    emit_status_update(&app_handle, &state);

    // Process queue
    process_queue(tx, state, app_handle);
}

fn process_queue(
    tx: mpsc::Sender<WsCommand>,
    state: Arc<AppState>,
    app_handle: AppHandle,
) {
    let settings = state.settings.read().clone();
    let max_concurrent = settings.max_concurrent_commands;

    let metrics = collect_system_metrics(&state);
    let active = state.get_active_commands();

    if active >= max_concurrent || is_system_overloaded(&metrics) {
        return;
    }

    if let Some(task) = state.dequeue_task() {
        let wait_time = chrono::Utc::now()
            .signed_duration_since(task.queued_at)
            .num_milliseconds();

        state.log_info(format!("Dequeued: {} (waited {}ms)", task.tool, wait_time));

        // Spawn task execution in background
        tauri::async_runtime::spawn(async move {
            execute_task(
                task.request_id,
                task.session_id,
                task.tool,
                task.input,
                task.cwd,
                tx,
                state,
                app_handle,
                true,
            )
            .await;
        });
    }
}

/// Emit status update to frontend
fn emit_status_update(app_handle: &AppHandle, state: &Arc<AppState>) {
    let status = state.get_status();
    let metrics = state.get_metrics();
    let logs: Vec<_> = state.logs.read().iter().cloned().collect();
    let agent_id = state.agent_id.read().clone();

    let _ = app_handle.emit(
        "status-update",
        json!({
            "status": status,
            "metrics": metrics,
            "logs": logs,
            "agentId": agent_id,
        }),
    );
}

/// Disconnect from the server
pub fn disconnect(state: &Arc<AppState>) {
    *state.is_connected.write() = false;
    state.set_status(ConnectionStatus::Disconnected);
}
