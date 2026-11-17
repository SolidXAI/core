import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { Public } from '../decorators/public.decorator';

@Controller('admin-embed')
export class AdminEmbedController {
    @Public()
    @Get('sdk.js')
    sdk(@Res() response: Response): void {
        let embedUrl: URL;
        try {
            const ui = new URL(process.env.ADMIN_EMBED_UI_URL ?? '');
            if (!['http:', 'https:'].includes(ui.protocol) || ui.username || ui.password || ui.search || ui.hash) {
                throw new Error('Invalid admin embed UI URL');
            }
            ui.pathname = `${ui.pathname.replace(/\/$/, '')}/embed/admin`;
            embedUrl = ui;
        } catch {
            response.status(503).type('text/plain').send('Admin embed UI is not configured.');
            return;
        }

        const packaged = resolve(__dirname, '../resources/admin-embed/solid-admin-embed.js');
        const source = resolve(__dirname, '../../resources/admin-embed/solid-admin-embed.js');
        const sdk = readFileSync(existsSync(packaged) ? packaged : source, 'utf8');
        response.type('application/javascript');
        response.setHeader('Cache-Control', 'no-cache');
        response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        response.send(sdk.replace('__SOLIDX_ADMIN_EMBED_UI_URL__', () => JSON.stringify(embedUrl.href)));
    }
}
