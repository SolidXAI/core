import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Inject, Injectable } from "@nestjs/common";
import { Cache } from "cache-manager";

@Injectable()
export class ActiveSessionStorageService {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  async setActiveSession(userId: number, sessionId: string): Promise<void> {
    await this.cacheManager.set(this.getKey(userId), sessionId);
  }

  async getActiveSession(userId: number): Promise<string | undefined> {
    return this.cacheManager.get(this.getKey(userId));
  }

  async clearActiveSession(userId: number): Promise<void> {
    await this.cacheManager.del(this.getKey(userId));
  }

  private getKey(userId: number): string {
    return `active-session-${userId}`;
  }
}
