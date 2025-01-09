import {
    CallHandler,
    ExecutionContext,
    Injectable,
    Logger,
    NestInterceptor,
  } from '@nestjs/common';
  import { Observable } from 'rxjs';
  import { map } from 'rxjs/operators';
  
  @Injectable()
  export class WrapResponseInterceptor implements NestInterceptor {
  
    private readonly logger = new Logger(WrapResponseInterceptor.name);
  
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
      return next.handle().pipe(map(data => {
        return {
          statusCode: 200,
          message: [],
          error: "",
          data, 
        };
      }));
    }
  }