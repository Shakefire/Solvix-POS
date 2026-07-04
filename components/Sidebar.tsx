interface MenuItem {
  id: string;
  label: string;
  icon: string;
}

interface SidebarProps {
  menuItems: MenuItem[];
  activeMenu: string;
  setActiveMenu: (menu: string) => void;
  storeName?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ menuItems, activeMenu, setActiveMenu, storeName = 'Solvix POS', collapsed = false, onToggleCollapse, mobileOpen = false, onClose }: SidebarProps) {
  return (
    <div className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-slate-900 text-white shadow-lg transition-all duration-300 md:static md:translate-x-0 ${collapsed ? 'w-16' : 'w-full md:w-52'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
      {/* Logo */}
      <div className={`border-b border-slate-700 ${collapsed ? 'px-2 py-3' : 'px-4 py-3'}`}>
        <div className={`flex items-center gap-2 ${collapsed ? 'justify-center' : ''}`}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm">
            🛒
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold">{storeName}</h1>
            </div>
          )}
        </div>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveMenu(item.id)}
            title={collapsed ? item.label : undefined}
            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${
              activeMenu === item.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-slate-800'
            } ${collapsed ? 'justify-center px-0' : ''}`}
          >
            <span className="text-base shrink-0">{item.icon}</span>
            {!collapsed && <span className="truncate font-medium">{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Collapse Toggle */}
      {onToggleCollapse && (
        <div className={`border-t border-slate-700 ${collapsed ? 'px-2 py-2' : 'px-3 py-2'}`}>
          <button
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-gray-300 transition hover:bg-slate-800 ${collapsed ? 'justify-center px-0' : ''}`}
          >
            <span className="text-base shrink-0">{collapsed ? '»' : '«'}</span>
            {!collapsed && <span className="font-medium">Collapse</span>}
          </button>
        </div>
      )}

      {/* Footer */}
      {!collapsed && (
        <div className="border-t border-slate-700 px-4 py-3">
          <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-wider">Admin</p>
          <p className="mt-0.5 text-[10px] text-gray-500">09122029904</p>
        </div>
      )}

      {/* Mobile close */}
      {mobileOpen && onClose && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 rounded-full bg-slate-800/80 p-1.5 text-white md:hidden"
          aria-label="Close sidebar"
        >
          ✕
        </button>
      )}
    </div>
  );
}
