import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectEntityManager } from '@nestjs/typeorm';
import { AgentEvent } from 'src/entities/agent-event.entity';
import { AgentSession } from 'src/entities/agent-session.entity';
import { ActiveUserData } from 'src/interfaces/active-user-data.interface';
import { AgentEventRepository } from 'src/repository/agent-event.repository';
import { EntityManager } from 'typeorm';
import { CRUDService } from './crud.service';

/** Media field on agentEvent that holds chat attachments (see solid-core-metadata.json). */
export const AGENT_EVENT_ATTACHMENTS_FIELD = 'attachments';

@Injectable()
export class AgentEventService extends CRUDService<AgentEvent> {
  constructor(
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    readonly repo: AgentEventRepository,
    readonly moduleRef: ModuleRef,
  ) {
    super(entityManager, repo, 'agentEvent', 'solid-core', moduleRef);
  }

  /**
   * Attaches uploaded files to a `UserMessage` event through the `attachments` media field, so
   * they are kept by the configured media storage provider and can be shown again when the
   * conversation is reopened. Only the owner of the event's session (or an Admin) may attach.
   */
  async uploadAttachments(id: number, files: Express.Multer.File[] = [], activeUser: ActiveUserData) {
    if (!files.length) {
      throw new BadRequestException('No files uploaded');
    }

    const event = await this.repo.findOne({ where: { id } });
    if (!event) {
      throw new NotFoundException(`Agent event ${id} not found`);
    }
    if (event.eventType !== 'UserMessage') {
      throw new BadRequestException('Attachments can only be added to UserMessage events');
    }

    const session = await this.entityManager.getRepository(AgentSession).findOne({ where: { sessionId: event.sessionId } });
    const isAdmin = !!activeUser?.roles?.includes('Admin');
    if (!isAdmin && (!session || session.userId !== activeUser?.sub)) {
      throw new ForbiddenException('You can only attach files to your own conversations');
    }

    // Files are matched to media fields by their multipart field name.
    const attachmentFiles = files.map((file) => ({ ...file, fieldname: AGENT_EVENT_ATTACHMENTS_FIELD }));
    await this.update(id, {}, attachmentFiles, true);

    return this.findOne(id, { populateMedia: [AGENT_EVENT_ATTACHMENTS_FIELD] });
  }
}
