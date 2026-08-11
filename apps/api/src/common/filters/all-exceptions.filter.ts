import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from "@nestjs/common";

type HttpResponse = {
  status(statusCode: number): {
    json(body: { statusCode: number; message: string | string[] }): void;
  };
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<HttpResponse>();
    const statusCode = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = this.getMessage(exception);

    if (exception instanceof Error) {
      this.logger.error(message, exception.stack);
    } else {
      this.logger.error(message);
    }

    response.status(statusCode).json({
      statusCode,
      message
    });
  }

  private getMessage(exception: unknown): string | string[] {
    if (!(exception instanceof HttpException)) {
      return "Internal server error";
    }

    const response = exception.getResponse();
    if (typeof response === "string") {
      return response;
    }

    const { message } = response as { message?: unknown };
    return typeof message === "string" || Array.isArray(message)
      ? message
      : exception.message;
  }
}
