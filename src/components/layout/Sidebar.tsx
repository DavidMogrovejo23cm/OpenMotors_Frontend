import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Wrench, Package, Users, Car, LogOut, UserCheck, ClipboardList, CreditCard, Truck, DollarSign, ChevronLeft, ChevronDown, Clock } from 'lucide-react';
import { useState } from 'react';
import { useAuth, type RoleName } from '../../contexts/AuthContext';
import { initials, cn, canAccessModulo } from '../../lib/utils';

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
  { to: '/carros',      label: 'Vehículos',   icon: Car,           roles: ['ADMIN','MECANICO'] },
  { to: '/clientes',    label: 'Clientes',    icon: UserCheck,     roles: ['ADMIN','MECANICO'] },
  { to: '/diagnostico', label: 'Diagnóstico', icon: ClipboardList, roles: ['ADMIN','MECANICO'] },
  { to: '/inventario',  label: 'Inventario',  icon: Package,       roles: ['ADMIN','MECANICO'] },
  { to: '/proveedores', label: 'Proveedores', icon: Truck,         roles: ['ADMIN','MECANICO'] },
];

const SECONDARY_NAV: NavItem[] = [
  { to: '/herramientas', label: 'Herramientas', icon: Wrench,      roles: ['ADMIN','MECANICO'] },
  { to: '/personal',     label: 'Personal',     icon: Clock,       roles: ['ADMIN','MECANICO'] },
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

  const filterByRole = (items: NavItem[]) => items.filter((item) => (!item.roles || hasRole(...item.roles)) && (!['/proveedores', '/contabilidad'].includes(item.to) || canAccessModulo(user?.permisos, item.to.slice(1), isAdmin, isMecanico)));

  const mainItems = filterByRole(PRINCIPAL_NAV);
  const secondaryItems = filterByRole(SECONDARY_NAV);

  const roleLabel = isAdmin ? 'Administrador'
    : isMecanico ? 'Mecánico'
    : hasRole('CLIENTE') ? 'Cliente'
    : 'Usuario';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside
      className={cn(
        "gallery-sidebar hidden md:flex flex-col flex-shrink-0 flex-grow-0 h-full overflow-hidden transition-all duration-200 z-30 select-none",
        "bg-white dark:bg-[#0c0f17] border-r border-slate-200/80 dark:border-slate-800/80",
        collapsed ? "w-14 min-w-[3.5rem] max-w-[3.5rem]" : "w-52 min-w-[13rem] max-w-[13rem]"
      )}
    >
      {/* ── Subheader / Toggle ── */}
      <div className={cn(
        "flex items-center border-b border-slate-100 dark:border-slate-800/60 flex-none h-[45px]",
        collapsed ? "justify-center px-1" : "justify-between px-3"
      )}>
        {!collapsed && (
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
            Menú
          </span>
        )}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800/60 transition-colors"
            title={collapsed ? "Expandir menú" : "Colapsar menú"}
          >
            <ChevronLeft size={15} className={cn("transition-transform duration-200", collapsed && "rotate-180")} />
          </button>
        )}
      </div>

      {/* ── Lista de enlaces ── */}
      <nav className="flex-1 px-2 py-2 overflow-y-auto no-scrollbar space-y-3 min-h-0">
        {/* Sección Principal */}
        <div>
          {!collapsed && (
            <p className="px-2 mb-1 text-[9.5px] font-semibold uppercase tracking-wider text-slate-400/90 dark:text-slate-500">
              Gestión
            </p>
          )}
          <ul className="space-y-0.5">
            {mainItems.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  title={collapsed ? label : undefined}
                  className={({ isActive }) => cn(
                    'flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12.5px] font-medium transition-colors relative group',
                    collapsed && 'justify-center px-0 py-2',
                    isActive
                      ? 'bg-red-50 text-[#D62828] font-semibold dark:bg-red-950/30 dark:text-red-400'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/50'
                  )}
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        size={16}
                        className={cn(
                          "transition-colors shrink-0",
                          isActive ? "text-[#D62828] dark:text-red-400" : "text-slate-400 group-hover:text-slate-700 dark:text-slate-500 dark:group-hover:text-slate-300"
                        )}
                      />
                      {!collapsed && (
                        <span className="flex-1 truncate">{label}</span>
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
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/50">
            {!collapsed ? (
              <button
                type="button"
                onClick={() => setShowSecondary(!showSecondary)}
                className="w-full px-2 py-1 mb-0.5 flex items-center justify-between text-[9.5px] font-semibold uppercase tracking-wider text-slate-400/90 dark:text-slate-500 hover:text-slate-600 transition-colors"
              >
                <span>Otros módulos</span>
                <ChevronDown size={11} className={cn("transition-transform duration-200", !showSecondary && "-rotate-90")} />
              </button>
            ) : null}

            {(showSecondary || collapsed) && (
              <ul className="space-y-0.5">
                {secondaryItems.map(({ to, label, icon: Icon }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      title={collapsed ? label : undefined}
                      className={({ isActive }) => cn(
                        'flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12.5px] font-medium transition-colors relative group',
                        collapsed && 'justify-center px-0 py-2',
                        isActive
                          ? 'bg-red-50 text-[#D62828] font-semibold dark:bg-red-950/30 dark:text-red-400'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/50'
                      )}
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            size={15}
                            className={cn(
                              "transition-colors shrink-0",
                              isActive ? "text-[#D62828] dark:text-red-400" : "text-slate-400 group-hover:text-slate-700 dark:text-slate-500 dark:group-hover:text-slate-300"
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

      {/* ── Footer Usuario + Salir (Sleek & Compact) ── */}
      <div className="p-2 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-900/30 flex-none">
        {!collapsed ? (
          <div className="flex items-center justify-between gap-2 px-1.5 py-1 rounded-lg">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-[11px] shrink-0">
                {initials(user?.nombre_completo ?? 'U')}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11.5px] font-semibold text-slate-800 dark:text-slate-200 truncate leading-tight">
                  {user?.nombre_completo ?? 'Usuario'}
                </p>
                <p className="text-[9.5px] text-slate-400 dark:text-slate-500 truncate leading-tight">
                  {roleLabel}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/30 transition-colors shrink-0"
            >
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="w-8 h-8 mx-auto flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/30 transition-colors"
          >
            <LogOut size={15} />
          </button>
        )}
      </div>
    </aside>
  );
}
