import db from './_db.js';
import { logger } from './_logger.js';

export interface TenantConfig {
    tenantId: string;
    name: string;
    plants: { name: string; sectors: string[] }[];
    settings: Record<string, any>;
}

export async function getTenant(tenantId: string): Promise<TenantConfig | null> {
    try {
        const result = await db.query(
            'SELECT tenant_id, name, plants, settings FROM tenants WHERE tenant_id = $1',
            [tenantId]
        );
        if (result.rows.length === 0) return null;
        const row = result.rows[0];
        return {
            tenantId: row.tenant_id,
            name: row.name,
            plants: row.plants || [],
            settings: row.settings || {},
        };
    } catch (error: any) {
        logger.error('tenant', 'Failed to get tenant', { tenantId, error: error.message });
        return null;
    }
}

export async function updateTenantPlants(
    tenantId: string,
    plants: { name: string; sectors: string[] }[]
): Promise<boolean> {
    try {
        const result = await db.query(
            `UPDATE tenants SET plants = $1, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $2`,
            [JSON.stringify(plants), tenantId]
        );
        logger.info('tenant', 'Plants updated', { tenantId, plantCount: plants.length });
        return (result.rowCount || 0) > 0;
    } catch (error: any) {
        logger.error('tenant', 'Failed to update plants', { tenantId, error: error.message });
        return false;
    }
}

export async function createTenant(
    tenantId: string,
    name: string,
    plants?: { name: string; sectors: string[] }[]
): Promise<TenantConfig> {
    const config: TenantConfig = {
        tenantId,
        name,
        plants: plants || [{ name: 'Planta Principal', sectors: ['General'] }],
        settings: {},
    };

    await db.query(
        `INSERT INTO tenants (tenant_id, name, plants, settings)
         VALUES ($1, $2, $3, $4)`,
        [config.tenantId, config.name, JSON.stringify(config.plants), JSON.stringify(config.settings)]
    );

    logger.info('tenant', 'Tenant created', { tenantId, name });
    return config;
}
