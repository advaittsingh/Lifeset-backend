import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { AUDIT_LOG_KEY } from '../audit/audit-log.decorator';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditData = this.reflector.get<{ action: string; resource: string }>(
      AUDIT_LOG_KEY,
      context.getHandler(),
    );

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return next.handle().pipe(
      tap(() => {
        if (auditData && user) {
          const resourceId = request.params?.id || request.body?.id;
          this.auditService.logAction(
            user.id,
            auditData.action,
            auditData.resource,
            resourceId,
            request.body,
          );
        }
      }),
    );
  }
}

