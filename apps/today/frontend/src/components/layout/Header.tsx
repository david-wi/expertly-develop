import { useAppStore } from '../../stores/appStore';

export function Header() {
  const { toggleSidebar, logout } = useAppStore();

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-30">
      {/* Left side */}
      <div className="flex items-center">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
        <div className="ml-4">
          <h1 className="text-lg font-semibold text-gray-900">Expertly Today</h1>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center space-x-4">
        {/* Status indicator */}
        <div className="flex items-center text-sm text-gray-500">
          <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
          Claude is ready
        </div>

        {/* Clear cache button */}
        <button
          onClick={() => {
            localStorage.clear();
            sessionStorage.clear();
            window.location.reload();
          }}
          className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
          title="Clear cache and reload"
        >
          <RefreshIcon className="h-5 w-5" />
        </button>

        {/* User menu */}
        <button
          onClick={logout}
          className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
          title="Logout"
        >
          <LogoutIcon className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}
