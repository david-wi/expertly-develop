import { useRef, useEffect } from "react";
import type { LogEntry } from "../App";

interface LogViewerProps {
  logs: LogEntry[];
}

const levelColors: Record<LogEntry["level"], string> = {
  info: "text-gray-600",
  success: "text-green-600",
  warning: "text-yellow-600",
  error: "text-red-600",
};

const levelIcons: Record<LogEntry["level"], string> = {
  info: "○",
  success: "✓",
  warning: "!",
  error: "✗",
};

export default function LogViewer({ logs }: LogViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldScrollRef = useRef(true);

  useEffect(() => {
    if (containerRef.current && shouldScrollRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      // Auto-scroll if within 50px of bottom
      shouldScrollRef.current = scrollHeight - scrollTop - clientHeight < 50;
    }
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="h-full overflow-y-auto p-2 bg-gray-50 font-mono text-xs"
    >
      {logs.length === 0 ? (
        <div className="text-gray-400 text-center py-4">No activity yet</div>
      ) : (
        <div className="space-y-1">
          {logs.map((log, idx) => (
            <div key={idx} className="flex gap-2 hover:bg-gray-100 px-1 rounded">
              <span className="text-gray-400 select-none">{log.timestamp}</span>
              <span className={`${levelColors[log.level]} select-none`}>
                {levelIcons[log.level]}
              </span>
              <span className={levelColors[log.level]}>{log.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
