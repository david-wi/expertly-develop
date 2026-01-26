"""Server metrics API endpoints."""

import os
from datetime import datetime
from pathlib import Path

# Configure psutil to use host's /proc if mounted (for Docker containers)
HOST_PROC = "/host/proc"
if Path(HOST_PROC).exists():
    os.environ["PROCFS_PATH"] = HOST_PROC

import psutil
from fastapi import APIRouter

router = APIRouter()

# Disk path to monitor - can be overridden via env var
DISK_PATH = os.environ.get("METRICS_DISK_PATH", "/")


@router.get("")
async def get_server_metrics():
    """Get current server metrics (CPU, memory, disk)."""
    # CPU
    cpu_percent = psutil.cpu_percent(interval=0.1)
    cpu_count = psutil.cpu_count()

    # Memory
    memory = psutil.virtual_memory()

    # Disk - try host path first, fall back to container root
    try:
        disk = psutil.disk_usage(DISK_PATH)
    except Exception:
        disk = psutil.disk_usage("/")

    # Uptime
    boot_time = datetime.fromtimestamp(psutil.boot_time())
    uptime_seconds = (datetime.now() - boot_time).total_seconds()

    # Network (bytes sent/received since boot)
    net = psutil.net_io_counters()

    return {
        "timestamp": datetime.now().isoformat(),
        "cpu": {
            "percent": cpu_percent,
            "cores": cpu_count,
        },
        "memory": {
            "total_gb": round(memory.total / (1024**3), 2),
            "used_gb": round(memory.used / (1024**3), 2),
            "available_gb": round(memory.available / (1024**3), 2),
            "percent": memory.percent,
        },
        "disk": {
            "total_gb": round(disk.total / (1024**3), 2),
            "used_gb": round(disk.used / (1024**3), 2),
            "free_gb": round(disk.free / (1024**3), 2),
            "percent": disk.percent,
        },
        "uptime": {
            "boot_time": boot_time.isoformat(),
            "seconds": int(uptime_seconds),
            "days": int(uptime_seconds // 86400),
            "hours": int((uptime_seconds % 86400) // 3600),
        },
        "network": {
            "bytes_sent": net.bytes_sent,
            "bytes_recv": net.bytes_recv,
            "bytes_sent_gb": round(net.bytes_sent / (1024**3), 2),
            "bytes_recv_gb": round(net.bytes_recv / (1024**3), 2),
        },
    }
