import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  CasinoNotFoundException,
  ComparisonNotFoundException,
  DatabaseException,
  InvalidStateException,
  MissingCasinoNotFoundException,
  PerplexityAPIException,
  ReelEdgeAPIException,
  ResearchJobNotFoundException,
} from '../../domain/exceptions';

/**
 * Error response DTO matching API spec
 */
interface ErrorResponse {
  error: string;
  message: string;
  details?: object;
}

/**
 * HttpException response object structure
 */
interface HttpExceptionResponse {
  error?: string;
  message?: string | string[];
  details?: object;
  statusCode?: number;
}

/**
 * Global HTTP Exception Filter
 * Maps domain exceptions to HTTP status codes and formats errors per API spec
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = this.buildErrorResponse(exception);

    this.logger.error(
      `Exception caught: ${errorResponse.error}`,
      exception instanceof Error ? exception.stack : String(exception),
      {
        path: request.url,
        method: request.method,
        statusCode: this.getStatusCode(exception),
        timestamp: new Date().toISOString(),
      },
    );

    response.status(this.getStatusCode(exception)).json(errorResponse);
  }

  /**
   * Build error response matching API spec Error schema
   */
  private buildErrorResponse(exception: unknown): ErrorResponse {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'object' && response !== null) {
        const responseObj = response as HttpExceptionResponse;
        const message =
          typeof responseObj.message === 'string'
            ? responseObj.message
            : Array.isArray(responseObj.message)
              ? responseObj.message.join(', ')
              : exception.message;

        return {
          error: responseObj.error || exception.name,
          message: message || exception.message,
          details: responseObj.details,
        };
      }
      return {
        error: exception.name,
        message: exception.message,
      };
    }

    if (exception instanceof CasinoNotFoundException) {
      return {
        error: 'CasinoNotFound',
        message: exception.message,
      };
    }

    if (exception instanceof ComparisonNotFoundException) {
      return {
        error: 'ComparisonNotFound',
        message: exception.message,
      };
    }

    if (exception instanceof InvalidStateException) {
      return {
        error: 'InvalidState',
        message: exception.message,
      };
    }

    if (exception instanceof MissingCasinoNotFoundException) {
      return {
        error: 'MissingCasinoNotFound',
        message: exception.message,
      };
    }

    if (exception instanceof ResearchJobNotFoundException) {
      return {
        error: 'ResearchJobNotFound',
        message: exception.message,
      };
    }

    if (exception instanceof PerplexityAPIException) {
      return {
        error: 'PerplexityAPIError',
        message: exception.message,
        details: {
          cause: exception.cause,
        },
      };
    }

    if (exception instanceof ReelEdgeAPIException) {
      return {
        error: 'ReelEdgeAPIError',
        message: exception.message,
        details: {
          cause: exception.cause,
        },
      };
    }

    if (exception instanceof DatabaseException) {
      return {
        error: 'DatabaseError',
        message: exception.message,
      };
    }

    if (exception instanceof Error) {
      return {
        error: 'InternalServerError',
        message: exception.message,
      };
    }

    return {
      error: 'InternalServerError',
      message: 'An unexpected error occurred',
    };
  }

  /**
   * Get HTTP status code for exception
   */
  private getStatusCode(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    if (
      exception instanceof CasinoNotFoundException ||
      exception instanceof ComparisonNotFoundException ||
      exception instanceof MissingCasinoNotFoundException ||
      exception instanceof ResearchJobNotFoundException
    ) {
      return HttpStatus.NOT_FOUND;
    }

    if (
      exception instanceof InvalidStateException ||
      exception instanceof DatabaseException
    ) {
      return HttpStatus.BAD_REQUEST;
    }

    if (
      exception instanceof PerplexityAPIException ||
      exception instanceof ReelEdgeAPIException
    ) {
      return HttpStatus.BAD_GATEWAY;
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}
