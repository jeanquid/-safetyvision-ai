export function sanitizeInput(text: string): string {
    if (!text) return '';
    return text
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/```/g, '')
        .replace(/\{[^}]*\}/g, '')
        .replace(/\b(ignore|forget|disregard|override)\b.{0,80}\b(previous|above|instruction|prompt|role|system)\b/gi, '[REDACTED]')
        .replace(/\b(you are now|act as|pretend to be|new instruction|system prompt|jailbreak)\b/gi, '[REDACTED]')
        .substring(0, 500)
        .trim();
}
