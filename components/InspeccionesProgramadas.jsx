import { useState, useEffect } from "react";

// ─── Shared Data (same mock as GestorInspecciones) ────────────────────────────

const INSPECTION_TYPES = [
  { id: "general",    label: "Seguridad General",    color: "#3b82f6", icon: "🛡️" },
  { id: "epp",        label: "EPP",                  color: "#8b5cf6", icon: "🦺" },
  { id: "condiciones",label: "Condiciones del Lugar",color: "#f59e0b", icon: "🏗️" },
  { id: "incendio",   label: "Protección Incendio",  color: "#ef4444", icon: "🔥" },
  { id: "electrico",  label: "Riesgo Eléctrico",     color: "#06b6d4", icon: "⚡" },
  { id: "ergonomia",  label: "Ergonomía",            color: "#10b981", icon: "🧍" },
];

const RECURRENCE_OPTIONS = [
  { value: "none",      label: "Sin recurrencia" },
  { value: "monthly",   label: "Mensual" },
  { value: "quarterly", label: "Trimestral" },
  { value: "biannual",  label: "Semestral" },
  { value: "annual",    label: "Anual" },
];

// Sample data scoped to the current inspector (u1 = Carlos Méndez as demo)
const today = new Date();
const fmt = (d) => d.toISOString().split("T")[0];
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

const MY_TASKS = [
  { id: "t1", companyId: "c1", companyName: "Metalúrgica San Martín", plantName: "Planta Norte", plantAddress: "Av. Industrial 2200", plantCity: "Pacheco", sector: "Soldadura", inspectorId: "u1", inspectorName: "Carlos Méndez", type: "general", typeName: "Seguridad General", scheduledDate: fmt(addDays(today, 3)), status: "programada", recurrence: "monthly", createdAt: fmt(addDays(today, -5)), notes: "Foco en zona de soldadura — chispas cerca de material combustible.", rescheduleHistory: [] },
  { id: "t2", companyId: "c2", companyName: "Constructora Vial del Litoral", plantName: "Obrador Central", plantAddress: "Camino Viejo s/n", plantCity: "Rosario", sector: "Equipos pesados", inspectorId: "u1", inspectorName: "Carlos Méndez", type: "epp", typeName: "EPP", scheduledDate: fmt(addDays(today, -2)), status: "programada", recurrence: "none", createdAt: fmt(addDays(today, -15)), notes: "", rescheduleHistory: [] },
  { id: "t5", companyId: "c2", companyName: "Constructora Vial del Litoral", plantName: "Base Operativa Norte", plantAddress: "RP 11 Km 340", plantCity: "Reconquista", sector: "Mantenimiento", inspectorId: "u1", inspectorName: "Carlos Méndez", type: "electrico", typeName: "Riesgo Eléctrico", scheduledDate: fmt(addDays(today, 1)), status: "programada", recurrence: "none", createdAt: fmt(addDays(today, -7)), notes: "Tableros eléctricos en mal estado.", rescheduleHistory: [] },
  { id: "t4", companyId: "c1", companyName: "Metalúrgica San Martín", plantName: "Planta Sur", plantAddress: "Ruta 4 Km 12.5", plantCity: "Avellaneda", sector: "Fundición", inspectorId: "u1", inspectorName: "Carlos Méndez", type: "incendio", typeName: "Protección Incendio", scheduledDate: fmt(addDays(today, -10)), status: "realizada", recurrence: "biannual", createdAt: fmt(addDays(today, -20)), linkedInspectionId: "insp-8827", completedAt: fmt(addDays(today, -10)), notes: "Verificar extintores y señalización.", rescheduleHistory: [] },
];

// ─── Atoms ────────────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const m = {
    programada:   { bg: "#3b82f620", c: "#60a5fa", l: "Programada",   d: "#3b82f6" },
    vencida:      { bg: "#ef444420", c: "#f87171", l: "Vencida",      d: "#ef4444" },
    realizada:    { bg: "#10b98120", c: "#34d399", l: "Realizada",    d: "#10b981" },
    reprogramada: { bg: "#f59e0b20", c: "#fbbf24", l: "Reprogramada", d: "#f59e0b" },
  };
  const s = m[status] || m.programada;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 99, background: s.bg, color: s.c, fontSize: 11, fontWeight: 600 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.d }} />
      {s.l}
    </span>
  );
};

const CountCard = ({ label, value, color, icon, active, onClick }) => (
  <button onClick={onClick} style={{ flex: 1, minWidth: 72, background: active ? `${color}11` : "rgba(255,255,255,0.02)", border: active ? `1.5px solid ${color}40` : "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "12px 10px", cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13 }}>{icon}</span>
    </div>
    <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
  </button>
);

const Toast = ({ message, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);
  return (
    <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, background: "rgba(16,185,129,0.14)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 11, padding: "10px 16px", color: "#34d399", fontSize: 12, fontWeight: 600, backdropFilter: "blur(10px)", animation: "toastIn .3s ease" }}>
      ✅ {message}
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
  const [nd, setNd] = useState(fmt(addDays(today, 7)));
  const [reason, setReason] = useState("");
  const ok = nd && reason.trim().length > 5;
  const sI = { width: "100%", padding: "9px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  return (
    <Overlay>
      <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 24, width: 400, maxWidth: "92vw" }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 14 }}>🔄 Reprogramar tarea</h3>
        <p style={{ margin: "0 0 16px", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{task.companyName} — {task.plantName}</p>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: 5 }}>Nueva fecha</label>
          <input type="date" value={nd} onChange={e => setNd(e.target.value)} style={sI} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: 5 }}>Motivo (obligatorio)</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Describí el motivo..." rows={3} style={{ ...sI, resize: "none" }} />
          {reason.length > 0 && reason.trim().length <= 5 && <p style={{ margin: "4px 0 0", fontSize: 10, color: "#f87171" }}>Mínimo 6 caracteres</p>}
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12 }}>
          <div><span style={{ color: "rgba(255,255,255,0.3)" }}>Empresa:</span> <span style={{ color: "#93c5fd" }}>{task.companyName}</span></div>
          <div><span style={{ color: "rgba(255,255,255,0.3)" }}>Planta:</span> <span style={{ color: "#93c5fd" }}>{task.plantName}</span></div>
          <div><span style={{ color: "rgba(255,255,255,0.3)" }}>Sector:</span> <span style={{ color: "#93c5fd" }}>{task.sector}</span></div>
          <div><span style={{ color: "rgba(255,255,255,0.3)" }}>Tipo:</span> <span style={{ color: "#93c5fd" }}>{task.typeName}</span></div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={{ padding: "8px 16px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.45)", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>Cancelar</button>
        <button onClick={onComplete} style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: "#10b981", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>✅ Marcar completada</button>
      </div>
    </div>
  </Overlay>
);

// ─── TaskCard ─────────────────────────────────────────────────────────────────

const TaskCard = ({ task, onExecute, onReschedule }) => {
  const isPast = new Date(task.scheduledDate) < today && task.status === "programada";
  const es = isPast ? "vencida" : task.status;
  const tp = INSPECTION_TYPES.find(t => t.id === task.type);
  const days = Math.ceil((new Date(task.scheduledDate) - today) / 86400000);

  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${isPast ? "rgba(239,68,68,0.18)" : "rgba(255,255,255,0.06)"}`, borderRadius: 14, padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 32, height: 32, borderRadius: 8, background: `${tp?.color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{tp?.icon}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{task.companyName}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{task.typeName}</div>
          </div>
        </div>
        <StatusBadge status={es} />
      </div>

      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 10 }}>
        📍 {task.plantName} — {task.plantAddress}, {task.plantCity}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <span style={{ padding: "5px 8px", borderRadius: 7, background: "rgba(255,255,255,0.03)", fontSize: 10, color: "rgba(255,255,255,0.45)" }}>
          📅 {new Date(task.scheduledDate + "T12:00:00").toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "short" })}
          {es === "programada" && (
            <span style={{ marginLeft: 5, color: days <= 2 ? "#fbbf24" : "#34d399", fontWeight: 600 }}>
              {days === 0 ? "· HOY" : days === 1 ? "· mañana" : `· en ${days}d`}
            </span>
          )}
        </span>
        {task.sector && <span style={{ padding: "5px 8px", borderRadius: 7, background: "rgba(255,255,255,0.03)", fontSize: 10, color: "rgba(255,255,255,0.45)" }}>🏭 {task.sector}</span>}
        {task.recurrence !== "none" && (
          <span style={{ padding: "5px 8px", borderRadius: 7, background: "rgba(139,92,246,0.1)", fontSize: 10, color: "#a78bfa" }}>
            🔁 {RECURRENCE_OPTIONS.find(r => r.value === task.recurrence)?.label}
          </span>
        )}
      </div>

      {task.notes && <p style={{ margin: "0 0 12px", fontSize: 11, color: "rgba(255,255,255,0.3)", fontStyle: "italic", paddingLeft: 8, borderLeft: "2px solid rgba(255,255,255,0.07)" }}>{task.notes}</p>}

      {task.rescheduleHistory?.length > 0 && (
        <div style={{ marginBottom: 12, padding: "8px 10px", borderRadius: 8, background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.1)" }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: "#fbbf24", textTransform: "uppercase", marginBottom: 3 }}>Reprogramación</div>
          {task.rescheduleHistory.map((r, i) => (
            <div key={i} style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
              {new Date(r.from + "T12:00:00").toLocaleDateString("es-AR")} → {new Date(r.to + "T12:00:00").toLocaleDateString("es-AR")} — <em>{r.reason}</em>
            </div>
          ))}
        </div>
      )}

      {es === "realizada" && task.linkedInspectionId && (
        <div style={{ padding: "7px 10px", borderRadius: 8, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.12)", fontSize: 11, color: "#34d399" }}>
          ✅ Inspección <strong>#{task.linkedInspectionId}</strong> — {new Date(task.completedAt + "T12:00:00").toLocaleDateString("es-AR")}
        </div>
      )}

      {(es === "programada" || es === "vencida") && (
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button onClick={() => onExecute(task)} style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "none", background: "#3b82f6", color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit" }}>
            Ejecutar Inspección
          </button>
          <button onClick={() => onReschedule(task)} style={{ padding: "9px 14px", borderRadius: 9, border: "1px solid rgba(245,158,11,0.25)", background: "rgba(245,158,11,0.07)", color: "#fbbf24", cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit" }}>
            🔄 Reprogramar
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Main: InspeccionesProgramadas (Inspector view) ───────────────────────────

export default function InspeccionesProgramadas() {
  const [tasks, setTasks] = useState(MY_TASKS);
  const [statusFilter, setStatusFilter] = useState("all");
  const [rescheduleTask, setRescheduleTask] = useState(null);
  const [executingTask, setExecutingTask] = useState(null);
  const [toast, setToast] = useState(null);

  const enriched = tasks.map(t => ({
    ...t,
    _es: new Date(t.scheduledDate) < today && t.status === "programada" ? "vencida" : t.status,
  })).sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));

  const filtered = statusFilter === "all" ? enriched : enriched.filter(t => t._es === statusFilter);

  const cn = {
    all: enriched.length,
    programada: enriched.filter(t => t._es === "programada").length,
    vencida: enriched.filter(t => t._es === "vencida").length,
    realizada: enriched.filter(t => t._es === "realizada").length,
    reprogramada: enriched.filter(t => t._es === "reprogramada").length,
  };

  const handleReschedule = (d, r) => {
    setTasks(p =>
      p.map(t => t.id !== rescheduleTask.id ? t : {
        ...t, status: "reprogramada",
        rescheduleHistory: [...(t.rescheduleHistory || []), { from: t.scheduledDate, to: d, reason: r }],
      }).concat([{
        ...rescheduleTask, id: "t" + Date.now(), scheduledDate: d, status: "programada",
        rescheduleHistory: [...(rescheduleTask.rescheduleHistory || []), { from: rescheduleTask.scheduledDate, to: d, reason: r }],
      }])
    );
    setRescheduleTask(null);
    setToast(`Reprogramada al ${new Date(d + "T12:00:00").toLocaleDateString("es-AR")}`);
  };

  const handleComplete = () => {
    const iid = "insp-" + Math.random().toString(36).substring(2, 6);
    setTasks(p => p.map(t => t.id === executingTask.id ? { ...t, status: "realizada", linkedInspectionId: iid, completedAt: fmt(today) } : t));
    setExecutingTask(null);
    setToast(`Inspección #${iid} marcada como completada`);
  };

  return (
    <div style={{ fontFamily: "inherit", color: "#fff", minHeight: "100%" }}>
      <style>{`
        @keyframes toastIn { from { transform: translateX(60px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
      `}</style>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      {rescheduleTask && <RescheduleModal task={rescheduleTask} onConfirm={handleReschedule} onCancel={() => setRescheduleTask(null)} />}
      {executingTask && <ExecuteModal task={executingTask} onComplete={handleComplete} onCancel={() => setExecutingTask(null)} />}

      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>Mis Inspecciones Programadas</h2>
        <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
          Bandeja de tareas asignadas
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <CountCard label="Total" value={cn.all} color="#fff" icon="📋" active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
        <CountCard label="Próximas" value={cn.programada} color="#60a5fa" icon="📅" active={statusFilter === "programada"} onClick={() => setStatusFilter("programada")} />
        <CountCard label="Vencidas" value={cn.vencida} color="#f87171" icon="⚠️" active={statusFilter === "vencida"} onClick={() => setStatusFilter("vencida")} />
        <CountCard label="Realizadas" value={cn.realizada} color="#34d399" icon="✅" active={statusFilter === "realizada"} onClick={() => setStatusFilter("realizada")} />
        <CountCard label="Reprog." value={cn.reprogramada} color="#fbbf24" icon="🔄" active={statusFilter === "reprogramada"} onClick={() => setStatusFilter("reprogramada")} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.2)" }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>📭</div>
            <div style={{ fontSize: 12 }}>No hay tareas {statusFilter !== "all" && `con estado "${statusFilter}"`}</div>
          </div>
        ) : (
          filtered.map(t => <TaskCard key={t.id} task={t} onExecute={setExecutingTask} onReschedule={setRescheduleTask} />)
        )}
      </div>
    </div>
  );
}
