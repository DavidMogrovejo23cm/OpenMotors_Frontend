import { useCallback, useEffect, useState } from 'react';
import { herramientasApi, type Herramienta } from '../../lib/tallerApi';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { getErrorMsg } from '../../lib/utils';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { Plus, Search } from 'lucide-react';

const estados: Record<string, string> = {
  DISPONIBLE: 'Disponible',
  MANTENIMIENTO: 'En mantenimiento',
  FUERA_SERVICIO: 'Fuera de servicio',
};

export default function HerramientasPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<Herramienta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('');
  const [edit, setEdit] = useState<Herramienta | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems((await herramientasApi.list()).data);
    } catch (e) {
      setError(getErrorMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredItems = items.filter(
    (h) =>
      (!estado || h.estado === estado) &&
      [h.codigo, h.nombre, h.marca, h.numero_serie]
        .join(' ')
        .toLowerCase()
        .includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Herramientas</h1>
          <p className="text-sm opacity-60 mt-0.5">Registro y estado de las herramientas del taller.</p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => {
              setEdit(null);
              setOpen(true);
            }}
            className="flex items-center gap-1.5"
          >
            <Plus size={16} />
            <span>Registrar herramienta</span>
          </Button>
        )}
      </div>

      {/* Barra de filtros centrada y alineada */}
      <div className="flex flex-wrap items-center gap-4 bg-white/40 dark:bg-slate-900/40 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <span>Buscar</span>
          <div className="search-d w-64 sm:w-72">
            <Search size={14} />
            <input
              className="gm-input-d w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Código, nombre, marca o serie"
            />
          </div>
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <span>Estado</span>
          <select
            className="gm-select-d w-48"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
          >
            <option value="">Todos</option>
            {Object.entries(estados).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 flex items-center justify-between">
          <p role="alert">{error}</p>
          <Button onClick={load}>Reintentar</Button>
        </div>
      )}

      {loading ? (
        <p role="status" className="text-center py-10 text-slate-400">
          Cargando herramientas…
        </p>
      ) : (
        <div className="gm-card-d rounded-xl overflow-x-auto border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <table className="gm-table-d w-full">
            <thead>
              <tr>
                <th>Código</th>
                <th>Herramienta</th>
                <th>Serie / marca</th>
                <th>Estado</th>
                <th>Ubicación</th>
                <th>Observaciones</th>
                {isAdmin && <th className="text-right">Acción</th>}
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((h) => (
                <tr key={h.id_herramienta}>
                  <td className="font-mono text-xs font-semibold">{h.codigo}</td>
                  <td className="font-semibold">{h.nombre}</td>
                  <td>
                    {h.numero_serie || '—'}
                    <small className="block text-xs text-slate-400">{h.marca}</small>
                  </td>
                  <td>
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800">
                      {estados[h.estado]}
                    </span>
                  </td>
                  <td>{h.ubicacion || '—'}</td>
                  <td>{h.observaciones || '—'}</td>
                  {isAdmin && (
                    <td className="text-right">
                      <Button
                        size="sm"
                        onClick={() => {
                          setEdit(h);
                          setOpen(true);
                        }}
                      >
                        Editar
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
              {!filteredItems.length && (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="text-center py-12 text-slate-400 text-sm">
                    Todavía no hay herramientas registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      <Modal
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title={edit ? 'Editar herramienta' : 'Registrar herramienta'}
      >
        <form
          key={edit?.id_herramienta ?? 'nueva'}
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const data = Object.fromEntries(new FormData(form));
            setBusy(true);
            try {
              const payload = { ...data, fecha_adquisicion: data.fecha_adquisicion || null };
              if (edit) await herramientasApi.update(edit.id_herramienta, payload);
              else await herramientasApi.create(payload);
              setOpen(false);
              await load();
              toast.success('Herramienta guardada');
            } catch (err) {
              toast.error(getErrorMsg(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          {[
            ['codigo', 'Código *', 60],
            ['nombre', 'Nombre *', 150],
            ['marca', 'Marca', 100],
            ['numero_serie', 'Número de serie', 100],
            ['ubicacion', 'Ubicación', 150],
          ].map(([key, label, max]) => (
            <label key={key} className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
              <span className="mb-1 block">{label}</span>
              <input
                name={String(key)}
                className="gm-input-d block w-full"
                required={key === 'codigo' || key === 'nombre'}
                maxLength={Number(max)}
                defaultValue={String(edit?.[key as keyof Herramienta] ?? '')}
              />
            </label>
          ))}
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
            <span className="mb-1 block">Estado</span>
            <select
              name="estado"
              className="gm-select-d block w-full"
              defaultValue={edit?.estado ?? 'DISPONIBLE'}
            >
              {Object.entries(estados).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
            <span className="mb-1 block">Fecha de adquisición</span>
            <input
              type="date"
              name="fecha_adquisicion"
              className="gm-input-d block w-full"
              defaultValue={edit?.fecha_adquisicion ?? ''}
            />
          </label>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
            <span className="mb-1 block">Observaciones</span>
            <textarea
              name="observaciones"
              maxLength={1500}
              className="gm-input-d block w-full h-20 py-2"
              defaultValue={edit?.observaciones ?? ''}
            />
          </label>
          <div className="pt-2 flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={busy}>
              Guardar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
