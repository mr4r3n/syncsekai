'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, History, Info, LifeBuoy, Loader2, Trash2, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';
import { useI18n } from '@/i18n/I18nProvider';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Paginacion } from '@/components/Paginacion';
import { describirNotificacion } from '@/lib/notificaciones';

const ICONOS = { alerta: AlertTriangle, usuario: UserPlus, ticket: LifeBuoy, info: Info } as const;
const COLORES = { alerta: 'text-amber-400', usuario: 'text-emerald-400', ticket: 'text-sky-400', info: 'text-blue-400' } as const;
const POR_PAGINA = 15;

/**
 * Historial completo del usuario: también lo que ya quitó de la campana.
 * Aquí sí se borra de verdad; en la campana solo se esconde.
 */
export function HistorialNotificaciones({ esAdmin }: { esAdmin: boolean }) {
  const { t, locale } = useI18n();
  const { showToast, showUndoToast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [confirmarTodo, setConfirmarTodo] = useState(false);

  const cargar = async (p = pagina) => {
    try {
      setCargando(true);
      const res = await api.notifications.getHistory(p, POR_PAGINA);
      setItems(res.notifications || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar(pagina);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina]);

  const borrar = (n: any) => {
    setItems((prev) => prev.filter((x) => x.id !== n.id));
    setTotal((prev) => Math.max(0, prev - 1));
    showUndoToast(t('notif.deleting'), {
      alDeshacer: () => cargar(pagina),
      alExpirar: async () => {
        try {
          await api.notifications.delete(n.id);
        } catch (e: any) {
          showToast(e.message, 'error');
          cargar(pagina);
        }
      },
    });
  };

  const borrarTodo = async () => {
    setConfirmarTodo(false);
    try {
      await api.notifications.deleteAll();
      setItems([]);
      setTotal(0);
      setPagina(1);
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const fecha = (iso: string) =>
    new Date(iso).toLocaleString(locale === 'es' ? 'es-ES' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <div id="historial" className="glass-card p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--glass-border)]">
        <div className="flex items-center gap-2.5">
          <History className="w-4 h-4 text-[var(--accent-text)]" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-bold font-heading">{t('notif.historyTitle')}</h2>
            <p className="text-[11px] text-[var(--text-muted)]">{t('notif.historySubtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono text-[var(--text-muted)]">
          <span>{t('notif.countTotal', { n: total })}</span>
          {total > 0 && (
            <button type="button" onClick={() => setConfirmarTodo(true)} className="btn-secondary text-xs text-[var(--status-danger)]">
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t('notif.deleteAll')}</span>
            </button>
          )}
        </div>
      </div>

      {cargando ? (
        <div className="py-10 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--accent-text)]" aria-hidden="true" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-xs font-mono text-[var(--text-muted)]">{t('notif.historyEmpty')}</p>
      ) : (
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] font-mono uppercase text-[10.5px]">
              <tr>
                <th scope="col" className="py-2.5 px-3 font-semibold">{t('notif.colNotification')}</th>
                <th scope="col" className="py-2.5 px-3 font-semibold">{t('notif.colMessage')}</th>
                <th scope="col" className="py-2.5 px-3 font-semibold">{t('notif.colStatus')}</th>
                <th scope="col" className="py-2.5 px-3 font-semibold">{t('notif.colDate')}</th>
                <th scope="col" className="py-2.5 px-3 font-semibold text-right">{t('notif.colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--glass-border)]">
              {items.map((n) => {
                const d = describirNotificacion(n, t, esAdmin);
                const Icono = ICONOS[d.icono];
                return (
                  <tr key={n.id} className={`hover:bg-[var(--bg-surface-hover)] transition-colors ${n.dismissedAt ? 'opacity-75' : ''}`}>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Icono className={`w-4 h-4 shrink-0 ${COLORES[d.icono]}`} aria-hidden="true" />
                        <span className="font-bold text-[var(--text-primary)]">{d.titulo}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-[var(--text-secondary)] max-w-[28rem] truncate" title={d.mensaje}>
                      {d.mensaje}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {n.dismissedAt ? (
                        <span className="inline-flex items-center h-6 px-2 rounded-[5px] bg-[var(--bg-surface)] text-[var(--text-muted)] text-[10px] font-mono">{t('notif.removedFromBell')}</span>
                      ) : n.isRead ? (
                        <span className="inline-flex items-center h-6 px-2 rounded-[5px] bg-[var(--bg-surface)] text-[var(--text-muted)] text-[10px] font-mono">{t('notif.read')}</span>
                      ) : (
                        <span className="badge-status-success text-[10px] font-mono !h-6">{t('notif.unread')}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-[var(--text-secondary)] whitespace-nowrap">{fecha(n.createdAt)}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {d.accion && (
                          <Link
                            href={d.accion.href}
                            className="px-2 py-1 rounded-[5px] text-[11px] font-semibold text-[var(--accent-text)] hover:bg-[var(--bg-surface)] transition-colors"
                          >
                            {d.accion.etiqueta}
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={() => borrar(n)}
                          className="px-2 py-1 rounded-[5px] text-[11px] font-semibold text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          {t('notif.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Paginacion
        pagina={pagina}
        totalPaginas={totalPaginas}
        onCambio={setPagina}
        resumen={t('common.page', { page: pagina, total: totalPaginas })}
        etiquetaAnterior={t('common.previous')}
        etiquetaSiguiente={t('common.next')}
      />

      <ConfirmModal
        isOpen={confirmarTodo}
        onClose={() => setConfirmarTodo(false)}
        onConfirm={borrarTodo}
        title={t('notif.deleteAllTitle')}
        description={t('notif.deleteAllMessage')}
        confirmText={t('notif.deleteAll')}
        variant="danger"
      />
    </div>
  );
}
