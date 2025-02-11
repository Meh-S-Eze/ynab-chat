import pino from 'pino';

const transport = process.env.NODE_ENV === 'development' 
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname'
      }
    }
  : undefined;

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport
});

export default logger; 