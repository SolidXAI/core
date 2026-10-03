import { BadGatewayException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
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

  private async request<T>(method: 'GET' | 'POST', path: string, authorization: string): Promise<T> {
    try {
      const response = await this.httpService.axiosRef.request<T>({
        url: `${this.getBaseUrl()}${path}`,
        method,
        headers: { Authorization: authorization },
        timeout: 15000,
      });
      return response.data;
    } catch (error: any) {
      if (error?.status) throw error;
      const status = error?.response?.status;
      const detail = error?.response?.data?.detail ?? error?.response?.data?.message;
      throw new BadGatewayException(detail || `AgentHub manager request failed${status ? ` (${status})` : ''}.`);
    }
  }

  listProcesses(authorization: string): Promise<any[]> {
    return this.request('GET', '/api/processes', authorization);
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
    return this.restartAgent(agentId, authorization);
  }
}
