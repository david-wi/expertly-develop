interface ConnectionStatusProps {
  connected: boolean;
}

export default function ConnectionStatus({ connected }: ConnectionStatusProps) {
  if (connected) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-red-900/90 text-red-200 text-sm flex items-center gap-2 shadow-lg backdrop-blur-sm">
      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
      <span>Disconnected - Reconnecting...</span>
    </div>
  );
}
