import { Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { DiscoveryService, ModuleRef } from "@nestjs/core";
import { EntityManager, Repository } from 'typeorm';

import { CRUDService } from 'src/services/crud.service';
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { ModuleMetadataService } from 'src/services/module-metadata.service';
import { ConfigService } from '@nestjs/config';
import { FileService } from 'src/services/file.service';
import { CrudHelperService } from 'src/services/crud-helper.service';
import { spawn } from 'child_process';
import { AiInteraction } from '../entities/ai-interaction.entity';


interface McpResponse {
  success: boolean;
  request: string;
  response: string;
  model?: string;
  tools_invoked?: string[];
  tool_calls?: any[];
  duration_ms?: number;
  errors?: string[];
  trace?: string[];
}





@Injectable()
export class AiInteractionService extends CRUDService<AiInteraction> {
  constructor(
    readonly modelMetadataService: ModelMetadataService,
    readonly moduleMetadataService: ModuleMetadataService,
    readonly configService: ConfigService,
    readonly fileService: FileService,
    readonly discoveryService: DiscoveryService,
    readonly crudHelperService: CrudHelperService,
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    @InjectRepository(AiInteraction, 'default')
    readonly repo: Repository<AiInteraction>,
    readonly moduleRef: ModuleRef

  ) {
    super(modelMetadataService, moduleMetadataService, configService, fileService, discoveryService, crudHelperService, entityManager, repo, 'aiInteraction', 'solid-core', moduleRef);
  }

  /**
   * Runs the Python MCP client with a prompt and returns the parsed JSON embedded in the 'response'.
   * @param prompt - The question or instruction to send to the MCP client.
   * @returns The parsed object inside the 'response' field of the JSON output.
   */
  async runMcpPrompt(prompt: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const python = spawn('python', ['client_sse_nochat.py', prompt]);

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`Python script exited with code ${code}: ${stderr}`));
        }

        try {
          const raw: McpResponse = JSON.parse(stdout);

          if (!raw.success) {
            return reject(new Error(`MCP error: ${raw.errors?.join(', ')}`));
          }

          let cleaned = raw.response.trim();

          // Remove markdown-style code block wrapper
          if (cleaned.startsWith('```json')) {
            cleaned = cleaned.replace(/^```json/, '').trim();
          }
          if (cleaned.endsWith('```')) {
            cleaned = cleaned.replace(/```$/, '').trim();
          }

          const parsed = JSON.parse(cleaned);
          resolve(parsed);
        } catch (err: any) {
          reject(new Error(`Failed to parse JSON: ${err.message}`));
        }
      });
    });
  }

}
