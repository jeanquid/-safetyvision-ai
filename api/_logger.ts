type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
    level: LogLevel;
    module: string;
    message: string;
    data?: Record<string, any>;
    timestamp: string;
}

function log(level: LogLevel, module: string, message: string, data?: Record<string, any>) {
    const entry: LogEntry = {
        level,
        module,
        message,
        data,
        timestamp: new Date().toISOString(),
    };
    const line = JSON.stringify(entry);

    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
}

export const logger = {
    info: (module: string, message: string, data?: Record<string, any>) =>
        log('info', module, message, data),
    warn: (module: string, message: string, data?: Record<string, any>) =>
        log('warn', module, message, data),
    error: (module: string, message: string, data?: Record<string, any>) =>
        log('error', module, message, data),
};
