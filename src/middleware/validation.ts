import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import logger from '../utils/logger';

export const validateSchema = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      logger.warn('Request validation failed:', error.details);
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(detail => detail.message)
      });
    }

    next();
  };
};

// Validation schemas
export const schemas = {
  sync: {
    trigger: Joi.object({
      budgetId: Joi.string().required(),
      options: Joi.object({
        forceSync: Joi.boolean(),
        syncCategories: Joi.boolean()
      })
    }),
    retry: Joi.object({
      itemIds: Joi.array().items(Joi.string()),
      retryAll: Joi.boolean()
    })
  },
  
  serverKnowledge: {
    update: Joi.object({
      budgetId: Joi.string().required(),
      transactionKnowledge: Joi.number().integer().min(0),
      categoryKnowledge: Joi.number().integer().min(0)
    })
  },

  cleanup: {
    history: Joi.object({
      daysToKeep: Joi.number().integer().min(1).max(365).default(30)
    }),
    pending: Joi.object({
      daysToKeep: Joi.number().integer().min(1).max(30).default(7)
    })
  }
}; 