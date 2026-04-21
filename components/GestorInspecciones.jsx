import { useState, useEffect } from "react";

// ─── Mock Data ───────────────────────────────────────────────────────────────

const COMPANIES = [
  { id: "c1", name: "Metalúrgica San Martín", plants: [
    { name: "Planta Norte", address: "Av. Industrial 2200", city: "Pacheco", sectors: ["Soldadura", "Corte", "Depósito"] },
    { name: "Planta Sur", address: "Ruta 4 Km 12.5", city: "Avellaneda", sectors: ["Fundición", "Mecanizado", "Logística"] },
  ]},
  { id: "c2", name: "Constructora Vial del Litoral", plants: [
    { name: "Obrador Central", address: "Camino Viejo s/n", city: "Rosario", sectors: ["Obras civiles", "Equipos pesados"] },
    { name: "Base Operativa Norte", address: "RP 11 Km 340", city: "Reconquista", sectors: ["Mantenimiento", "Acopio"] },
  ]},
  { id: "c3", name: "Alimentos del Sur S.A.", plants: [
    { name: "Planta Procesadora", address: "Parque Industrial Mz 8", city: "Bahía Blanca", sectors: ["Lácteos", "Cárnicos", "Cámara frigorífica", "Expedición"] },
  ]},
];

const INSPECTORS = [
  { id: "u1", name: "Carlos Méndez", email: "cmendez@hse-ingenieria.com", avatar: "CM" },
  { id: "u2", name: "Laura Vignatti", email: "lvignatti@hse-ingenieria.com", avatar: "LV" },
  { id: "u3", name: "Martín Suárez", email: "msuarez@hse-ingenieria.com", avatar: "MS" },
];

const INSPECTION_TYPES = [
  { id: "general", label: "Seguridad General", color: "#3b82f6", icon: "🛡️" },
  { id: "epp", label: "EPP", color: "#8b5cf6", icon: "🦺" },
  { id: "condiciones", label: "Condiciones del Lugar", color: "#f59e0b", icon: "🏗️" },
  { id: "incendio", label: "Protección Incendio", color: "#ef4444", icon: "🔥" },
  { id: "electrico", label: "Riesgo Eléctrico", color: "#06b6d4", icon: "⚡" },
  { id: "ergonomia", label: "Ergonomía", color: "#10b981", icon: "🧍" },
];

const RECURRENCE_OPTIONS = [
  { value: "none", label: "Sin recurrencia" },
  { value: "monthly", label: "Mensual" },
  { value: "quarterly", label: "Trimestral" },
  { value: "biannual", label: "Semestral" },
  { value: "annual", label: "Anual" },
];

const today = new Date();
const fmt = (d) => d.toISOString().split("T")[0];
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

const INITIAL_TASKS = [
  { id: "t1", companyId: "c1", companyName: "Metalúrgica San Martín", plantName: "Planta Norte", plantAddress: "Av. Industrial 2200", plantCity: "Pacheco", sector: "Soldadura", inspectorId: "u1", inspectorName: "Carlos Méndez", type: "general", typeName: "Seguridad General", scheduledDate: fmt(addDays(today, 3)), status: "programada", recurrence: "monthly", createdAt: fmt(addDays(today, -5)), notes: "Foco en zona de soldadura — chispas cerca de material combustible.", rescheduleHistory: [] },
  { id: "t2", companyId: "c2", companyName: "Constructora Vial del Litoral", plantName: "Obrador Central", plantAddress: "Camino Viejo s/n", plantCity: "Rosario", sector: "Equipos pesados", inspectorId: "u1", inspectorName: "Carlos Méndez", type: "epp", typeName: "EPP", scheduledDate: fmt(addDays(today, -2)), status: "vencida", recurrence: "none", createdAt: fmt(addDays(today, -15)), notes: "", rescheduleHistory: [] },
  { id: "t3", companyId: "c3", companyName: "Alimentos del Sur S.A.", plantName: "Planta Procesadora", plantAddress: "Parque Industrial Mz 8", plantCity: "Bahía Blanca", sector: "Cámara frigorífica", inspectorId: "u2", inspectorName: "Laura Vignatti", type: "condiciones", typeName: "Condiciones del Lugar", scheduledDate: fmt(addDays(today, 7)), status: "programada", recurrence: "quarterly", createdAt: fmt(addDays(today, -3)), notes: "Revisar temperatura y puertas herméticas.", rescheduleHistory: [] },
  { id: "t4", companyId: "c1", companyName: "Metalúrgica San Martín", plantName: "Planta Sur", plantAddress: "Ruta 4 Km 12.5", plantCity: "Avellaneda", sector: "Fundición", inspectorId: "u2", inspectorName: "Laura Vignatti", type: "incendio", typeName: "Protección Incendio", scheduledDate: fmt(addDays(today, -10)), status: "realizada", recurrence: "biannual", createdAt: fmt(addDays(today, -20)), linkedInspectionId: "insp-8827", completedAt: fmt(addDays(today, -10)), notes: "Verificar extintores y señalización.", rescheduleHistory: [] },
  { id: "t5", companyId: "c2", companyName: "Constructora Vial del Litoral", plantName: "Base Operativa Norte", plantAddress: "RP 11 Km 340", plantCity: "Reconquista", sector: "Mantenimiento", inspectorId: "u1", inspectorName: "Carlos Méndez", type: "electrico", typeName: "Riesgo Eléctrico", scheduledDate: fmt(addDays(today, 1)), status: "programada", recurrence: "none", createdAt: fmt(addDays(today, -7)), notes: "Tableros eléctricos en mal estado.", rescheduleHistory: [] },
  { id: "t6", companyId: "c3", companyName: "Alimentos del Sur S.A.", plantName: "Planta Procesadora", plantAddress: "Parque Industrial Mz 8", plantCity: "Bahía Blanca", sector: "Lácteos", inspectorId: "u3", inspectorName: "Martín Suárez", type: "ergonomia", typeName: "Ergonomía", scheduledDate: fmt(addDays(today, -5)), status: "reprogramada", recurrence: "none", createdAt: fmt(addDays(today, -12)), notes: "", rescheduleHistory: [{ from: fmt(addDays(today, -5)), to: fmt(addDays(today, 5)), reason: "Inspector con licencia médica" }] },
];

// ─── Shared Atoms ─────────────────────────────────────────────────────────────

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

// ─── Modals ──────────────────────────────────────────────────────────────────

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
      <p style={{ margin: "0 0 16px", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Abre Nueva Inspección con datos pre-llenados</p>
      <div style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.12)", borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginBottom: 8 }}>Pre-llenado automático</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12 }}>
          <div><span style={{ color: "rgba(255,255,255,0.3)" }}>Empresa:</span> <span style={{ color: "#93c5fd" }}>{task.companyName}</span></div>
          <div><span style={{ color: "rgba(255,255,255,0.3)" }}>Planta:</span> <span style={{ color: "#93c5fd" }}>{task.plantName}</span></div>
          <div><span style={{ color: "rgba(255,255,255,0.3)" }}>Sector:</span> <span style={{ color: "#93c5fd" }}>{task.sector}</span></div>
          <div><span style={{ color: "rgba(255,255,255,0.3)" }}>Tipo:</span> <span style={{ color: "#93c5fd" }}>{task.typeName}</span></div>
          <div style={{ gridColumn: "1/-1" }}><span style={{ color: "rgba(255,255,255,0.3)" }}>Dirección:</span> <span style={{ color: "#93c5fd" }}>{task.plantAddress}, {task.plantCity}</span></div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={{ padding: "8px 16px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.45)", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>Cancelar</button>
        <button onClick={onComplete} style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: "#10b981", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>✅ Marcar completada</button>
      </div>
    </div>
  </Overlay>
);

// ─── Schedule Form (Admin) ────────────────────────────────────────────────────

const ScheduleForm = ({ onSchedule, onCancel }) => {
  const [company, setCompany] = useState("");
  const [plant, setPlant] = useState("");
  const [sector, setSector] = useState("");
  const [inspector, setInspector] = useState("");
  const [type, setType] = useState("");
  const [date, setDate] = useState(fmt(addDays(today, 7)));
  const [recurrence, setRecurrence] = useState("none");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const co = COMPANIES.find(c => c.id === company);
  const pl = co?.plants.find(p => p.name === plant);
  const ok = company && plant && inspector && type && date;

  const submit = () => {
    if (!ok) return;
    setSaving(true);
    setTimeout(() => {
      const tp = INSPECTION_TYPES.find(t => t.id === type);
      onSchedule({
        id: "t" + Date.now(), companyId: company, companyName: co.name,
        plantName: plant, plantAddress: pl?.address || "", plantCity: pl?.city || "",
        sector: sector || pl?.sectors[0] || "", inspectorId: inspector,
        inspectorName: INSPECTORS.find(i => i.id === inspector)?.name || "",
        type, typeName: tp?.label || "", scheduledDate: date, status: "programada",
        recurrence, createdAt: fmt(today), notes, rescheduleHistory: [],
      });
      setSaving(false);
    }, 600);
  };

  const sI = { width: "100%", padding: "9px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  const sL = { display: "block", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 };

  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <span style={{ fontSize: 20 }}>📋</span>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Programar Inspección</h3>
          <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Asigná inspector, empresa, planta y fecha</p>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div><label style={sL}>Empresa</label><select value={company} onChange={e => { setCompany(e.target.value); setPlant(""); setSector(""); }} style={sI}><option value="">Seleccionar...</option>{COMPANIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label style={sL}>Planta</label><select value={plant} onChange={e => { setPlant(e.target.value); setSector(""); }} style={sI} disabled={!company}><option value="">Seleccionar...</option>{co?.plants.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}</select></div>
      </div>
      {pl && (
        <div style={{ marginTop: 10, padding: "10px 12px", background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.12)", borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: "#93c5fd", fontWeight: 600 }}>📍 {pl.address}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>{pl.city}</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 5 }}>
            {pl.sectors.map(s => <span key={s} style={{ fontSize: 9, padding: "2px 7px", borderRadius: 5, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)" }}>{s}</span>)}
          </div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
        <div><label style={sL}>Sector</label><select value={sector} onChange={e => setSector(e.target.value)} style={sI} disabled={!plant}><option value="">Todos</option>{pl?.sectors.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
        <div><label style={sL}>Inspector</label><select value={inspector} onChange={e => setInspector(e.target.value)} style={sI}><option value="">Seleccionar...</option>{INSPECTORS.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
      </div>
      <div style={{ marginTop: 14 }}>
        <label style={sL}>Tipo de inspección</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
          {INSPECTION_TYPES.map(t => (
            <button key={t.id} onClick={() => setType(t.id)} style={{ padding: "9px 6px", borderRadius: 9, border: type === t.id ? `1.5px solid ${t.color}` : "1px solid rgba(255,255,255,0.07)", background: type === t.id ? `${t.color}15` : "rgba(255,255,255,0.02)", cursor: "pointer", textAlign: "center" }}>
              <div style={{ fontSize: 16, marginBottom: 2 }}>{t.icon}</div>
              <div style={{ fontSize: 9, color: type === t.id ? t.color : "rgba(255,255,255,0.45)", fontWeight: 600 }}>{t.label}</div>
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
        <div><label style={sL}>Fecha</label><input type="date" value={date} onChange={e => setDate(e.target.value)} style={sI} /></div>
        <div><label style={sL}>Recurrencia</label><select value={recurrence} onChange={e => setRecurrence(e.target.value)} style={sI}>{RECURRENCE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select></div>
      </div>
      <div style={{ marginTop: 14 }}><label style={sL}>Notas</label><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Instrucciones especiales..." rows={2} style={{ ...sI, resize: "none" }} /></div>
      <div style={{ display: "flex", gap: 8, marginTop: 18, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={{ padding: "9px 18px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.45)", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>Cancelar</button>
        <button onClick={submit} disabled={!ok || saving} style={{ padding: "9px 22px", borderRadius: 9, border: "none", background: ok ? "#3b82f6" : "rgba(255,255,255,0.05)", color: ok ? "#fff" : "rgba(255,255,255,0.2)", cursor: ok ? "pointer" : "not-allowed", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>{saving ? "Guardando..." : "Programar Inspección"}</button>
      </div>
    </div>
  );
};

// ─── Admin Table ──────────────────────────────────────────────────────────────

const AdminTable = ({ tasks }) => (
  <div style={{ overflowX: "auto" }}>
    <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 3px", fontSize: 12 }}>
      <thead><tr style={{ color: "rgba(255,255,255,0.3)", textTransform: "uppercase", fontSize: 9, letterSpacing: 1 }}>
        {["Fecha", "Empresa / Planta", "Tipo", "Inspector", "Estado", "Rec."].map(h => <th key={h} style={{ textAlign: "left", padding: "7px 10px", fontWeight: 600 }}>{h}</th>)}
      </tr></thead>
      <tbody>{tasks.map(t => {
        const ov = new Date(t.scheduledDate) < today && t.status === "programada";
        return (
          <tr key={t.id} style={{ background: "rgba(255,255,255,0.02)" }}>
            <td style={{ padding: 10, borderRadius: "8px 0 0 8px", color: ov ? "#f87171" : "#fff", fontWeight: 600, whiteSpace: "nowrap" }}>
              {new Date(t.scheduledDate + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
              {ov && <span style={{ display: "block", fontSize: 8, color: "#f87171" }}>⚠ vencida</span>}
            </td>
            <td style={{ padding: 10 }}>
              <div style={{ color: "#fff", fontWeight: 600, fontSize: 12 }}>{t.companyName}</div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, marginTop: 1 }}>📍 {t.plantName} — {t.plantCity}</div>
            </td>
            <td style={{ padding: 10, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{INSPECTION_TYPES.find(x => x.id === t.type)?.icon} {t.typeName}</td>
            <td style={{ padding: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(99,102,241,0.2)", color: "#818cf8", fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {INSPECTORS.find(i => i.id === t.inspectorId)?.avatar}
                </span>
                <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>{t.inspectorName}</span>
              </div>
            </td>
            <td style={{ padding: 10 }}><StatusBadge status={ov ? "vencida" : t.status} /></td>
            <td style={{ padding: 10, borderRadius: "0 8px 8px 0", color: "rgba(255,255,255,0.35)", fontSize: 10 }}>{RECURRENCE_OPTIONS.find(r => r.value === t.recurrence)?.label}</td>
          </tr>
        );
      })}</tbody>
    </table>
  </div>
);

// ─── Main: GestorInspecciones (Admin view) ───────────────────────────────────

export default function GestorInspecciones() {
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState(null);

  const handleSchedule = (t) => {
    setTasks(p => [...p, t]);
    setShowForm(false);
    setToast(`Inspección programada — ${t.inspectorName}`);
  };

  const vencidas = tasks.filter(t => new Date(t.scheduledDate) < today && t.status === "programada").length;

  return (
    <div style={{ fontFamily: "inherit", color: "#fff", minHeight: "100%" }}>
      <style>{`
        @keyframes toastIn { from { transform: translateX(60px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
        select option { background: #0f172a; color: #fff; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); }
      `}</style>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Gestor de Inspecciones</h2>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
            {tasks.length} tareas programadas · {vencidas > 0 ? <span style={{ color: "#f87171" }}>{vencidas} vencidas</span> : "ninguna vencida"}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: showForm ? "rgba(239,68,68,0.12)" : "#3b82f6", color: showForm ? "#f87171" : "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}
        >
          {showForm ? "✕ Cerrar" : "+ Programar Inspección"}
        </button>
      </div>

      {showForm && (
        <div style={{ marginBottom: 28 }}>
          <ScheduleForm onSchedule={handleSchedule} onCancel={() => setShowForm(false)} />
        </div>
      )}

      <AdminTable tasks={tasks} />
    </div>
  );
}
