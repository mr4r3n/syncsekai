import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SiteLinkKind } from '@prisma/client';
import { reencodeSquareImage } from '../../common/security/image-file';
import { normalizeLinkTarget, normalizeLinkText } from '../../common/security/external-links';
import { SOCIAL_NETWORKS, findNetwork } from '../../common/security/social-networks';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/** Footer links: social networks and recommended sites. */
@Injectable()
export class SiteLinksService {
  private readonly logger = new Logger(SiteLinksService.name);

  constructor(
    private prisma: PrismaService,
  ) {}

  /** Folder where recommended site logos land. */
  private get linkLogosDir() {
    return path.join(process.cwd(), 'uploads', 'site-links');
  }

  /** Every link, enabled or not. Only the panel sees this. */
  async listLinks() {
    return this.prisma.siteLink.findMany({
      orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /** Catalog of networks offered in the panel dropdown. */
  listSocialNetworks() {
    return SOCIAL_NETWORKS;
  }

  /**
   * Validates the body coming from the form.
   *
   * The URL is the sensitive field: it ends up in the `href` of a link that
   * everyone who opens the landing page sees, so it goes through the list of
   * accepted schemes, not through a "looks like an address" check.
   */
  private validateLink(body: any, requireAll: boolean) {
    const data: any = {};

    if (body?.url !== undefined || requireAll) {
      const url = normalizeLinkTarget(body?.url);
      if (!url) {
        throw new BadRequestException(
          'The address is not valid. It must start with https:// or be an email.',
        );
      }
      data.url = url;
    }

    // For a social network, the name and icon come from the catalog, not the
    // form: that way there is no way to end up with a "Discord" pointing at an
    // arbitrary icon, or with an image path chosen by the client.
    const isSocial =
      body?.kind === SiteLinkKind.SOCIAL || (!body?.kind && body?.provider !== undefined);
    if (isSocial && body?.provider !== undefined) {
      const network = findNetwork(body.provider);
      if (!network) throw new BadRequestException('That social network is not in the catalog.');
      data.provider = network.id;
      data.label = network.label;
      data.iconUrl = network.icon;
    }

    if (data.label === undefined && (body?.label !== undefined || requireAll)) {
      const label = normalizeLinkText(body?.label, 60);
      if (!label) throw new BadRequestException('The name cannot be empty.');
      data.label = label;
    }

    // The description can be cleared on purpose: an empty string is sent.
    if (body?.description !== undefined) {
      data.description = normalizeLinkText(body.description, 160);
    }
    if (body?.descriptionEs !== undefined) {
      data.descriptionEs = normalizeLinkText(body.descriptionEs, 160);
    }

    if (body?.kind !== undefined || requireAll) {
      if (body?.kind !== SiteLinkKind.SOCIAL && body?.kind !== SiteLinkKind.FRIEND) {
        throw new BadRequestException('Unrecognized link type.');
      }
      data.kind = body.kind;
    }

    if (body?.isEnabled !== undefined) data.isEnabled = Boolean(body.isEnabled);
    if (body?.sortOrder !== undefined) {
      const order = Number(body.sortOrder);
      data.sortOrder = Number.isFinite(order) ? Math.trunc(order) : 0;
    }

    // The logo is not accepted as free text: only the upload can set it,
    // since it is what knows which file it just wrote to disk.
    if (body?.iconUrl === null) data.iconUrl = null;

    return data;
  }

  async createLink(body: any) {
    if (body?.kind === SiteLinkKind.SOCIAL && !findNetwork(body?.provider)) {
      throw new BadRequestException('Pick a social network from the list.');
    }
    const data = this.validateLink(body, true);

    // At the end of its group, which is where one expects new items to appear.
    if (data.sortOrder === undefined) {
      const last = await this.prisma.siteLink.findFirst({
        where: { kind: data.kind },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
      data.sortOrder = (last?.sortOrder ?? -1) + 1;
    }

    await this.prisma.siteLink.create({ data: data });
    return this.listLinks();
  }

  async updateLink(id: string, body: any) {
    const existing = await this.prisma.siteLink.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('That link no longer exists.');

    await this.prisma.siteLink.update({
      where: { id },
      data: this.validateLink(body, false),
    });
    return this.listLinks();
  }

  async deleteLink(id: string) {
    const existing = await this.prisma.siteLink.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('That link no longer exists.');

    await this.prisma.siteLink.delete({ where: { id } });
    this.deleteLinkLogo(existing.iconUrl);
    return this.listLinks();
  }

  /**
   * Uploads the logo of a recommended site.
   *
   * It goes through the same pipeline as avatars: header-byte check and
   * re-encoding with sharp. It is a file uploaded by an administrator, but an
   * administrator can also open a .png that is not one.
   */
  async uploadLinkLogo(id: string, fileBuffer: Buffer) {
    const existing = await this.prisma.siteLink.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('That link no longer exists.');

    if (!fs.existsSync(this.linkLogosDir)) {
      fs.mkdirSync(this.linkLogosDir, { recursive: true });
    }

    const file = `link_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.webp`;
    await reencodeSquareImage(fileBuffer, path.join(this.linkLogosDir, file), 128);

    await this.prisma.siteLink.update({
      where: { id },
      data: { iconUrl: `/api/setup/site-link-icon/${file}` },
    });

    // Nothing references the previous one anymore.
    this.deleteLinkLogo(existing.iconUrl);
    return this.listLinks();
  }

  private deleteLinkLogo(iconUrl: string | null) {
    if (!iconUrl || !iconUrl.startsWith('/api/setup/site-link-icon/')) return;
    try {
      const onDisk = path.join(this.linkLogosDir, path.basename(iconUrl));
      if (fs.existsSync(onDisk)) fs.unlinkSync(onDisk);
    } catch (err: any) {
      this.logger.warn(`Could not delete logo ${iconUrl}: ${err.message}`);
    }
  }
}
