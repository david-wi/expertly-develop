use crate::state::{AppState, SystemMetrics};
use std::sync::Arc;
use sysinfo::System;

/// Thresholds for system load
pub const MAX_CPU_PERCENT: f64 = 80.0;
pub const MAX_MEMORY_PERCENT: f64 = 85.0;

/// Collect current system metrics
pub fn collect_system_metrics(state: &Arc<AppState>) -> SystemMetrics {
    let mut sys = System::new_all();
    sys.refresh_all();

    let cpu_percent = sys.global_cpu_usage() as f64;
    let memory_total = sys.total_memory();
    let memory_used = sys.used_memory();
    let memory_percent = if memory_total > 0 {
        (memory_used as f64 / memory_total as f64) * 100.0
    } else {
        0.0
    };

    let active_commands = state.get_active_commands();
    let queued_tasks = state.get_queue_length() as u32;

    SystemMetrics {
        cpu_percent: (cpu_percent * 10.0).round() / 10.0,
        memory_used_mb: memory_used / 1024 / 1024,
        memory_total_mb: memory_total / 1024 / 1024,
        memory_percent: (memory_percent * 10.0).round() / 10.0,
        active_commands,
        queued_tasks,
    }
}

/// Check if system is under high load
pub fn is_system_overloaded(metrics: &SystemMetrics) -> bool {
    metrics.cpu_percent > MAX_CPU_PERCENT || metrics.memory_percent > MAX_MEMORY_PERCENT
}

/// Get basic system info for registration
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub cpus: usize,
    pub total_memory_mb: u64,
    pub hostname: String,
    pub platform: String,
}

pub fn get_system_info() -> SystemInfo {
    let sys = System::new_all();

    SystemInfo {
        cpus: sys.cpus().len(),
        total_memory_mb: sys.total_memory() / 1024 / 1024,
        hostname: System::host_name().unwrap_or_else(|| "unknown".to_string()),
        platform: std::env::consts::OS.to_string(),
    }
}
