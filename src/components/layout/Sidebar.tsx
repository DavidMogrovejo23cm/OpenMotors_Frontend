import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Wrench, Package, Users, Car, LogOut, ChevronRight, UserCheck, ClipboardList, CreditCard, Truck, DollarSign, ChevronLeft, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useAuth, type RoleName } from '../../contexts/AuthContext';
import { initials, cn } from '../../lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: RoleName[];
  badge?: string;
}

const PRINCIPAL_NAV: NavItem[] = [
  { to: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard                          },
  { to: '/registros',   label: 'Registros',   icon: Wrench,        roles: ['ADMIN','MECANICO'] },
  { to: '/diagnostico', label: 'Diagnóstico', icon: ClipboardList, roles: ['ADMIN','MECANICO'] },
  { to: '/motos',       label: 'Vehículos',   icon: Car                                      },
  { to: '/clientes',    label: 'Clientes',    icon: UserCheck,     roles: ['ADMIN','MECANICO'] },
  { to: '/inventario',  label: 'Inventario',  icon: Package,       roles: ['ADMIN','MECANICO'] },
  { to: '/proveedores', label: 'Proveedores', icon: Truck,         roles: ['ADMIN','MECANICO'] },
];

const SECONDARY_NAV: NavItem[] = [
  { to: '/contabilidad', label: 'Contabilidad', icon: DollarSign,  roles: ['ADMIN','MECANICO'] },
  { to: '/pagos',        label: 'Pagos',        icon: CreditCard,  roles: ['ADMIN']            },
  { to: '/perfiles',     label: 'Perfiles',     icon: Users,       roles: ['ADMIN']            },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ collapsed = false, onToggleCollapse }: SidebarProps) {
  const { user, logout, hasRole, isAdmin, isMecanico } = useAuth();
  const navigate = useNavigate();
  const [showSecondary, setShowSecondary] = useState(true);

  const filterByRole = (items: NavItem[]) => items.filter((item) => !item.roles || hasRole(...item.roles));

  const mainItems = filterByRole(PRINCIPAL_NAV);
  const secondaryItems = filterByRole(SECONDARY_NAV);

  const roleLabel = isAdmin ? 'Administrador'
    : isMecanico ? 'Mecánico'
    : hasRole('CLIENTE') ? 'Cliente'
    : 'Usuario';

  const roleBadgeBg = isAdmin ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/40'
    : isMecanico ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/40'
    : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col flex-shrink-0 transition-all duration-300 z-40",
        "bg-white dark:bg-[#0E131F] border-r border-slate-200 dark:border-slate-800/80 shadow-sm",
        collapsed ? "w-20" : "w-64"
      )}
      style={{ minHeight: 'calc(100vh - 62px)' }}
    >
      {/* ── Subheader / Toggle ── */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#d62828] animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              Navegación
            </span>
          </div>
        )}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-slate-800/60 transition-colors mx-auto"
            title={collapsed ? "Expandir menú lateral" : "Colapsar menú lateral"}
          >
            <ChevronLeft size={16} className={cn("transition-transform duration-200", collapsed && "rotate-180")} />
          </button>
        )}
      </div>

      {/* ── Lista de enlaces ── */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto no-scrollbar space-y-4">
        {/* Sección Principal */}
        <div>
          {!collapsed && (
            <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Servicios & Gestión
            </p>
          )}
          <ul className="space-y-1">
            {mainItems.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  title={collapsed ? label : undefined}
                  className={({ isActive }) => cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150 relative group',
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25 dark:shadow-none'
                      : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50/70 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/50'
                  )}
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        size={18}
                        className={cn(
                          "transition-colors shrink-0",
                          isActive ? "text-white" : "text-slate-500 group-hover:text-blue-600 dark:text-slate-400 dark:group-hover:text-blue-400"
                        )}
                      />
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate">{label}</span>
                          {isActive && <ChevronRight size={14} className="text-white/80" />}
                        </>
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        {/* Sección Más Módulos */}
        {secondaryItems.length > 0 && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60">
            {!collapsed ? (
              <button
                onClick={() => setShowSecondary(!showSecondary)}
                className="w-full px-3 py-1 mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 hover:text-slate-600"
              >
                <span>Módulos de Taller</span>
                <ChevronDown size={12} className={cn("transition-transform duration-200", !showSecondary && "-rotate-90")} />
              </button>
            ) : null}

            {(showSecondary || collapsed) && (
              <ul className="space-y-1">
                {secondaryItems.map(({ to, label, icon: Icon }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      title={collapsed ? label : undefined}
                      className={({ isActive }) => cn(
                        'flex items-center gap-3 px-3 py-2 rounded-xl text-[12.5px] font-medium transition-all duration-150 relative group',
                        isActive
                          ? 'bg-red-600 text-white shadow-sm shadow-red-500/20'
                          : 'text-slate-600 hover:text-red-600 hover:bg-red-50/60 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/40'
                      )}
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            size={16}
                            className={cn(
                              "transition-colors shrink-0",
                              isActive ? "text-white" : "text-slate-400 group-hover:text-red-600 dark:text-slate-400 dark:group-hover:text-red-400"
                            )}
                          />
                          {!collapsed && <span className="flex-1 truncate">{label}</span>}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </nav>

      {/* ── Footer Usuario + Salir ── */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800/60 space-y-2 bg-slate-50/50 dark:bg-slate-900/40">
        {!collapsed ? (
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white dark:bg-[#131927] border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs shrink-0 border border-blue-200 dark:border-blue-700/40">
              {initials(user?.nombre_completo ?? 'U')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold text-slate-800 dark:text-white truncate">
                {user?.nombre_completo ?? 'Usuario'}
              </p>
              <span className={cn("inline-block text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded border tracking-wider", roleBadgeBg)}>
                {roleLabel}
              </span>
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 mx-auto rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs border border-blue-200 dark:border-blue-700/40" title={user?.nombre_completo}>
            {initials(user?.nombre_completo ?? 'U')}
          </div>
        )}

        <button
          onClick={handleLogout}
          title={collapsed ? "Cerrar sesión" : undefined}
          className={cn(
            "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-slate-500 hover:text-red-600 hover:bg-red-50 dark:text-slate-400 dark:hover:text-red-400 dark:hover:bg-red-950/30",
            collapsed && "justify-center px-0"
          )}
        >
          <LogOut size={16} />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );
}
