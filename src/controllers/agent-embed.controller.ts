import { Controller, Get, Logger, Res } from '@nestjs/common';
import { Response } from 'express';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { Public } from '../decorators/public.decorator';

/** Public, dependency-free SDK asset. Does not issue credentials or expose agent configuration. */
@Controller('agent-embed')
export class AgentEmbedController {
  private readonly logger = new Logger(AgentEmbedController.name);

  @Public()
  @Get('sdk.js')
  sdk(@Res() response: Response): void {
    const hostedUiUrl = process.env.AGENT_EMBED_UI_URL;
    this.logger.log(`SDK request received: configuredUiUrl=${!!hostedUiUrl}`);
    let hostedUiOrigin: string;
    try {
      const parsed = new URL(hostedUiUrl ?? '');
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
        throw new Error('Invalid hosted UI URL');
      }
      hostedUiOrigin = parsed.origin;
    } catch {
      this.logger.error('SDK request rejected: AGENT_EMBED_UI_URL is missing or invalid.');
      response.status(503).type('text/plain').send('Agent embed UI is not configured.');
      return;
    }

    const packaged = resolve(__dirname, '../resources/agent-embed/solid-agent-embed.js');
    const source = resolve(__dirname, '../../resources/agent-embed/solid-agent-embed.js');
    const resourcePath = existsSync(packaged) ? packaged : source;
    this.logger.log(`Serving embed SDK: hostedUiOrigin=${hostedUiOrigin} resource=${existsSync(packaged) ? 'packaged' : 'source'}`);
    response.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    const sdk = readFileSync(resourcePath, 'utf8');
    const hasPlaceholder = sdk.includes('__SOLIDX_AGENT_EMBED_UI_ORIGIN__');
    const renderedSdk = sdk.replace('__SOLIDX_AGENT_EMBED_UI_ORIGIN__', JSON.stringify(hostedUiOrigin));
    this.logger.log(`Embed SDK ready: sourceBytes=${Buffer.byteLength(sdk)} placeholderFound=${hasPlaceholder} renderedBytes=${Buffer.byteLength(renderedSdk)}`);
    response.send(renderedSdk);
  }
}
