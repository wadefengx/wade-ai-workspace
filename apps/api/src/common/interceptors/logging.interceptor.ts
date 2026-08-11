import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";

type HttpRequest = {
  method: string;
  originalUrl?: string;
  url: string;
};

type HttpResponse = {
  statusCode: number;
  once(event: "finish", listener: () => void): void;
};

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<HttpRequest>();
    const response = context.switchToHttp().getResponse<HttpResponse>();
    const startedAt = performance.now();

    response.once("finish", () => {
      this.logger.log(
        `${request.method} ${request.originalUrl ?? request.url} ${response.statusCode} ${Math.round(performance.now() - startedAt)}ms`
      );
    });

    return next.handle();
  }
}
