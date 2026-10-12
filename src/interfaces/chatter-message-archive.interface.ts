import { ChatterMessage } from '../entities/chatter-message.entity';

/** Filter contract shared by archive consumers; consumers translate it to their store. */
export interface ChatterMessageArchiveFilter {
  filters?: Record<string, any>;
  sort?: string[];
  limit?: number;
  offset?: number;
}

export interface ChatterMessageArchivePage {
  records: ChatterMessage[];
  meta?: { totalRecords?: number; currentPage?: number; totalPages?: number; perPage?: number };
}

/** Optional single archive store supplied by the consuming application. */
export interface IChatterMessageArchive {
  /** Persist the message and its chatterMessageDetails. Must be safe to retry for the same id. */
  archiveChatterMessage(message: ChatterMessage): Promise<void>;
  getChatterMessage(id: number): Promise<ChatterMessage | null>;
  getChatterMessages(filter: ChatterMessageArchiveFilter): Promise<ChatterMessageArchivePage>;
}
