import { logger } from './_logger.js';

export async function notifyAlert(
    evento: string,
    payload: Record<string, any>
): Promise<void> {
    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!webhookUrl) {
        logger.warn('notify', 'N8N_WEBHOOK_URL not configured, skipping', { evento });
        return;
    }

    const body = {
        evento,
        timestamp: new Date().toISOString(),
        platform: 'SafetyVision AI',
        ...payload,
    };

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (response.ok) {
            logger.info('notify', 'Alert sent', { evento });
        } else {
            logger.warn('notify', 'Webhook returned non-OK', { evento, status: response.status });
        }
    } catch (err: any) {
        logger.warn('notify', 'Network error sending alert', { evento, error: err.message });
    }
}
