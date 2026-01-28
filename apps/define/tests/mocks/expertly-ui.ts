// Mock for expertly_ui module federation remote
import React from 'react';

export const Sidebar = ({ children, ...props }: any) => {
  return React.createElement('nav', { 'data-testid': 'sidebar', ...props }, children);
};

export const MainContent = ({ children, ...props }: any) => {
  return React.createElement('main', { 'data-testid': 'main-content', ...props }, children);
};

export const formatBuildTimestamp = (timestamp: string | undefined) => {
  if (!timestamp) return null;
  return timestamp;
};

export const useCurrentUser = (fetchFn: () => Promise<any>) => {
  return {
    sidebarUser: null,
    loading: false,
    error: null,
  };
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  return React.createElement(React.Fragment, null, children);
};

export default {
  Sidebar,
  MainContent,
  formatBuildTimestamp,
  useCurrentUser,
  ThemeProvider,
};
