import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";

// ─── Estáticos ────────────────────────────────────────────────────────────────

const INSPECTION_TYPES = [
  { id: "general",     label: "Seguridad General"    },
  { id: "epp",         label: "EPP"                  },
  { id: "condiciones", label: "Condiciones del Lugar" },
  { id: "incendio",    label: "Protección Incendio"  },
  { id: "electrico",   label: "Riesgo Eléctrico"     },
  { id: "ergonomia",   label: "Ergonomía"            },
];

const RECURRENCE_OPTIONS = [
  { value: "none",      label: "Sin recurrencia" },
  { value: "monthly",   label: "Mensual"          },
  { value: "quarterly", label: "Trimestral"       },
  { value: "biannual",  label: "Semestral"        },
  { value: "annual",    label: "Anual"            },
];

const today = new Date();

// ─── Atoms ────────────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const m = {
    programada:   { bg: "#3b82f620", c: "#60a5fa", l: "Programada"  },
    vencida:      { bg: "#ef444420", c: "#f87171", l: "Vencida"     },
    realizada:    { bg: "#10b98120", c: "#34d399", l: "Realizada"   },
    reprogramada: { bg: "#f59e0b20", c: "#fbbf24", l: "Reprogramada"},
  };
  const s = m[status] || m.programada;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 99, background: s.bg, color: s.c, fontSize: 11, fontWeight: 600 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.c }} />
      {s.l}
    </span>
  );
};

const CountCard = ({ label, value, color, active, onClick }) => (
  <button onClick={onClick} style={{ flex: 1, minWidth: 70, background: active ? `${color}18` : "rgba(255,255,255,0.02)", border: active ? `1.5px solid ${color}50` : "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "12px 10px", cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}>
    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 500, marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
  </button>
);

const Toast = ({ message, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);
  return (
    <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, background: "rgba(16,185,129,0.14)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 11, padding: "10px 16px", color: "#34d399", fontSize: 12, fontWeight: 600, backdropFilter: "blur(10px)" }}>
      {message}
    </div>
  );
};

const Overlay = ({ children }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, backdropFilter: "blur(4px)" }}>
    {children}
  </div>
);

// ─── Modals ───────────────────────────────────────────────────────────────────

const RescheduleModal = ({ task, onConfirm, onCancel }) => {
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  const fmt = (d) => d.toISOString().split("T")[0];
  const [nd, setNd] = useState(fmt(addDays(today, 7)));
  const [reason, setReason] = useState("");
  const ok = nd && reason.trim().length > 5;
  const sI = { width: "100%", padding: "9px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  return (
    <Overlay>
      <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 24, width: 400, maxWidth: "92vw" }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 14 }}>Reprogramar tarea</h3>
        <p style={{ margin: "0 0 16px", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{task.companyName} — {task.plantName}</p>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: 5 }}>Nueva fecha</label>
          <input type="date" value={nd} onChange={e => setNd(e.target.value)} style={sI} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: 5 }}>Motivo (obligatorio)</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Describí el motivo..." rows={3} style={{ ...sI, resize: "none" }} />
          {reason.length > 0 && reason.trim().length <= 5 && (
            <p style={{ margin: "4px 0 0", fontSize: 10, color: "#f87171" }}>Mínimo 6 caracteres</p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ padding: "8px 16px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.45)", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>Cancelar</button>
          <button onClick={() => ok && onConfirm(nd, reason)} disabled={!ok} style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: ok ? "#f59e0b" : "rgba(255,255,255,0.05)", color: ok ? "#000" : "rgba(255,255,255,0.2)", cursor: ok ? "pointer" : "not-allowed", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>Reprogramar</button>
        </div>
      </div>
    </Overlay>
  );
};

const ExecuteModal = ({ task, onComplete, onCancel }) => (
  <Overlay>
    <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 24, width: 440, maxWidth: "92vw" }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>Ejecutar Inspección</h3>
      <p style={{ margin: "0 0 16px", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Empresa y locación pre-cargadas</p>
      <div style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.12)", borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
          <div><span style={{ color: "rgba(255,255,255,0.3)" }}>Empresa: </span><span style={{ color: "#93c5fd" }}>{task.companyName}</span></div>
          <div><span style={{ color: "rgba(255,255,255,0.3)" }}>Planta: </span><span style={{ color: "#93c5fd" }}>{task.plantName}</span></div>
          <div><span style={{ color: "rgba(255,255,255,0.3)" }}>Sector: </span><span style={{ color: "#93c5fd" }}>{task.sector || "General"}</span></div>
          <div><span style={{ color: "rgba(255,255,255,0.3)" }}>Tipo: </span><span style={{ color: "#93c5fd" }}>{task.typeName}</span></div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={{ padding: "8px 16px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.45)", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>Cancelar</button>
        <button onClick={onComplete} style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: "#10b981", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>Marcar completada</button>
      </div>
    </div>
  </Overlay>
);

// ─── TaskCard ─────────────────────────────────────────────────────────────────

const TaskCard = ({ task, onExecute, onReschedule }) => {
  const isPast = new Date(task.scheduledDate) < today && task.status === "programada";
  const es = isPast ? "vencida" : task.status;
  const days = Math.ceil((new Date(task.scheduledDate) - today) / 86400000);

  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${isPast ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.06)"}`, borderRadius: 14, padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{task.companyName}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{task.typeName}</div>
        </div>
        <StatusBadge status={es} />
      </div>

      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 10 }}>
        {task.plantName}{task.plantAddress ? ` — ${task.plantAddress}` : ""}
        {task.plantCity ? `, ${task.plantCity}` : ""}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: task.notes || task.rescheduleHistory?.length ? 12 : 0 }}>
        <span style={{ padding: "4px 8px", borderRadius: 7, background: "rgba(255,255,255,0.03)", fontSize: 10, color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.06)" }}>
          {new Date(task.scheduledDate + "T12:00:00").toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "short" })}
          {es === "programada" && (
            <span style={{ marginLeft: 6, color: days <= 2 ? "#fbbf24" : "#34d399", fontWeight: 700 }}>
              {days === 0 ? "Hoy" : days === 1 ? "Mañana" : `En ${days}d`}
            </span>
          )}
        </span>
        {task.sector && (
          <span style={{ padding: "4px 8px", borderRadius: 7, background: "rgba(255,255,255,0.03)", fontSize: 10, color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {task.sector}
          </span>
        )}
        {task.recurrence !== "none" && (
          <span style={{ padding: "4px 8px", borderRadius: 7, background: "rgba(139,92,246,0.08)", fontSize: 10, color: "#a78bfa", border: "1px solid rgba(139,92,246,0.15)" }}>
            {RECURRENCE_OPTIONS.find(r => r.value === task.recurrence)?.label}
          </span>
        )}
      </div>

      {task.notes && (
        <p style={{ margin: "10px 0 12px", fontSize: 11, color: "rgba(255,255,255,0.3)", fontStyle: "italic", paddingLeft: 8, borderLeft: "2px solid rgba(255,255,255,0.07)" }}>
          {task.notes}
        </p>
      )}

      {task.rescheduleHistory?.length > 0 && (
        <div style={{ marginBottom: 12, padding: "8px 10px", borderRadius: 8, background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.12)" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#fbbf24", textTransform: "uppercase", marginBottom: 4 }}>Reprogramación</div>
          {task.rescheduleHistory.map((r, i) => (
            <div key={i} style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
              {new Date(r.from + "T12:00:00").toLocaleDateString("es-AR")} → {new Date(r.to + "T12:00:00").toLocaleDateString("es-AR")} — <em>{r.reason}</em>
            </div>
          ))}
        </div>
      )}

      {es === "realizada" && task.linkedInspectionId && (
        <div style={{ padding: "7px 10px", borderRadius: 8, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.14)", fontSize: 11, color: "#34d399" }}>
          Completada · Inspección #{task.linkedInspectionId}
          {task.completedAt && ` — ${new Date(task.completedAt + "T12:00:00").toLocaleDateString("es-AR")}`}
        </div>
      )}

      {(es === "programada" || es === "vencida") && (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={() => onExecute(task)} style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "none", background: "#3b82f6", color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit" }}>
            Ejecutar inspección
          </button>
          <button onClick={() => onReschedule(task)} style={{ padding: "9px 14px", borderRadius: 9, border: "1px solid rgba(245,158,11,0.25)", background: "rgba(245,158,11,0.07)", color: "#fbbf24", cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit" }}>
            Reprogramar
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Main: InspeccionesProgramadas ────────────────────────────────────────────

export default function InspeccionesProgramadas() {
  const { authFetch, user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [rescheduleTask, setRescheduleTask] = useState(null);
  const [executingTask, setExecutingTask] = useState(null);
  const [toast, setToast] = useState(null);

  const fmt = (d) => d.toISOString().split("T")[0];

  // Cargar empresas asignadas al inspector logueado y construir la bandeja
  useEffect(() => {
    async function load() {
      setLoadingData(true);
      try {
        const res = await authFetch("/api/schedules/list");
        const data = await res.json();
        if (data.ok && data.schedules) {
          setTasks(data.schedules);
        }
      } catch (e) {
        console.error("InspeccionesProgramadas load error:", e);
      }
      setLoadingData(false);
    }
    load();
  }, []);

  const enriched = tasks.map(t => ({
    ...t,
    _es: new Date(t.scheduledDate) < today && t.status === "programada" ? "vencida" : t.status,
  })).sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));

  const filtered = statusFilter === "all" ? enriched : enriched.filter(t => t._es === statusFilter);

  const cn = {
    all:          enriched.length,
    programada:   enriched.filter(t => t._es === "programada").length,
    vencida:      enriched.filter(t => t._es === "vencida").length,
    realizada:    enriched.filter(t => t._es === "realizada").length,
    reprogramada: enriched.filter(t => t._es === "reprogramada").length,
  };

  const handleReschedule = async (d, r) => {
    try {
      // 1. Marcar la original como reprogramada
      const res1 = await authFetch(`/api/schedules/${rescheduleTask.id}`, {
        method: "PUT",
        body: JSON.stringify({ 
          status: "reprogramada",
          rescheduleHistory: [...(rescheduleTask.rescheduleHistory || []), { from: rescheduleTask.scheduledDate, to: d, reason: r }]
        }),
      });
      
      // 2. Crear la nueva tarea programada
      const res2 = await authFetch("/api/schedules/create", {
        method: "POST",
        body: JSON.stringify({
          ...rescheduleTask,
          scheduledDate: d,
          status: "programada",
          rescheduleHistory: [...(rescheduleTask.rescheduleHistory || []), { from: rescheduleTask.scheduledDate, to: d, reason: r }]
        }),
      });

      const d1 = await res1.json();
      const d2 = await res2.json();

      if (d1.ok && d2.ok) {
        setTasks(p => p.map(t => t.id === rescheduleTask.id ? d1.schedule : t).concat([d2.schedule]));
        setRescheduleTask(null);
        setToast(`Reprogramada al ${new Date(d + "T12:00:00").toLocaleDateString("es-AR")}`);
      }
    } catch (e) {
      console.error("Error rescheduling:", e);
      alert("Error al reprogramar");
    }
  };

  const handleComplete = async () => {
    const iid = "insp-" + Math.random().toString(36).substring(2, 6);
    try {
      const res = await authFetch(`/api/schedules/${executingTask.id}`, {
        method: "PUT",
        body: JSON.stringify({ 
          status: "realizada", 
          linkedInspectionId: iid, 
          completedAt: fmt(today) 
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setTasks(p => p.map(t => t.id === executingTask.id ? data.schedule : t));
        setExecutingTask(null);
        setToast(`Inspección #${iid} marcada como completada`);
      }
    } catch (e) {
      console.error("Error completing:", e);
      alert("Error al completar la tarea");
    }
  };

  return (
    <div style={{ fontFamily: "inherit", color: "#fff", minHeight: "100%" }}>
      <style>{`
        @keyframes toastIn { from { transform: translateX(60px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); }
      `}</style>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      {rescheduleTask && <RescheduleModal task={rescheduleTask} onConfirm={handleReschedule} onCancel={() => setRescheduleTask(null)} />}
      {executingTask && <ExecuteModal task={executingTask} onComplete={handleComplete} onCancel={() => setExecutingTask(null)} />}

      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>Inspecciones Programadas</h2>
        <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
          Tareas asignadas a {user?.displayName || user?.email || "vos"}
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <CountCard label="Total"      value={cn.all}         color="#94a3b8" active={statusFilter === "all"}         onClick={() => setStatusFilter("all")} />
        <CountCard label="Próximas"   value={cn.programada}  color="#60a5fa" active={statusFilter === "programada"}  onClick={() => setStatusFilter("programada")} />
        <CountCard label="Vencidas"   value={cn.vencida}     color="#f87171" active={statusFilter === "vencida"}     onClick={() => setStatusFilter("vencida")} />
        <CountCard label="Realizadas" value={cn.realizada}   color="#34d399" active={statusFilter === "realizada"}   onClick={() => setStatusFilter("realizada")} />
        <CountCard label="Reprog."    value={cn.reprogramada}color="#fbbf24" active={statusFilter === "reprogramada"} onClick={() => setStatusFilter("reprogramada")} />
      </div>

      {loadingData ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.25)", fontSize: 13 }}>
          Cargando...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(255,255,255,0.2)" }}>
          <div style={{ fontSize: 13, marginBottom: 6, color: "rgba(255,255,255,0.25)", fontWeight: 600 }}>
            Sin tareas programadas
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.15)" }}>
            {statusFilter !== "all"
              ? "No hay tareas con ese estado"
              : "El administrador aún no asignó inspecciones programadas"}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(t => (
            <TaskCard key={t.id} task={t} onExecute={setExecutingTask} onReschedule={setRescheduleTask} />
          ))}
        </div>
      )}
    </div>
  );
}
