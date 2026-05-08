import { ConfigService } from '@nestjs/config';
import { Controller, Get, Header, Param, Req, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ShareService } from './share.service';

@ApiTags('share')
@Controller('share')
export class ShareController {
    constructor(
        private readonly shareService: ShareService,
        private readonly configService: ConfigService,
    ) {}

    @Get('battles/:id/og.png')
    @ApiOperation({
        summary: 'Render the share image for a completed battle (PNG, 1200x630).',
    })
    @ApiParam({ name: 'id', description: 'Battle ID' })
    @ApiResponse({ status: 200, description: 'PNG image bytes' })
    @ApiResponse({ status: 404, description: 'Battle not found or unfinished' })
    @SkipThrottle() // unauth read; cached by URL
    @Header('Cache-Control', 'public, max-age=86400, immutable')
    @Header('Content-Type', 'image/png')
    async getOgImage(@Param('id') id: string, @Res() res: Response) {
        const png = await this.shareService.getOgPng(id);
        res.send(png);
    }

    @Get('battles/:id/meta')
    @ApiOperation({
        summary:
            'Return JSON metadata for a battle\'s share card. Used by the public results page to render OG meta tags.',
    })
    @ApiParam({ name: 'id', description: 'Battle ID' })
    @ApiResponse({ status: 200, description: 'Share metadata' })
    @ApiResponse({ status: 404, description: 'Battle not found or unfinished' })
    async getMeta(@Param('id') id: string) {
        return this.shareService.getOgMeta(id);
    }

    /**
     * Public HTML landing page for the share URL. Returned as raw HTML so
     * social-card crawlers (Twitter, Discord, Slack) see proper OG meta
     * tags without needing SSR on the client SPA.
     */
    @Get('battles/:id')
    @ApiOperation({
        summary: 'Public OG-tagged HTML page for a completed battle. Shareable.',
    })
    @SkipThrottle()
    @Header('Cache-Control', 'public, max-age=600')
    @Header('Content-Type', 'text/html; charset=utf-8')
    async getSharePage(
        @Req() req: Request,
        @Param('id') id: string,
        @Res() res: Response,
    ) {
        const meta = await this.shareService.getOgMeta(id);
        const baseUrl =
            this.configService.get<string>('PUBLIC_BASE_URL') ??
            `${req.protocol}://${req.get('host')}`;
        const imageUrl = `${baseUrl}/api/share/battles/${id}/og.png`;
        const playUrl =
            this.configService.get<string>('CLIENT_URL') ?? '/';

        const escape = (s: string) =>
            s
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');

        const title = escape(meta.title);
        const desc = escape(meta.caption);

        const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<meta name="description" content="${desc}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${desc}" />
<meta property="og:image" content="${imageUrl}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${desc}" />
<meta name="twitter:image" content="${imageUrl}" />
<style>
  :root { color-scheme: dark; }
  html, body { margin: 0; padding: 0; background: #0b0d12; color: #e5e7eb;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 48px 24px; }
  img { width: 100%; max-width: 720px; height: auto; border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
  h1 { font-size: 28px; margin: 24px 0 8px; }
  p { color: #a3a3a3; }
  a.btn { display: inline-block; margin-top: 16px; padding: 12px 20px;
    background: #3b82f6; color: white; border-radius: 8px;
    text-decoration: none; font-weight: 600; }
  a.btn:hover { background: #2563eb; }
</style>
</head>
<body>
<div class="wrap">
  <img src="${imageUrl}" alt="${title}" />
  <h1>${title}</h1>
  <p>${desc}</p>
  <a class="btn" href="${escape(playUrl)}">Settle it on CodeQuest →</a>
</div>
</body>
</html>`;
        res.send(html);
    }
}
