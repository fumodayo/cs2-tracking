type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogPayload {
  message: string;
  level: LogLevel;
  timestamp: string;
  context?: string;
  [key: string]: unknown;
}

const LEVEL_SEVERITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL: LogLevel = (process.env.LOG_LEVEL?.toLowerCase() as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
  return LEVEL_SEVERITY[level] >= LEVEL_SEVERITY[MIN_LEVEL];
}

function formatLog(
  level: LogLevel,
  message: string,
  context?: string,
  meta?: Record<string, unknown>
): string {
  const payload: LogPayload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
    ...meta,
  };

  if (process.env.NODE_ENV === 'development') {
    const colorReset = '\x1b[0m';
    const colors: Record<LogLevel, string> = {
      debug: '\x1b[90m', // Gray
      info: '\x1b[32m', // Green
      warn: '\x1b[33m', // Yellow
      error: '\x1b[31m', // Red
    };
    const ctxString = context ? ` [${context}]` : '';
    const metaString = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${payload.timestamp} ${colors[level]}${level.toUpperCase()}${colorReset}${ctxString}: ${message}${metaString}`;
  }

  return JSON.stringify(payload);
}

export const logger = {
  debug(message: string, context?: string, meta?: Record<string, unknown>) {
    if (shouldLog('debug')) {
      console.log(formatLog('debug', message, context, meta));
    }
  },
  info(message: string, context?: string, meta?: Record<string, unknown>) {
    if (shouldLog('info')) {
      console.log(formatLog('info', message, context, meta));
    }
  },
  warn(message: string, context?: string, meta?: Record<string, unknown>) {
    if (shouldLog('warn')) {
      console.warn(formatLog('warn', message, context, meta));
    }
  },
  error(
    message: string,
    errorOrMessage: unknown,
    context?: string,
    meta?: Record<string, unknown>
  ) {
    if (shouldLog('error')) {
      let msg = '';
      let errMeta: Record<string, unknown> = {};

      if (errorOrMessage instanceof Error) {
        msg = errorOrMessage.message;
        errMeta = {
          error: {
            message: errorOrMessage.message,
            stack: errorOrMessage.stack,
            name: errorOrMessage.name,
          },
        };
      } else {
        msg = String(errorOrMessage);
      }

      console.error(formatLog('error', msg, context, { ...errMeta, ...meta }));
    }
  },
};
