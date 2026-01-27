use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::Arc;

/// Connection status for the agent
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ConnectionStatus {
    Connected,
    Disconnected,
    Connecting,
    Working,
    Paused,
}

impl Default for ConnectionStatus {
    fn default() -> Self {
        Self::Disconnected
    }
}

/// Agent settings stored persistently
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSettings {
    pub server_url: String,
    pub working_directory: String,
    pub max_concurrent_commands: u32,
    pub auto_start_on_login: bool,
    pub auto_connect_on_launch: bool,
}

impl Default for AgentSettings {
    fn default() -> Self {
        Self {
            server_url: "wss://vibecode.ai.devintensive.com".to_string(),
            working_directory: dirs::home_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|| ".".to_string()),
            max_concurrent_commands: 5,
            auto_start_on_login: true,  // Default to auto-start so agent is always available
            auto_connect_on_launch: true,
        }
    }
}

/// System metrics for monitoring
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemMetrics {
    pub cpu_percent: f64,
    pub memory_used_mb: u64,
    pub memory_total_mb: u64,
    pub memory_percent: f64,
    pub active_commands: u32,
    pub queued_tasks: u32,
}

/// A log entry for the activity log
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogEntry {
    pub timestamp: String,
    pub level: LogLevel,
    pub message: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Info,
    Success,
    Warning,
    Error,
}

/// Process metrics for command execution
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessMetrics {
    pub cpu_percent: f64,
    pub memory_mb: f64,
    pub duration_ms: u64,
}

/// Queued task awaiting execution
#[derive(Debug, Clone)]
pub struct QueuedTask {
    pub request_id: String,
    pub session_id: String,
    pub tool: String,
    pub input: serde_json::Value,
    pub cwd: String,
    pub queued_at: chrono::DateTime<chrono::Utc>,
}

/// Application state shared across the app
#[derive(Debug)]
pub struct AppState {
    pub status: RwLock<ConnectionStatus>,
    pub settings: RwLock<AgentSettings>,
    pub metrics: RwLock<SystemMetrics>,
    pub logs: RwLock<VecDeque<LogEntry>>,
    pub active_commands: RwLock<u32>,
    pub task_queue: RwLock<VecDeque<QueuedTask>>,
    pub agent_id: RwLock<Option<String>>,
    pub is_connected: RwLock<bool>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            status: RwLock::new(ConnectionStatus::Disconnected),
            settings: RwLock::new(AgentSettings::default()),
            metrics: RwLock::new(SystemMetrics::default()),
            logs: RwLock::new(VecDeque::with_capacity(1000)),
            active_commands: RwLock::new(0),
            task_queue: RwLock::new(VecDeque::new()),
            agent_id: RwLock::new(None),
            is_connected: RwLock::new(false),
        }
    }
}

impl AppState {
    pub fn new() -> Arc<Self> {
        Arc::new(Self::default())
    }

    pub fn add_log(&self, level: LogLevel, message: impl Into<String>) {
        let entry = LogEntry {
            timestamp: chrono::Utc::now().format("%H:%M:%S").to_string(),
            level,
            message: message.into(),
        };

        let mut logs = self.logs.write();
        logs.push_back(entry);

        // Keep only the last 500 entries
        while logs.len() > 500 {
            logs.pop_front();
        }
    }

    pub fn log_info(&self, message: impl Into<String>) {
        self.add_log(LogLevel::Info, message);
    }

    pub fn log_success(&self, message: impl Into<String>) {
        self.add_log(LogLevel::Success, message);
    }

    pub fn log_warning(&self, message: impl Into<String>) {
        self.add_log(LogLevel::Warning, message);
    }

    pub fn log_error(&self, message: impl Into<String>) {
        self.add_log(LogLevel::Error, message);
    }

    pub fn set_status(&self, status: ConnectionStatus) {
        *self.status.write() = status;
    }

    pub fn get_status(&self) -> ConnectionStatus {
        *self.status.read()
    }

    pub fn update_metrics(&self, metrics: SystemMetrics) {
        *self.metrics.write() = metrics;
    }

    pub fn get_metrics(&self) -> SystemMetrics {
        self.metrics.read().clone()
    }

    pub fn increment_active_commands(&self) {
        let mut count = self.active_commands.write();
        *count += 1;
    }

    pub fn decrement_active_commands(&self) {
        let mut count = self.active_commands.write();
        if *count > 0 {
            *count -= 1;
        }
    }

    pub fn get_active_commands(&self) -> u32 {
        *self.active_commands.read()
    }

    pub fn enqueue_task(&self, task: QueuedTask) -> usize {
        let mut queue = self.task_queue.write();
        queue.push_back(task);
        queue.len()
    }

    pub fn dequeue_task(&self) -> Option<QueuedTask> {
        self.task_queue.write().pop_front()
    }

    pub fn get_queue_length(&self) -> usize {
        self.task_queue.read().len()
    }
}
