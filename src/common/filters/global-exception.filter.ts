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
  InvalidTransitionError,
  SpecialistRequiredError,
  StateMachineExecutionError,
} from '../errors/domain.errors';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const { status, body } = this.resolve(exception);

    this.logger.error({
      path: req.url,
      method: req.method,
      status,
      error: body.error,
      message: body.message,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      ...(status === HttpStatus.INTERNAL_SERVER_ERROR && {
        originalError:
          exception instanceof Error ? exception.message : String(exception),
        stack: exception instanceof Error ? exception.stack : undefined,
      }),
    });

    res.status(status).json(body);
  }

  private resolve(exception: unknown): {
    status: number;
    body: Record<string, unknown>;
  } {
    if (exception instanceof SpecialistRequiredError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        body: {
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'SpecialistRequired',
          message: exception.message,
        },
      };
    }

    if (exception instanceof InvalidTransitionError) {
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        body: {
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          error: 'InvalidTransition',
          message: exception.message,
          details: { event: exception.event, state: exception.state },
        },
      };
    }

    if (exception instanceof StateMachineExecutionError) {
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        body: {
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          error: 'StateMachineExecutionError',
          message: exception.message,
          details: { event: exception.event },
        },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      return {
        status,
        body:
          typeof response === 'object'
            ? (response as Record<string, unknown>)
            : { statusCode: status, message: response },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'InternalServerError',
        message: 'Internal server error',
      },
    };
  }
}
