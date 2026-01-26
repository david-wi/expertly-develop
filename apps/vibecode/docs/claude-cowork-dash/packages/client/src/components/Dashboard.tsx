import { useCallback } from 'react';
import GridLayout, { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useDashboardStore } from '../store/dashboard-store';
import Widget from './Widget';
import type { useWebSocket } from '../hooks/useWebSocket';
import EmptyState from './EmptyState';

interface DashboardProps {
  ws: ReturnType<typeof useWebSocket>;
}

export default function Dashboard({ ws }: DashboardProps) {
  const { widgets, layout, updateLayout, sessions } = useDashboardStore();

  const handleLayoutChange = useCallback((newLayout: Layout[]) => {
    updateLayout(newLayout);
  }, [updateLayout]);

  if (widgets.length === 0) {
    return <EmptyState ws={ws} />;
  }

  // Calculate grid dimensions based on window size
  const cols = 12;
  const rowHeight = 60;
  const containerPadding: [number, number] = [16, 16];
  const margin: [number, number] = [16, 16];

  return (
    <div className="h-full overflow-auto p-4">
      <GridLayout
        className="layout"
        layout={layout}
        cols={cols}
        rowHeight={rowHeight}
        width={window.innerWidth - 32}
        containerPadding={containerPadding}
        margin={margin}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".widget-drag-handle"
        resizeHandles={['se']}
      >
        {widgets.map((widget) => {
          const session = widget.sessionId ? sessions[widget.sessionId] : null;
          return (
            <div key={widget.id}>
              <Widget
                widget={widget}
                session={session}
                ws={ws}
              />
            </div>
          );
        })}
      </GridLayout>
    </div>
  );
}
