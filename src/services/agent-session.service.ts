import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef  } from "@nestjs/core";
import { EntityManager } from 'typeorm';
import { CRUDService } from './crud.service';
import { AgentSession } from '../entities/agent-session.entity';
import { AgentSessionRepository } from '../repository/agent-session.repository';
import { AgentEventService } from './agent-event.service';
import { AgentEvent } from '../entities/agent-event.entity';
import { ActiveUserData } from '../interfaces/active-user-data.interface';

@Injectable()
export class AgentSessionService extends CRUDService<AgentSession>{
  constructor(
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: AgentSessionRepository,
    readonly moduleRef: ModuleRef,
    private readonly agentEventService: AgentEventService,
      
 ) {
   super(entityManager, repo, 'agentSession', 'agent-hub', moduleRef);
 }

  async getMessages(sessionId: number, page: number, pageSize: number, activeUser: ActiveUserData) {
    const session = await this.entityManager.getRepository(AgentSession).findOne({
      where: { id: sessionId },
      relations: { user: true },
    });
    if (!session) throw new NotFoundException(`Agent session ${sessionId} not found`);

    const isAdmin = !!activeUser?.roles?.includes('Admin');
    if (!isAdmin && session.user?.id !== activeUser?.sub) {
      throw new ForbiddenException('You can only view messages from your own conversations');
    }

    const safePage = Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1);
    const safePageSize = Math.min(500, Math.max(1, Number.isFinite(pageSize) ? Math.floor(pageSize) : 50));
    const offset = (safePage - 1) * safePageSize;
    const result = await this.agentEventService.find({
      limit: safePageSize,
      offset,
      sort: ['id:desc'],
      filters: { session: { id: { $eq: sessionId } } },
      fields: ['id', 'createdAt', 'eventType', 'eventData', 'content', 'toolName', 'toolArguments', 'toolOutput', 'turnNumber'],
      populateMedia: ['attachments'],
    } as any);

    const events: AgentEvent[] = Array.isArray(result?.records) ? result.records : [];
    const total = Number(result?.meta?.totalRecords ?? events.length);
    const messages = events.slice().reverse().map((event) => {
      let eventData: Record<string, any> = {};
      if (event.eventData && typeof event.eventData === 'object') {
        eventData = event.eventData as unknown as Record<string, any>;
      } else if (typeof event.eventData === 'string') {
        try {
          const parsed = JSON.parse(event.eventData);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) eventData = parsed;
        } catch {
          // Retain the event's structured columns when eventData is not JSON.
        }
      }
      if (event.content != null && eventData.content == null) eventData.content = event.content;
      if (event.toolName && eventData.tool_name == null) eventData.tool_name = event.toolName;
      if (event.toolArguments && eventData.arguments == null) {
        try { eventData.arguments = JSON.parse(event.toolArguments); }
        catch { eventData.arguments = event.toolArguments; }
      }
      if (event.toolOutput != null && eventData.output == null) eventData.output = event.toolOutput;

      return {
        id: String(event.id),
        event_type: event.eventType,
        event_data: eventData,
        content: event.content ?? '',
        tool_name: event.toolName,
        tool_output: event.toolOutput,
        turn_number: event.turnNumber,
        timestamp: event.createdAt,
        role: event.eventType === 'UserMessage' ? 'user' : 'assistant',
      };
    });

    return {
      messages,
      total,
      page: safePage,
      page_size: safePageSize,
      has_more: offset + events.length < total,
    };
  }
}
