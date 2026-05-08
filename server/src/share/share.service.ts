import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Resvg } from '@resvg/resvg-js';
import { BattleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { fillTemplate, pickCaption } from './captions';

interface ResolvedRoast {
    winner: { username: string; mmr: number };
    loser: { username: string; mmr: number };
    mmrDelta: number;
    seconds: number | null;
    caption: string;
    title: string;
}

@Injectable()
export class ShareService {
    private readonly logger = new Logger(ShareService.name);

    constructor(private readonly prisma: PrismaService) {}

    async getOgPng(battleId: string): Promise<Buffer> {
        const data = await this.resolveRoast(battleId);
        const svg = this.renderSvg(data);
        const resvg = new Resvg(svg, {
            fitTo: { mode: 'width', value: 1200 },
            font: { loadSystemFonts: true, defaultFontFamily: 'sans-serif' },
            background: '#0b0d12',
        });
        return Buffer.from(resvg.render().asPng());
    }

    /**
     * Public meta payload — used by the /r/:battleId page to render
     * Open Graph tags and the inline summary.
     */
    async getOgMeta(battleId: string) {
        const data = await this.resolveRoast(battleId);
        return {
            battleId,
            title: data.title,
            caption: data.caption,
            winner: data.winner,
            loser: data.loser,
            mmrDelta: data.mmrDelta,
            seconds: data.seconds,
        };
    }

    private async resolveRoast(battleId: string): Promise<ResolvedRoast> {
        const battle = await this.prisma.battle.findUnique({
            where: { id: battleId },
            select: {
                id: true,
                status: true,
                winnerId: true,
                startedAt: true,
                participants: {
                    select: {
                        userId: true,
                        submittedAt: true,
                        mmrChange: true,
                        user: {
                            select: { id: true, username: true, mmr: true },
                        },
                    },
                },
            },
        });

        if (!battle) {
            throw new NotFoundException('Battle not found');
        }
        if (battle.status !== BattleStatus.COMPLETED || !battle.winnerId) {
            throw new NotFoundException('Battle has no shareable result yet');
        }

        const winner = battle.participants.find(
            (p) => p.userId === battle.winnerId,
        );
        const loser = battle.participants.find(
            (p) => p.userId !== battle.winnerId,
        );
        if (!winner || !loser || !winner.user || !loser.user) {
            throw new NotFoundException('Battle has no shareable result yet');
        }

        // mmrChange is the winner's gain. Use absolute value, default 0
        // when unknown.
        const mmrDelta = Math.abs(winner.mmrChange ?? 0);
        // mmrGap > 0 = winner had lower MMR (upset), unlocks spicy pool.
        const mmrGap = (loser.user.mmr ?? 0) - (winner.user.mmr ?? 0);

        const seconds =
            winner.submittedAt && battle.startedAt
                ? Math.max(
                      0,
                      Math.round(
                          (winner.submittedAt.getTime() -
                              battle.startedAt.getTime()) /
                              1000,
                      ),
                  )
                : null;

        const caption = pickCaption({ mmrGap });
        const filled = fillTemplate(caption.text, {
            winner: winner.user.username,
            loser: loser.user.username,
            mmrDelta,
            seconds: seconds ?? undefined,
        });

        return {
            winner: { username: winner.user.username, mmr: winner.user.mmr },
            loser: { username: loser.user.username, mmr: loser.user.mmr },
            mmrDelta,
            seconds,
            caption: filled,
            title: `${winner.user.username} beat ${loser.user.username} on CodeQuest`,
        };
    }

    /**
     * Build the OG card SVG. 1200x630 — the standard social-share aspect.
     * Pure XML; no satori, no font assets — resvg picks up system fonts at
     * render time.
     */
    private renderSvg(d: ResolvedRoast): string {
        const w = 1200;
        const h = 630;
        const winnerLine = `${this.escape(d.winner.username)}  +${d.mmrDelta} MMR`;
        const loserLine = this.escape(d.loser.username);
        const captionTop = this.escape(this.firstLine(d.caption));
        const captionBottom = this.escape(this.secondLine(d.caption));

        return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b0d12"/>
      <stop offset="100%" stop-color="#1a0e22"/>
    </linearGradient>
    <linearGradient id="winnerGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#22c55e"/>
      <stop offset="100%" stop-color="#3b82f6"/>
    </linearGradient>
  </defs>

  <rect width="${w}" height="${h}" fill="url(#bg)"/>

  <!-- soft red glow behind the L -->
  <circle cx="${w - 240}" cy="${h / 2}" r="240" fill="#ef4444" opacity="0.18"/>

  <!-- HUGE roast L -->
  <text x="${w - 240}" y="${h / 2 + 130}" text-anchor="middle"
        font-family="sans-serif" font-weight="900" font-size="380"
        fill="#ef4444" opacity="0.95">L</text>

  <!-- top brand strip -->
  <text x="60" y="80" font-family="sans-serif" font-weight="800" font-size="32" fill="#a3a3a3">
    ⚔  CodeQuest Battles
  </text>

  <!-- caption (the roast) -->
  <text x="60" y="200" font-family="sans-serif" font-weight="900" font-size="64" fill="#ffffff">
    ${captionTop}
  </text>
  ${captionBottom
    ? `<text x="60" y="282" font-family="sans-serif" font-weight="900" font-size="64" fill="#ffffff">${captionBottom}</text>`
    : ''}

  <!-- winner line -->
  <rect x="60" y="${h - 220}" width="700" height="60" rx="12" fill="url(#winnerGrad)" opacity="0.18"/>
  <text x="80" y="${h - 178}" font-family="sans-serif" font-weight="800" font-size="40" fill="#ffffff">
    🏆  ${winnerLine}
  </text>

  <!-- loser line -->
  <rect x="60" y="${h - 140}" width="700" height="60" rx="12" fill="#ef4444" opacity="0.10"/>
  <text x="80" y="${h - 98}" font-family="sans-serif" font-weight="800" font-size="40" fill="#fca5a5">
    💀  ${loserLine}
  </text>

  <!-- footer -->
  <text x="60" y="${h - 40}" font-family="sans-serif" font-weight="600" font-size="22" fill="#71717a">
    play.codequest.app — settle it in code.
  </text>
</svg>`;
    }

    /**
     * Captions can run long. Soft-wrap to two lines on a sensible split
     * point so the SVG layout stays readable.
     */
    private firstLine(text: string): string {
        if (text.length <= 32) return text;
        const cut = text.lastIndexOf(' ', 32);
        return cut > 16 ? text.slice(0, cut) : text.slice(0, 32);
    }

    private secondLine(text: string): string {
        if (text.length <= 32) return '';
        const cut = text.lastIndexOf(' ', 32);
        const start = cut > 16 ? cut + 1 : 32;
        const rest = text.slice(start);
        return rest.length > 36 ? rest.slice(0, 33) + '…' : rest;
    }

    private escape(s: string): string {
        return s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
}
