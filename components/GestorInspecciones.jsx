import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";

// ─── Recurrencias ─────────────────────────────────────────────────────────────

const RECURRENCE_OPTIONS = [
  { value: "none",      label: "Sin recurrencia" },
  { value: "monthly",   label: "Mensual"          },
  { value: "quarterly", label: "Trimestral"       },
  { value: "biannual",  label: "Semestral"        },
  { value: "annual",    label: "Anual"            },
];

const today = new Date();
const fmt = (d) => d.toISOString().split("T")[0];
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

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

const Toast = ({ message, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);
  return (
    <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, background: "rgba(16,185,129,0.14)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 11, padding: "10px 16px", color: "#34d399", fontSize: 12, fontWeight: 600, backdropFilter: "blur(10px)", animation: "toastIn .3s ease" }}>
      {message}
    </div>
  );
};

// ─── ScheduleForm ─────────────────────────────────────────────────────────────

const ScheduleForm = ({ companies, inspectors, onSchedule, onCancel }) => {
  const [companyId, setCompanyId]   = useState("");
  const [inspectorId, setInspectorId] = useState("");
  const [date, setDate]             = useState(fmt(addDays(today, 7)));
  const [recurrence, setRecurrence] = useState("none");
  const [notes, setNotes]           = useState("");
  const [saving, setSaving]         = useState(false);

  const co  = companies.find(c => c.companyId === companyId);
  const ok  = companyId && inspectorId && date;

  const submit = () => {
    if (!ok) return;
    setSaving(true);
    setTimeout(() => {
      const insp = inspectors.find(i => i.id === inspectorId);
      onSchedule({
        id: "t" + Date.now(),
        companyId,
        companyName: co.name,
        inspectorId,
        inspectorName: insp?.display_name || insp?.email || "",
        scheduledDate: date,
        status: "programada",
        recurrence,
        createdAt: fmt(today),
        notes,
        rescheduleHistory: [],
      });
      setSaving(false);
    }, 400);
  };

  const sI = { width: "100%", padding: "9px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  const sL = { display: "block", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 };

  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Programar Inspección</h3>
        <p style={{ margin: "3px 0 0", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Asigná inspector, empresa y fecha</p>
      </div>

      {/* Empresa + Inspector */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          <label style={sL}>Empresa</label>
          <select value={companyId} onChange={e => setCompanyId(e.target.value)} style={sI}>
            <option value="">Seleccionar...</option>
            {companies.map(c => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label style={sL}>Inspector</label>
          <select value={inspectorId} onChange={e => setInspectorId(e.target.value)} style={sI}>
            <option value="">Seleccionar...</option>
            {inspectors.map(i => <option key={i.id} value={i.id}>{i.display_name || i.email}</option>)}
          </select>
        </div>
      </div>

      {/* Fecha + Recurrencia */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
        <div>
          <label style={sL}>Fecha</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={sI} />
        </div>
        <div>
          <label style={sL}>Recurrencia</label>
          <select value={recurrence} onChange={e => setRecurrence(e.target.value)} style={sI}>
            {RECURRENCE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
      </div>

      {/* Notas */}
      <div style={{ marginTop: 14 }}>
        <label style={sL}>Notas</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Instrucciones especiales..." rows={2} style={{ ...sI, resize: "none" }} />
      </div>

      {/* Acciones */}
      <div style={{ display: "flex", gap: 8, marginTop: 18, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={{ padding: "9px 18px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.45)", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
          Cancelar
        </button>
        <button onClick={submit} disabled={!ok || saving} style={{ padding: "9px 22px", borderRadius: 9, border: "none", background: ok ? "#3b82f6" : "rgba(255,255,255,0.05)", color: ok ? "#fff" : "rgba(255,255,255,0.2)", cursor: ok ? "pointer" : "not-allowed", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
          {saving ? "Guardando..." : "Programar"}
        </button>
      </div>
    </div>
  );
};

// ─── Admin Table ──────────────────────────────────────────────────────────────

const AdminTable = ({ tasks }) => (
  <div style={{ overflowX: "auto" }}>
    <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 3px", fontSize: 12 }}>
      <thead>
        <tr style={{ color: "rgba(255,255,255,0.3)", textTransform: "uppercase", fontSize: 9, letterSpacing: 1 }}>
          {["Fecha", "Empresa", "Inspector", "Estado", "Recurrencia"].map(h =>
            <th key={h} style={{ textAlign: "left", padding: "7px 10px", fontWeight: 600 }}>{h}</th>
          )}
        </tr>
      </thead>
      <tbody>
        {tasks.map(t => {
          const ov = new Date(t.scheduledDate) < today && t.status === "programada";
          return (
            <tr key={t.id} style={{ background: "rgba(255,255,255,0.02)" }}>
              <td style={{ padding: 10, borderRadius: "8px 0 0 8px", color: ov ? "#f87171" : "#fff", fontWeight: 600, whiteSpace: "nowrap" }}>
                {new Date(t.scheduledDate + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
                {ov && <span style={{ display: "block", fontSize: 8, color: "#f87171" }}>vencida</span>}
              </td>
              <td style={{ padding: 10 }}>
                <div style={{ color: "#fff", fontWeight: 600, fontSize: 12 }}>{t.companyName}</div>
              </td>
              <td style={{ padding: 10 }}>
                <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>{t.inspectorName}</span>
              </td>
              <td style={{ padding: 10 }}>
                <StatusBadge status={ov ? "vencida" : t.status} />
              </td>
              <td style={{ padding: 10, borderRadius: "0 8px 8px 0", color: "rgba(255,255,255,0.35)", fontSize: 10 }}>
                {RECURRENCE_OPTIONS.find(r => r.value === t.recurrence)?.label}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
    {tasks.length === 0 && (
      <div style={{ textAlign: "center", padding: "48px 0", color: "rgba(255,255,255,0.2)" }}>
        <div style={{ fontSize: 13, marginBottom: 4, fontWeight: 600 }}>Sin inspecciones programadas</div>
        <div style={{ fontSize: 11 }}>Usá el botón para programar una nueva</div>
      </div>
    )}
  </div>
);

// ─── Main: GestorInspecciones ─────────────────────────────────────────────────

export default function GestorInspecciones() {
  const { authFetch } = useAuth();
  const [companies, setCompanies]   = useState([]);
  const [inspectors, setInspectors] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [tasks, setTasks]           = useState([]);
  const [showForm, setShowForm]     = useState(false);
  const [toast, setToast]           = useState(null);

  useEffect(() => {
    async function load() {
      setLoadingData(true);
      try {
        const [compRes, userRes] = await Promise.all([
          authFetch("/api/companies/list"),
          authFetch("/api/users"),
        ]);
        const compData = await compRes.json();
        const userData = await userRes.json();
        if (compData.ok) setCompanies(compData.companies || []);
        if (userData.ok) setInspectors((userData.users || []).filter(u => u.role === "inspector"));
      } catch (e) {
        console.error("GestorInspecciones load error:", e);
      }
      setLoadingData(false);
    }
    load();
  }, []);

  const vencidas = tasks.filter(t => new Date(t.scheduledDate) < today && t.status === "programada").length;

  const handleSchedule = (t) => {
    setTasks(p => [...p, t]);
    setShowForm(false);
    setToast(`Inspección programada — ${t.inspectorName}`);
  };

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
            {tasks.length} tareas programadas
            {vencidas > 0 && <span style={{ color: "#f87171", marginLeft: 6 }}>· {vencidas} vencidas</span>}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          disabled={loadingData}
          style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: showForm ? "rgba(239,68,68,0.12)" : "#3b82f6", color: showForm ? "#f87171" : "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit", opacity: loadingData ? 0.5 : 1 }}
        >
          {showForm ? "✕ Cerrar" : "+ Programar Inspección"}
        </button>
      </div>

      {loadingData && (
        <div style={{ textAlign: "center", padding: "20px 0", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
          Cargando...
        </div>
      )}

      {showForm && !loadingData && (
        <div style={{ marginBottom: 28 }}>
          <ScheduleForm
            companies={companies}
            inspectors={inspectors}
            onSchedule={handleSchedule}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      <AdminTable tasks={tasks} />
    </div>
  );
}
