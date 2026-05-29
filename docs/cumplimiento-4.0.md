# Cumplimiento Técnico - Ecosistema Prevención 4.0 (Res. SRT 48/2025)
## SafetyField · Tenant ENSI S.E.

Este documento detalla la arquitectura y el mapeo técnico del sistema **SafetyField** para cumplir con las exigencias del **Ecosistema Prevención 4.0** de la República Argentina (Resolución SRT 48/2025 y Disposición SRT 15/2026).

---

## 1. Mapeo de Pautas Técnicas (Anexo Res. SRT 48/2025)

### Pauta 4.2: Cadena de Custodia Digital y Sello Íntegro (SHA-256)
*   **Implementación**: La plataforma implementa un registro de auditoría encadenado (hash chain) representado por la estructura `AuditEntry`. Cada intervención o cambio sobre la inspección genera una firma criptográfica única.
*   **Versionamiento de Sellos**:
    *   **Versión 1 (Legacy)**: Sello truncado a 16 caracteres hexadecimales para retrocompatibilidad con inspecciones preexistentes.
    *   **Versión 2 (Nueva)**: Sello completo de 64 caracteres hex generado mediante SHA-256. Firma un payload enriquecido: `inspectorId | action | riskId | fromStatus | toStatus | note | timestamp | photoHash | previousSeal`.
*   **Verificación**: La función `verifyAuditChain` analiza secuencialmente el histórico de firmas y el hash de la evidencia física. Si se detecta alguna discrepancia o reordenamiento de los registros, la validación falla indicando el índice exacto de la alteración (`brokenAt`).

### Pauta 4.3 y 4.7: Integridad Criptográfica de Evidencia (Fotos)
*   **Implementación**: Al registrar una inspección en campo, la imagen capturada se procesa en `savePhoto` calculando su hash SHA-256 y guardándolo en la columna `photo_hash` de la base de datos.
*   **Validación de Evidencia**: El hash de la foto se incorpora en la firma de creación (`photoHash`). Si el archivo de imagen en base de datos es modificado o sustituido, la verificación criptográfica del acta laboral falla de forma automática.
*   **Retrocompatibilidad Legacy**: Para fotos antiguas capturadas antes del esquema criptográfico (sin hash registrado), el sistema las cataloga de manera controlada como *"Evidencia legacy no verificable"* en lugar de reportarlas como alteradas, preservando la validez del acta.

### Pauta 4.4 y 4.8: Control de Acceso y Bitácora de Auditoría
*   **Aislamiento y Seguridad**: Se añade la tabla `audit_access_logs` con la columna obligatoria `tenant_id TEXT NOT NULL`. Cualquier acceso o consulta a los registros de trazabilidad y exportación portable se filtra estrictamente por el `tenant_id` del usuario autenticado, impidiendo fugas de información entre organizaciones.
*   **Registro Automatizado**: Cada acceso al endpoint de verificación interna, exportación estructurada y el escaneo del código QR público registra una entrada inmutable en la bitácora (`action_performed`, `user_id`, `email`, `role`, `tenant_id` y `timestamp`).

### Pauta 4.5: Código QR de Verificación Pública
*   **Implementación**: El PDF generado para actas cerradas estampa un código QR vectorial nativo (usando la librería compacta `qrcodegen` sin llamadas externas a red) que apunta a la URL pública de verificación:
    `https://${host}/verify/${publicId}`
*   **Privacidad**: El identificador público (`public_id`) es criptográficamente aleatorio e imposible de enumerar (generado con 16 bytes aleatorios de `crypto.randomBytes`).
*   **Filtro de Datos Sensibles**: El endpoint público `GET /api/verify/:publicId` no expone datos sensibles, nombres de trabajadores, riesgos específicos ni fotos. Únicamente devuelve el estado de integridad de la cadena (`valid`, `legacy` o `altered`), la fecha de emisión, el identificador público y el nombre comercial del tenant (vanguardia de privacidad de datos).
*   **Detección Dual por Accept Header**:
    *   Si un cliente solicita **JSON** (API / lectura mecánica): Devuelve la carga útil mínima estructurada.
    *   Si solicita **HTML** (escaneo de navegador móvil): Renderiza una interfaz web premium optimizada para teléfonos móviles con estilo esmerilado (glassmorphism) y branding institucional de ENSI S.E.

### Pauta 4.9: Autocontrol y Alertas Tempranas
*   **Validación de Inconsistencias**: En `runAutocontrol`, al cerrarse una inspección, el motor evalúa:
    1.  Tareas resueltas sin responsable o sin descripción de la acción correctiva.
    2.  Riesgos altos detectados por la IA que carecen de recomendación de acción.
    3.  Presencia de imágenes legacy sin firmar criptográficamente.
*   **Alertas**: Si hay inconsistencias, el estado de cumplimiento se define como `'con_observaciones'`. Bajo el tenant **ENSI**, esto dispara una notificación asíncrona hacia el canal de automatización en n8n para alertar a los administradores y coordinadores de seguridad.

### Pauta 4.10: Exportación Portable de Lectura Mecánica
*   **Formatos**: Los endpoints de exportación (`GET /api/inspections/:id/export` y `GET /api/companies/:companyId/export`) permiten descargar la información completa y su cadena de custodia criptográfica en formatos estándar **JSON** y **CSV** estructurados, compatibles con herramientas externas de Business Intelligence (BI) y auditorías laborales.

---

## 2. Anclaje Externo Futuro (Integridad ante Terceros)

Actualmente, la integridad del sistema reside en el encadenamiento de firmas internas. Para escalar a una **integridad legal absoluta demostrable ante terceros**, se ha dejado marcado en el almacén de base de datos (`api/_store.ts` en la línea del cierre de inspección) el punto exacto de conexión para un anclaje externo de confianza:

```typescript
/*
 * FUTURE ANCHORING POINT (Anclaje Externo Futuro):
 * Aquí es donde la inspección ha quedado completamente resuelta/cerrada y su cadena de custodia está completa.
 * En este punto exacto se debería calcular el closing_hash de la inspección y enviarlo a:
 * 1. Una Autoridad de Sellado de Tiempo (TSA conforme a RFC 3161) para obtener un timestamp provisto por un tercero de confianza.
 * 2. O anclar el hash en una blockchain (ej. Ethereum, Bitcoin o una red regulada local de AR) publicando una transacción inmutable.
 * Esto permitiría pasar de integridad propia (cadena interna de hashes) a integridad demostrable e inalterable ante terceros.
 */
```

---

## 3. Gobernanza Organizativa (Tareas Pendientes de la Administración)

Para consolidar la legalidad del Ecosistema de Prevención 4.0, la administración del Tenant ENSI S.E. debe implementar las siguientes medidas operativas:

1.  **Registro de Inspectores**: Asegurar que todos los usuarios habilitados con rol `inspector` tengan cargados sus datos de firma digital (`full_name`, `license_number` de su matrícula profesional y `job_title`).
2.  **Políticas de Respaldo Físico**: Aunque la constancia digital es inmutable, se recomienda la conservación del reporte PDF firmado electrónicamente en repositorios documentales separados del servidor de base de datos transaccional.
3.  **Auditoría de Bitácora**: Establecer revisiones trimestrales de la tabla `audit_access_logs` por parte del Oficial de Seguridad de la Información de la organización para detectar anomalías o intentos de acceso no autorizados.
4.  **Integración con Autoridad Certificadora**: Gestionar el certificado de firma de código institucional para firmar digitalmente los documentos PDF exportados en el futuro.
