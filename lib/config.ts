export const ENSI_BRAND = {
    tenantName:    'ENSI S.E.',
    productName:   'ENSI SafetyField',
    tagline:       'Inspecciones de campo digitalizadas · Sector O&G · Neuquén',
    company:       'Empresa Neuquina de Servicios de Ingeniería S.E.',
    address:       'Ruta 237 – Km. 1278, Arroyito, Neuquén, Argentina',
    phone:         '+54 299-5805554',
    email:         'comercial@ensi.com.ar',
    website:       'ensi.com.ar',
    poweredBy:     'Powered by SafetyVision AI · Nodo8',

    primaryColor:  '#003A70',
    accentColor:   '#005FA3',
    bgLight:       '#E8F1F9',

    aiContext: `Eres el asistente de inspecciones de ENSI S.E., empresa
especializada en servicios de ingeniería para la industria petrolera y
gasífera de Neuquén. Las inspecciones se realizan en yacimientos,
plantas y pozos de Vaca Muerta y otras zonas de la Patagonia.
Los riesgos más frecuentes en este contexto son:
- Trabajo en altura sin arnés (perforaciones, equipos)
- Ausencia de EPP específico O&G (casco, antiparras, guantes resistentes)
- Exposición a gases (H2S, CH4, SO2) — requiere detector personal
- Herramientas o equipos sin bloqueo LOTO
- Vehículos en movimiento sin señalización
- Condiciones eléctricas inseguras en instalaciones de campo
Clasificar siempre según Ley 19.587 / Decreto 351/79 y resoluciones SRT.`,
} as const;

// Activar branding ENSI: VITE_TENANT=ensi en .env.local (client-side)
export const IS_ENSI = import.meta.env.VITE_TENANT === 'ensi';
