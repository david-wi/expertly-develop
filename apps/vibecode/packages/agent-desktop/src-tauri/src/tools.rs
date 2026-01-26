use crate::state::ProcessMetrics;
use glob::glob;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Instant;
use tokio::process::Command;
use tokio::time::{timeout, Duration};

const COMMAND_TIMEOUT_SECS: u64 = 120;

/// Result of a tool execution
#[derive(Debug)]
pub struct ToolResult {
    pub result: String,
    pub metrics: Option<ProcessMetrics>,
    pub error: Option<String>,
}

/// Execute a tool by name with the given input
pub async fn execute_tool(
    name: &str,
    input: &serde_json::Value,
    cwd: &str,
) -> ToolResult {
    // Ensure cwd exists
    let cwd_path = Path::new(cwd);
    if !cwd_path.exists() {
        return ToolResult {
            result: format!("Error: Working directory not found: {}", cwd),
            metrics: None,
            error: Some("Working directory not found".to_string()),
        };
    }

    match name {
        "read_file" => execute_read_file(input, cwd).await,
        "write_file" => execute_write_file(input, cwd).await,
        "list_files" => execute_list_files(input, cwd).await,
        "run_command" => execute_run_command(input, cwd).await,
        "search_files" => execute_search_files(input, cwd).await,
        _ => ToolResult {
            result: format!("Unknown tool: {}", name),
            metrics: None,
            error: Some(format!("Unknown tool: {}", name)),
        },
    }
}

async fn execute_read_file(input: &serde_json::Value, cwd: &str) -> ToolResult {
    let path = match input.get("path").and_then(|p| p.as_str()) {
        Some(p) => p,
        None => {
            return ToolResult {
                result: "Error: Missing 'path' parameter".to_string(),
                metrics: None,
                error: Some("Missing 'path' parameter".to_string()),
            }
        }
    };

    let full_path = resolve_path(cwd, path);

    if !full_path.exists() {
        return ToolResult {
            result: format!("Error: File not found: {}", full_path.display()),
            metrics: None,
            error: Some("File not found".to_string()),
        };
    }

    match tokio::fs::read_to_string(&full_path).await {
        Ok(content) => ToolResult {
            result: content,
            metrics: None,
            error: None,
        },
        Err(e) => ToolResult {
            result: format!("Error reading file: {}", e),
            metrics: None,
            error: Some(e.to_string()),
        },
    }
}

async fn execute_write_file(input: &serde_json::Value, cwd: &str) -> ToolResult {
    let path = match input.get("path").and_then(|p| p.as_str()) {
        Some(p) => p,
        None => {
            return ToolResult {
                result: "Error: Missing 'path' parameter".to_string(),
                metrics: None,
                error: Some("Missing 'path' parameter".to_string()),
            }
        }
    };

    let content = match input.get("content").and_then(|c| c.as_str()) {
        Some(c) => c,
        None => {
            return ToolResult {
                result: "Error: Missing 'content' parameter".to_string(),
                metrics: None,
                error: Some("Missing 'content' parameter".to_string()),
            }
        }
    };

    let full_path = resolve_path(cwd, path);

    // Create parent directories if needed
    if let Some(parent) = full_path.parent() {
        if !parent.exists() {
            if let Err(e) = tokio::fs::create_dir_all(parent).await {
                return ToolResult {
                    result: format!("Error creating directories: {}", e),
                    metrics: None,
                    error: Some(e.to_string()),
                };
            }
        }
    }

    match tokio::fs::write(&full_path, content).await {
        Ok(_) => ToolResult {
            result: format!("Successfully wrote to {}", full_path.display()),
            metrics: None,
            error: None,
        },
        Err(e) => ToolResult {
            result: format!("Error writing file: {}", e),
            metrics: None,
            error: Some(e.to_string()),
        },
    }
}

async fn execute_list_files(input: &serde_json::Value, cwd: &str) -> ToolResult {
    let path = input
        .get("path")
        .and_then(|p| p.as_str())
        .unwrap_or(".");

    let pattern = input
        .get("pattern")
        .and_then(|p| p.as_str())
        .unwrap_or("*");

    let full_path = resolve_path(cwd, path);

    if !full_path.exists() {
        return ToolResult {
            result: format!("Error: Directory not found: {}", full_path.display()),
            metrics: None,
            error: Some("Directory not found".to_string()),
        };
    }

    let glob_pattern = full_path.join(pattern);
    let glob_str = glob_pattern.to_string_lossy();

    match glob(&glob_str) {
        Ok(entries) => {
            let files: Vec<String> = entries
                .filter_map(|e| e.ok())
                .map(|p| p.to_string_lossy().to_string())
                .collect();

            if files.is_empty() {
                ToolResult {
                    result: "(no files found)".to_string(),
                    metrics: None,
                    error: None,
                }
            } else {
                ToolResult {
                    result: files.join("\n"),
                    metrics: None,
                    error: None,
                }
            }
        }
        Err(e) => ToolResult {
            result: format!("Error listing files: {}", e),
            metrics: None,
            error: Some(e.to_string()),
        },
    }
}

async fn execute_run_command(input: &serde_json::Value, cwd: &str) -> ToolResult {
    let command = match input.get("command").and_then(|c| c.as_str()) {
        Some(c) => c,
        None => {
            return ToolResult {
                result: "Error: Missing 'command' parameter".to_string(),
                metrics: None,
                error: Some("Missing 'command' parameter".to_string()),
            }
        }
    };

    let start_time = Instant::now();

    #[cfg(target_os = "windows")]
    let (shell, shell_args) = ("cmd.exe", vec!["/c", command]);

    #[cfg(not(target_os = "windows"))]
    let (shell, shell_args) = ("/bin/bash", vec!["-c", command]);

    let child = Command::new(shell)
        .args(&shell_args)
        .current_dir(cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn();

    let child = match child {
        Ok(c) => c,
        Err(e) => {
            return ToolResult {
                result: format!("Error spawning command: {}", e),
                metrics: None,
                error: Some(e.to_string()),
            }
        }
    };

    // Wait for command with timeout
    let result = timeout(
        Duration::from_secs(COMMAND_TIMEOUT_SECS),
        child.wait_with_output(),
    )
    .await;

    let duration_ms = start_time.elapsed().as_millis() as u64;

    match result {
        Ok(Ok(output)) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);

            let result_text = if !stdout.is_empty() {
                stdout.to_string()
            } else if !stderr.is_empty() {
                stderr.to_string()
            } else {
                "(command completed with no output)".to_string()
            };

            ToolResult {
                result: result_text,
                metrics: Some(ProcessMetrics {
                    cpu_percent: 0.0, // Note: per-process CPU tracking is complex in Rust
                    memory_mb: 0.0,
                    duration_ms,
                }),
                error: if output.status.success() {
                    None
                } else {
                    Some(format!("Exit code: {}", output.status.code().unwrap_or(-1)))
                },
            }
        }
        Ok(Err(e)) => ToolResult {
            result: format!("Error executing command: {}", e),
            metrics: Some(ProcessMetrics {
                cpu_percent: 0.0,
                memory_mb: 0.0,
                duration_ms,
            }),
            error: Some(e.to_string()),
        },
        Err(_) => {
            // Timeout - process is dropped which should kill it
            ToolResult {
                result: format!(
                    "Command timed out after {} seconds",
                    COMMAND_TIMEOUT_SECS
                ),
                metrics: Some(ProcessMetrics {
                    cpu_percent: 0.0,
                    memory_mb: 0.0,
                    duration_ms,
                }),
                error: Some("Command timed out".to_string()),
            }
        }
    }
}

async fn execute_search_files(input: &serde_json::Value, cwd: &str) -> ToolResult {
    let path = input
        .get("path")
        .and_then(|p| p.as_str())
        .unwrap_or(".");

    let pattern = match input.get("pattern").and_then(|p| p.as_str()) {
        Some(p) => p,
        None => {
            return ToolResult {
                result: "Error: Missing 'pattern' parameter".to_string(),
                metrics: None,
                error: Some("Missing 'pattern' parameter".to_string()),
            }
        }
    };

    let full_path = resolve_path(cwd, path);

    #[cfg(target_os = "windows")]
    let cmd = format!(
        "findstr /s /i /m \"{}\" \"{}\\*\"",
        pattern,
        full_path.display()
    );

    #[cfg(not(target_os = "windows"))]
    let cmd = format!(
        "grep -r \"{}\" \"{}\" --include=\"*\" -l 2>/dev/null || true",
        pattern,
        full_path.display()
    );

    // Reuse run_command
    let input = serde_json::json!({ "command": cmd });
    let result = execute_run_command(&input, cwd).await;

    if result.result.trim().is_empty() {
        ToolResult {
            result: "No matches found".to_string(),
            metrics: result.metrics,
            error: None,
        }
    } else {
        result
    }
}

/// Resolve a path relative to the working directory
fn resolve_path(cwd: &str, path: &str) -> PathBuf {
    let path = Path::new(path);
    if path.is_absolute() {
        path.to_path_buf()
    } else {
        Path::new(cwd).join(path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_path_relative() {
        let result = resolve_path("/home/user", "file.txt");
        assert_eq!(result, PathBuf::from("/home/user/file.txt"));
    }

    #[test]
    fn test_resolve_path_absolute() {
        let result = resolve_path("/home/user", "/etc/config");
        assert_eq!(result, PathBuf::from("/etc/config"));
    }
}
