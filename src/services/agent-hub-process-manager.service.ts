import { BadGatewayException, ConflictException, HttpException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { SettingService } from './setting.service';

/** Host-to-host API client for the AgentHub runtime manager control plane. */
@Injectable()
export class AgentHubProcessManagerService {
  constructor(
    private readonly httpService: HttpService,
    private readonly settingService: SettingService,
  ) {}

  private getBaseUrl(): string {
    const configured = this.settingService.getConfigValue<any>('solidxAgentHubBackendUrl');
    if (typeof configured !== 'string' || !configured.trim()) {
      throw new ServiceUnavailableException('AgentHub manager URL is not configured.');
    }
    const base = configured.trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(base)) {
      throw new ServiceUnavailableException('AgentHub manager URL must use HTTP or HTTPS.');
    }
    return base;
  }

  private async request<T>(method: 'GET' | 'POST', path: string, authorization: string, data?: unknown): Promise<T> {
    try {
      const response = await this.httpService.axiosRef.request<T>({
        url: `${this.getBaseUrl()}${path}`,
        method,
        headers: { Authorization: authorization },
        data,
        timeout: 15000,
      });
      return response.data;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      const status = error?.response?.status;
      const detail = error?.response?.data?.detail ?? error?.response?.data?.message;
      if ([400, 401, 403, 404, 409, 422, 429, 503].includes(status)) {
        throw new HttpException(typeof detail === 'string' ? detail : 'AgentHub request failed.', status);
      }
      throw new BadGatewayException(detail || `AgentHub manager request failed${status ? ` (${status})` : ''}.`);
    }
  }

  listProcesses(authorization: string): Promise<any[]> {
    return this.request('GET', '/api/processes', authorization);
  }

  listJobSessions(authorization: string, filters: {
    review: boolean; offset: number; limit: number; agent?: string; hostRefId?: string; status?: string;
    trigger?: string; runtime?: string; startedFrom?: string; startedTo?: string; search?: string; sort?: string;
  }) {
    const query = new URLSearchParams({
      review: String(filters.review), offset: String(filters.offset), limit: String(filters.limit),
    });
    for (const key of ['agent', 'hostRefId', 'status', 'trigger', 'runtime', 'startedFrom', 'startedTo', 'search', 'sort'] as const) {
      const value = filters[key];
      if (value) query.set(key, value);
    }
    return this.request('GET', `/api/job-sessions?${query.toString()}`, authorization);
  }

  getJobSession(authorization: string, sessionId: string) {
    return this.request('GET', `/api/job-sessions/${encodeURIComponent(sessionId)}`, authorization);
  }

  connectJobSession(authorization: string, sessionId: string) {
    return this.request('POST', `/api/job-sessions/${encodeURIComponent(sessionId)}/connect`, authorization);
  }

  answerJobSession(authorization: string, sessionId: string, requestId: number, answer: unknown) {
    return this.request('POST', `/api/job-sessions/${encodeURIComponent(sessionId)}/requests/${requestId}/answer`,
      authorization, answer);
  }

  async stopProcess(processId: string, authorization: string): Promise<{ status: string }> {
    const processes = await this.listProcesses(authorization);
    const process = processes.find((item) => String(item.id) === processId);
    if (!process) throw new NotFoundException('Runtime process was not found.');
    if (process.status !== 'ready') {
      throw new ConflictException(`Only a ready process can be stopped (current status: ${process.status}).`);
    }
    return this.request('POST', `/api/processes/${encodeURIComponent(processId)}/stop`, authorization);
  }

  restartAgent(agentId: number, authorization: string): Promise<{ id: string; status: string }> {
    return this.request('POST', `/api/agents/${agentId}/restart`, authorization);
  }

  async restartProcess(processId: string, agentId: number, authorization: string): Promise<{ id: string; status: string }> {
    const processes = await this.listProcesses(authorization);
    const process = processes.find((item) => String(item.id) === processId);
    if (!process) throw new NotFoundException('Runtime process was not found.');
    if (process.status !== 'ready') {
      throw new ConflictException(`Only a ready process can restart its agent (current status: ${process.status}).`);
    }
    if (Number(process.agentId) !== agentId) {
      throw new ConflictException('The process is no longer linked to this agent.');
    }
    return this.request('POST', `/api/processes/${encodeURIComponent(processId)}/restart`, authorization);
  }
}
