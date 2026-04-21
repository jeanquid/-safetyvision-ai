import { useState, useEffect } from "react";

// ─── Mock Data ───────────────────────────────────────────────────────────────

const COMPANIES = [
  { id: "c1", name: "Metalúrgica San Martín", rut: "30-71234567-8", plants: [
    { name: "Planta Norte", address: "Av. Industrial 2200", city: "Pacheco", lat: -34.45, lng: -58.63, sectors: ["Soldadura", "Corte", "Depósito"] },
    { name: "Planta Sur", address: "Ruta 4 Km 12.5", city: "Avellaneda", lat: -34.66, lng: -58.36, sectors: ["Fundición", "Mecanizado", "Logística"] },
  ]},
  { id: "c2", name: "Constructora Vial del Litoral", rut: "33-98765432-1", plants: [
    { name: "Obrador Central", address: "Camino Viejo s/n", city: "Rosario", lat: -32.94, lng: -60.65, sectors: ["Obras civiles", "Equipos pesados"] },
    { name: "Base Operativa Norte", address: "RP 11 Km 340", city: "Reconquista", lat: -29.15, lng: -59.65, sectors: ["Mantenimiento", "Acopio"] },
  ]},
  { id: "c3", name: "Alimentos del Sur S.A.", rut: "30-55667788-3", plants: [
    { name: "Planta Procesadora", address: "Parque Industrial Mz 8 Lt 3", city: "Bahía Blanca", lat: -38.72, lng: -62.27, sectors: ["Línea 1 - Lácteos", "Línea 2 - Cárnicos", "Cámara frigorífica", "Expedición"] },
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
  { id: "t3", companyId: "c3", companyName: "Alimentos del Sur S.A.", plantName: "Planta Procesadora", plantAddress: "Parque Industrial Mz 8 Lt 3", plantCity: "Bahía Blanca", sector: "Cámara frigorífica", inspectorId: "u2", inspectorName: "Laura Vignatti", type: "condiciones", typeName: "Condiciones del Lugar", scheduledDate: fmt(addDays(today, 7)), status: "programada", recurrence: "quarterly", createdAt: fmt(addDays(today, -3)), notes: "Revisar temperatura y puertas herméticas.", rescheduleHistory: [] },
  { id: "t4", companyId: "c1", companyName: "Metalúrgica San Martín", plantName: "Planta Sur", plantAddress: "Ruta 4 Km 12.5", plantCity: "Avellaneda", sector: "Fundición", inspectorId: "u2", inspectorName: "Laura Vignatti", type: "incendio", typeName: "Protección Incendio", scheduledDate: fmt(addDays(today, -10)), status: "realizada", recurrence: "biannual", createdAt: fmt(addDays(today, -20)), linkedInspectionId: "insp-8827", completedAt: fmt(addDays(today, -10)), notes: "Verificar extintores y señalización.", rescheduleHistory: [] },
  { id: "t5", companyId: "c2", companyName: "Constructora Vial del Litoral", plantName: "Base Operativa Norte", plantAddress: "RP 11 Km 340", plantCity: "Reconquista", sector: "Mantenimiento", inspectorId: "u1", inspectorName: "Carlos Méndez", type: "electrico", typeName: "Riesgo Eléctrico", scheduledDate: fmt(addDays(today, 1)), status: "programada", recurrence: "none", createdAt: fmt(addDays(today, -7)), notes: "Tableros eléctricos en mal estado.", rescheduleHistory: [] },
  { id: "t6", companyId: "c3", companyName: "Alimentos del Sur S.A.", plantName: "Planta Procesadora", plantAddress: "Parque Industrial Mz 8 Lt 3", plantCity: "Bahía Blanca", sector: "Línea 1 - Lácteos", inspectorId: "u3", inspectorName: "Martín Suárez", type: "ergonomia", typeName: "Ergonomía", scheduledDate: fmt(addDays(today, -5)), status: "reprogramada", recurrence: "none", createdAt: fmt(addDays(today, -12)), notes: "", rescheduleHistory: [{ from: fmt(addDays(today, -5)), to: fmt(addDays(today, 5)), reason: "Inspector con licencia médica", by: "Martín Suárez", at: fmt(addDays(today, -5)) }] },
];

// ─── SVG Icons ──────────────────────────────────────────────────────────────

const I = {
  users: (c) => <svg width="18" height="18" fill="none" stroke={c||"currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  calendar: (c) => <svg width="18" height="18" fill="none" stroke={c||"currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  building: (c) => <svg width="18" height="18" fill="none" stroke={c||"currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M6 22V4a2 2 0 012-2h8a2 2 0 012 2v18z"/><path d="M6 12H4a2 2 0 00-2 2v6a2 2 0 002 2h2"/><path d="M18 9h2a2 2 0 012 2v9a2 2 0 01-2 2h-2"/><path d="M10 6h4M10 10h4M10 14h4M10 18h4"/></svg>,
  camera: (c) => <svg width="18" height="18" fill="none" stroke={c||"currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  logout: (c) => <svg width="18" height="18" fill="none" stroke={c||"currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  menu: () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  x: () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
};

// ─── Shared Components ──────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const m = { programada: { bg: "#3b82f620", c: "#60a5fa", l: "Programada", d: "#3b82f6" }, vencida: { bg: "#ef444420", c: "#f87171", l: "Vencida", d: "#ef4444" }, realizada: { bg: "#10b98120", c: "#34d399", l: "Realizada", d: "#10b981" }, reprogramada: { bg: "#f59e0b20", c: "#fbbf24", l: "Reprogramada", d: "#f59e0b" } };
  const s = m[status] || m.programada;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 99, background: s.bg, color: s.c, fontSize: 11, fontWeight: 600 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: s.d }}/>{s.l}</span>;
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
  return <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, background: "rgba(16,185,129,0.14)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 11, padding: "10px 16px", color: "#34d399", fontSize: 12, fontWeight: 600, backdropFilter: "blur(10px)", animation: "toastIn .3s ease" }}>✅ {message}</div>;
};

// ─── Admin: Schedule Form ───────────────────────────────────────────────────

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
      onSchedule({ id: "t" + Date.now(), companyId: company, companyName: co.name, plantName: plant, plantAddress: pl?.address||"", plantCity: pl?.city||"", sector: sector||pl?.sectors[0]||"", inspectorId: inspector, inspectorName: INSPECTORS.find(i => i.id === inspector)?.name||"", type, typeName: tp?.label||"", scheduledDate: date, status: "programada", recurrence, createdAt: fmt(today), notes, rescheduleHistory: [] });
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
        <div style={{ marginTop: 10, padding: "10px 12px", background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.12)", borderRadius: 10, display: "flex", gap: 8 }}>
          <span style={{ fontSize: 14 }}>📍</span>
          <div>
            <div style={{ fontSize: 12, color: "#93c5fd", fontWeight: 600 }}>{pl.address}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>{pl.city}</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 5 }}>{pl.sectors.map(s => <span key={s} style={{ fontSize: 9, padding: "2px 7px", borderRadius: 5, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)" }}>{s}</span>)}</div>
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
        <button onClick={submit} disabled={!ok||saving} style={{ padding: "9px 22px", borderRadius: 9, border: "none", background: ok ? "#3b82f6" : "rgba(255,255,255,0.05)", color: ok ? "#fff" : "rgba(255,255,255,0.2)", cursor: ok ? "pointer" : "not-allowed", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>{saving ? "Guardando..." : "Programar Inspección"}</button>
      </div>
    </div>
  );
};

// ─── Admin Table ────────────────────────────────────────────────────────────

const AdminTable = ({ tasks }) => (
  <div style={{ overflowX: "auto" }}>
    <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 3px", fontSize: 12 }}>
      <thead><tr style={{ color: "rgba(255,255,255,0.3)", textTransform: "uppercase", fontSize: 9, letterSpacing: 1 }}>
        {["Fecha","Empresa / Planta","Tipo","Inspector","Estado","Rec."].map(h => <th key={h} style={{ textAlign: "left", padding: "7px 10px", fontWeight: 600 }}>{h}</th>)}
      </tr></thead>
      <tbody>{tasks.map(t => {
        const ov = new Date(t.scheduledDate) < today && t.status === "programada";
        return (
          <tr key={t.id} style={{ background: "rgba(255,255,255,0.02)" }}>
            <td style={{ padding: 10, borderRadius: "8px 0 0 8px", color: ov ? "#f87171" : "#fff", fontWeight: 600, whiteSpace: "nowrap" }}>{new Date(t.scheduledDate+"T12:00:00").toLocaleDateString("es-AR",{day:"2-digit",month:"short"})}{ov && <span style={{ display: "block", fontSize: 8, color: "#f87171" }}>⚠ vencida</span>}</td>
            <td style={{ padding: 10 }}><div style={{ color: "#fff", fontWeight: 600, fontSize: 12 }}>{t.companyName}</div><div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, marginTop: 1 }}>📍 {t.plantName} — {t.plantCity}</div></td>
            <td style={{ padding: 10, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{INSPECTION_TYPES.find(x => x.id === t.type)?.icon} {t.typeName}</td>
            <td style={{ padding: 10 }}><div style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(99,102,241,0.2)", color: "#818cf8", fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{INSPECTORS.find(i => i.id === t.inspectorId)?.avatar}</span><span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>{t.inspectorName}</span></div></td>
            <td style={{ padding: 10 }}><StatusBadge status={ov ? "vencida" : t.status} /></td>
            <td style={{ padding: 10, borderRadius: "0 8px 8px 0", color: "rgba(255,255,255,0.35)", fontSize: 10 }}>{RECURRENCE_OPTIONS.find(r => r.value === t.recurrence)?.label}</td>
          </tr>
        );
      })}</tbody>
    </table>
  </div>
);

// ─── Modals ─────────────────────────────────────────────────────────────────

const Overlay = ({ children }) => <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, backdropFilter: "blur(4px)" }}>{children}</div>;

const RescheduleModal = ({ task, onConfirm, onCancel }) => {
  const [nd, setNd] = useState(fmt(addDays(today, 7)));
  const [reason, setReason] = useState("");
  const ok = nd && reason.trim().length > 5;
  const sI = { width: "100%", padding: "9px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  return (
    <Overlay><div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 24, width: 400, maxWidth: "92vw" }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 14 }}>🔄 Reprogramar tarea</h3>
      <p style={{ margin: "0 0 16px", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{task.companyName} — {task.plantName}</p>
      <div style={{ marginBottom: 12 }}><label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: 5 }}>Nueva fecha</label><input type="date" value={nd} onChange={e => setNd(e.target.value)} style={sI} /></div>
      <div style={{ marginBottom: 16 }}><label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: 5 }}>Motivo (obligatorio)</label><textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Describí el motivo..." rows={3} style={{ ...sI, resize: "none" }} />{reason.length > 0 && reason.trim().length <= 5 && <p style={{ margin: "4px 0 0", fontSize: 10, color: "#f87171" }}>Mínimo 6 caracteres</p>}</div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={{ padding: "8px 16px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.45)", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>Cancelar</button>
        <button onClick={() => ok && onConfirm(nd, reason)} disabled={!ok} style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: ok ? "#f59e0b" : "rgba(255,255,255,0.05)", color: ok ? "#000" : "rgba(255,255,255,0.2)", cursor: ok ? "pointer" : "not-allowed", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>Reprogramar</button>
      </div>
    </div></Overlay>
  );
};

const ExecuteModal = ({ task, onComplete, onCancel }) => (
  <Overlay><div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 24, width: 440, maxWidth: "92vw" }}>
    <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>📷 Ejecutar Inspección</h3>
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
      <button onClick={onComplete} style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: "#10b981", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>✅ Simular Completada</button>
    </div>
  </div></Overlay>
);

// ─── Inspector Task Card ────────────────────────────────────────────────────

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
          <div><div style={{ fontSize: 13, fontWeight: 700 }}>{task.companyName}</div><div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{task.typeName}</div></div>
        </div>
        <StatusBadge status={es} />
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 10 }}>📍 {task.plantName} — {task.plantAddress}, {task.plantCity}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <span style={{ padding: "5px 8px", borderRadius: 7, background: "rgba(255,255,255,0.03)", fontSize: 10, color: "rgba(255,255,255,0.45)" }}>📅 {new Date(task.scheduledDate+"T12:00:00").toLocaleDateString("es-AR",{weekday:"short",day:"2-digit",month:"short"})}{es === "programada" && <span style={{ marginLeft: 5, color: days <= 2 ? "#fbbf24" : "#34d399", fontWeight: 600 }}>{days === 0 ? "· HOY" : days === 1 ? "· mañana" : `· en ${days}d`}</span>}</span>
        {task.sector && <span style={{ padding: "5px 8px", borderRadius: 7, background: "rgba(255,255,255,0.03)", fontSize: 10, color: "rgba(255,255,255,0.45)" }}>🏭 {task.sector}</span>}
        {task.recurrence !== "none" && <span style={{ padding: "5px 8px", borderRadius: 7, background: "rgba(139,92,246,0.1)", fontSize: 10, color: "#a78bfa" }}>🔁 {RECURRENCE_OPTIONS.find(r => r.value === task.recurrence)?.label}</span>}
      </div>
      {task.notes && <p style={{ margin: "0 0 12px", fontSize: 11, color: "rgba(255,255,255,0.3)", fontStyle: "italic", paddingLeft: 8, borderLeft: "2px solid rgba(255,255,255,0.07)" }}>{task.notes}</p>}
      {task.rescheduleHistory?.length > 0 && (
        <div style={{ marginBottom: 12, padding: "8px 10px", borderRadius: 8, background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.1)" }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: "#fbbf24", textTransform: "uppercase", marginBottom: 3 }}>Reprogramación</div>
          {task.rescheduleHistory.map((r, i) => <div key={i} style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{new Date(r.from+"T12:00:00").toLocaleDateString("es-AR")} → {new Date(r.to+"T12:00:00").toLocaleDateString("es-AR")} — <em>{r.reason}</em></div>)}
        </div>
      )}
      {es === "realizada" && task.linkedInspectionId && <div style={{ padding: "7px 10px", borderRadius: 8, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.12)", fontSize: 11, color: "#34d399" }}>✅ Inspección <strong>#{task.linkedInspectionId}</strong> — {new Date(task.completedAt+"T12:00:00").toLocaleDateString("es-AR")}</div>}
      {(es === "programada" || es === "vencida") && (
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button onClick={() => onExecute(task)} style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "none", background: "#3b82f6", color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit" }}>📷 Ejecutar Inspección</button>
          <button onClick={() => onReschedule(task)} style={{ padding: "9px 14px", borderRadius: 9, border: "1px solid rgba(245,158,11,0.25)", background: "rgba(245,158,11,0.07)", color: "#fbbf24", cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit" }}>🔄 Reprogramar</button>
        </div>
      )}
    </div>
  );
};

// ─── Placeholder Views ──────────────────────────────────────────────────────

const PlaceholderView = ({ icon, title, subtitle }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 400, color: "rgba(255,255,255,0.15)" }}>
    <span style={{ fontSize: 48, marginBottom: 12 }}>{icon}</span>
    <div style={{ fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.3)" }}>{title}</div>
    <div style={{ fontSize: 12, marginTop: 4 }}>{subtitle}</div>
  </div>
);

// ─── Main App ───────────────────────────────────────────────────────────────

export default function SafetyVisionApp() {
  const [role, setRole] = useState("admin");
  const [view, setView] = useState("gestor");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [showForm, setShowForm] = useState(false);
  const [inspectorUser, setInspectorUser] = useState("u1");
  const [statusFilter, setStatusFilter] = useState("all");
  const [rescheduleTask, setRescheduleTask] = useState(null);
  const [executingTask, setExecutingTask] = useState(null);
  const [toast, setToast] = useState(null);

  const switchRole = (r) => { setRole(r); setView(r === "admin" ? "gestor" : "programadas"); setShowForm(false); };

  // Nav definitions per role
  const adminNav = [
    { key: "admin-panel", icon: () => I.users(), label: "Administración", color: "#a78bfa" },
    { key: "gestor", icon: () => I.calendar(), label: "Gestor de Inspecciones", color: "#f472b6" },
  ];
  const inspectorNav = [
    { key: "mis-empresas", icon: () => I.building(), label: "Mis Empresas", color: "#60a5fa" },
    { key: "nueva-inspeccion", icon: () => I.camera(), label: "Nueva Inspección", color: "#34d399" },
    { key: "programadas", icon: () => I.calendar(), label: "Inspecciones Programadas", color: "#f472b6" },
  ];
  const nav = role === "admin" ? adminNav : inspectorNav;

  // Inspector tasks
  const myTasks = tasks.filter(t => t.inspectorId === inspectorUser).map(t => ({ ...t, _es: new Date(t.scheduledDate) < today && t.status === "programada" ? "vencida" : t.status })).sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));
  const filtered = statusFilter === "all" ? myTasks : myTasks.filter(t => t._es === statusFilter);
  const cn = { all: myTasks.length, programada: myTasks.filter(t => t._es === "programada").length, vencida: myTasks.filter(t => t._es === "vencida").length, realizada: myTasks.filter(t => t._es === "realizada").length, reprogramada: myTasks.filter(t => t._es === "reprogramada").length };

  const handleSchedule = (t) => { setTasks(p => [...p, t]); setShowForm(false); setToast(`Inspección programada — ${t.inspectorName}`); };
  const handleReschedule = (d, r) => {
    setTasks(p => p.map(t => t.id !== rescheduleTask.id ? t : { ...t, status: "reprogramada", rescheduleHistory: [...(t.rescheduleHistory||[]), { from: t.scheduledDate, to: d, reason: r, by: INSPECTORS.find(i => i.id === t.inspectorId)?.name||"", at: fmt(today) }] }).concat([{ ...rescheduleTask, id: "t"+Date.now(), scheduledDate: d, status: "programada", rescheduleHistory: [...(rescheduleTask.rescheduleHistory||[]), { from: rescheduleTask.scheduledDate, to: d, reason: r, by: INSPECTORS.find(i => i.id === rescheduleTask.inspectorId)?.name||"", at: fmt(today) }] }]));
    setRescheduleTask(null); setToast(`Reprogramada al ${new Date(d+"T12:00:00").toLocaleDateString("es-AR")}`);
  };
  const handleComplete = () => {
    const iid = "insp-"+Math.random().toString(36).substring(2,6);
    setTasks(p => p.map(t => t.id === executingTask.id ? { ...t, status: "realizada", linkedInspectionId: iid, completedAt: fmt(today) } : t));
    setExecutingTask(null); setToast(`Inspección #${iid} completada`);
  };

  const curInsp = INSPECTORS.find(i => i.id === inspectorUser);

  // Title mapping
  const titles = { "admin-panel": "Administración", "gestor": "Gestor de Inspecciones", "mis-empresas": "Mis Empresas", "nueva-inspeccion": "Nueva Inspección", "programadas": "Inspecciones Programadas" };

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: "#020617", color: "#fff", height: "100vh", display: "flex", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes toastIn { from { transform: translateX(60px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
        * { box-sizing: border-box; margin: 0; }
        select option { background: #0f172a; color: #fff; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 10px; }
      `}</style>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      {rescheduleTask && <RescheduleModal task={rescheduleTask} onConfirm={handleReschedule} onCancel={() => setRescheduleTask(null)} />}
      {executingTask && <ExecuteModal task={executingTask} onComplete={handleComplete} onCancel={() => setExecutingTask(null)} />}

      {/* ═══ SIDEBAR ═══════════════════════════════════════════════════════ */}
      <aside style={{ width: sidebarOpen ? 240 : 0, height: "100vh", background: "#0f172a", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", overflow: "hidden", transition: "width 0.25s ease", flexShrink: 0 }}>

        {/* Logo HSE */}
        <div style={{ padding: "18px 16px 12px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #16a34a, #22c55e)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ color: "#fff", fontWeight: 900, fontSize: 10, letterSpacing: -0.5 }}>hse</span>
          </div>
          <div style={{ overflow: "hidden" }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: "#fff", letterSpacing: 0.3, whiteSpace: "nowrap" }}>HSE INGENIERÍA</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", whiteSpace: "nowrap" }}>SafetyVision AI · Nodo8</div>
          </div>
        </div>

        {/* Role switch (demo) */}
        <div style={{ margin: "0 12px 14px", padding: 3, background: "rgba(255,255,255,0.03)", borderRadius: 8, display: "flex", border: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => switchRole("admin")} style={{ flex: 1, padding: "6px 0", borderRadius: 6, border: "none", background: role === "admin" ? "rgba(99,102,241,0.2)" : "transparent", color: role === "admin" ? "#a5b4fc" : "rgba(255,255,255,0.25)", cursor: "pointer", fontSize: 10, fontWeight: 600, fontFamily: "inherit" }}>Admin</button>
          <button onClick={() => switchRole("inspector")} style={{ flex: 1, padding: "6px 0", borderRadius: 6, border: "none", background: role === "inspector" ? "rgba(99,102,241,0.2)" : "transparent", color: role === "inspector" ? "#a5b4fc" : "rgba(255,255,255,0.25)", cursor: "pointer", fontSize: 10, fontWeight: 600, fontFamily: "inherit" }}>Inspector</button>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: "0 10px", display: "flex", flexDirection: "column", gap: 2 }}>
          {nav.map(item => {
            const active = view === item.key;
            return (
              <button key={item.key} onClick={() => setView(item.key)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderRadius: 10, border: "none", background: active ? "rgba(255,255,255,0.06)" : "transparent", cursor: "pointer", width: "100%", transition: "all 0.15s" }}>
                <span style={{ color: active ? item.color : "rgba(255,255,255,0.35)", flexShrink: 0 }}>{item.icon()}</span>
                <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? "#fff" : "rgba(255,255,255,0.45)", textAlign: "left", whiteSpace: "nowrap" }}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User footer */}
        <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#818cf8", flexShrink: 0 }}>{role === "admin" ? "AD" : curInsp?.avatar}</div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{role === "admin" ? "Administrador" : curInsp?.name}</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{role === "admin" ? "admin@hse-ingenieria.com" : curInsp?.email}</div>
          </div>
          <span style={{ color: "rgba(255,255,255,0.15)", cursor: "pointer", flexShrink: 0 }}>{I.logout()}</span>
        </div>
      </aside>

      {/* ═══ MAIN ══════════════════════════════════════════════════════════ */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>

        {/* Top bar */}
        <div style={{ padding: "12px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", cursor: "pointer", padding: 2 }}>{sidebarOpen ? I.x() : I.menu()}</button>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{titles[view] || view}</span>
          <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 5, background: "rgba(244,114,182,0.1)", color: "#f472b6", fontWeight: 600, marginLeft: "auto" }}>DEMO</span>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>

          {/* ── ADMIN: Administración placeholder ── */}
          {view === "admin-panel" && <PlaceholderView icon="⚙️" title="Panel de Administración" subtitle="Gestión de usuarios, roles y configuración del tenant" />}

          {/* ── ADMIN: Gestor de Inspecciones ── */}
          {view === "gestor" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Inspecciones Programadas</h2>
                  <p style={{ margin: "3px 0 0", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{tasks.length} tareas · {tasks.filter(t => new Date(t.scheduledDate) < today && t.status === "programada").length} vencidas</p>
                </div>
                <button onClick={() => setShowForm(!showForm)} style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: showForm ? "rgba(239,68,68,0.12)" : "#3b82f6", color: showForm ? "#f87171" : "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>{showForm ? "✕ Cerrar" : "+ Programar Inspección"}</button>
              </div>
              {showForm && <div style={{ marginBottom: 24 }}><ScheduleForm onSchedule={handleSchedule} onCancel={() => setShowForm(false)} /></div>}
              <AdminTable tasks={tasks} />
            </>
          )}

          {/* ── INSPECTOR: Mis Empresas placeholder ── */}
          {view === "mis-empresas" && <PlaceholderView icon="🏢" title="Mis Empresas" subtitle="Empresas asignadas al inspector — vista existente de SafetyVision" />}

          {/* ── INSPECTOR: Nueva Inspección placeholder ── */}
          {view === "nueva-inspeccion" && <PlaceholderView icon="📷" title="Nueva Inspección" subtitle="Flujo de captura de foto + análisis IA — vista existente de SafetyVision" />}

          {/* ── INSPECTOR: Inspecciones Programadas ── */}
          {view === "programadas" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Mis Tareas</h2>
                <div style={{ display: "flex", gap: 5 }}>
                  {INSPECTORS.map(i => (
                    <button key={i.id} onClick={() => { setInspectorUser(i.id); setStatusFilter("all"); }} style={{ width: 30, height: 30, borderRadius: "50%", border: inspectorUser === i.id ? "2px solid #3b82f6" : "1px solid rgba(255,255,255,0.08)", background: inspectorUser === i.id ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.02)", color: inspectorUser === i.id ? "#93c5fd" : "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 9, fontWeight: 700, fontFamily: "inherit" }}>{i.avatar}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                <CountCard label="Total" value={cn.all} color="#fff" icon="📋" active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
                <CountCard label="Próximas" value={cn.programada} color="#60a5fa" icon="📅" active={statusFilter === "programada"} onClick={() => setStatusFilter("programada")} />
                <CountCard label="Vencidas" value={cn.vencida} color="#f87171" icon="⚠️" active={statusFilter === "vencida"} onClick={() => setStatusFilter("vencida")} />
                <CountCard label="Realizadas" value={cn.realizada} color="#34d399" icon="✅" active={statusFilter === "realizada"} onClick={() => setStatusFilter("realizada")} />
                <CountCard label="Reprog." value={cn.reprogramada} color="#fbbf24" icon="🔄" active={statusFilter === "reprogramada"} onClick={() => setStatusFilter("reprogramada")} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filtered.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.2)" }}><div style={{ fontSize: 28, marginBottom: 6 }}>📭</div><div style={{ fontSize: 12 }}>No hay tareas{statusFilter !== "all" && ` "${statusFilter}"`}</div></div>
                ) : filtered.map(t => <TaskCard key={t.id} task={t} onExecute={setExecutingTask} onReschedule={setRescheduleTask} />)}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
