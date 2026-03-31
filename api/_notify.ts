export async function notifyAlert(
    evento: string,
    payload: Record<string, any>
): Promise<void> {
    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!webhookUrl) {
        console.warn('[n8n] N8N_WEBHOOK_URL not configured — notification skipped.');
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
            console.log(`[n8n] Alert sent for event: ${evento}`);
        } else {
            console.warn(`[n8n] Webhook returned ${response.status} for "${evento}".`);
        }
    } catch (err) {
        console.warn(`[n8n] Network error for "${evento}":`, err);
    }
}
