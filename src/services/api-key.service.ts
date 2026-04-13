import {
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { CreateApiKeyDto } from 'src/dtos/create-api-key.dto';
import { UpdateApiKeyDto } from 'src/dtos/update-api-key.dto';
import { UserApiKey } from 'src/entities/user-api-key.entity';
import { User } from 'src/entities/user.entity';
import { ActiveUserData } from 'src/interfaces/active-user-data.interface';
import { PermissionMetadataService } from 'src/services/permission-metadata.service';
import { Repository } from 'typeorm';

@Injectable()
export class ApiKeyService {
    private readonly logger = new Logger(ApiKeyService.name);

    constructor(
        @InjectRepository(UserApiKey)
        private readonly apiKeyRepository: Repository<UserApiKey>,
        private readonly permissionMetadataService: PermissionMetadataService,
    ) {}

    async generate(userId: number, dto: CreateApiKeyDto): Promise<{ apiKey: string; record: UserApiKey }> {
        const user = await this.apiKeyRepository.manager.findOne(User, {
            where: { id: userId },
            select: ['id', 'isAllowedToGenerateApiKeys'],
        });

        if (!user?.isAllowedToGenerateApiKeys) {
            throw new ForbiddenException('You are not allowed to generate API keys');
        }

        const rawKey = 'sldx_' + randomBytes(32).toString('hex');
        const hashedKey = this.hash(rawKey);
        const maskedKey = 'sldx_****' + rawKey.slice(-4);

        const record = this.apiKeyRepository.create({
            name: dto.name,
            hashedKey,
            maskedKey,
            isActive: true,
            expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
            user,
        });

        await this.apiKeyRepository.save(record);

        // Strip hashedKey from the returned record — maskedKey is all the UI needs
        delete (record as any).hashedKey;

        return { apiKey: rawKey, record };
    }

    async validate(rawKey: string): Promise<ActiveUserData> {
        const hashedKey = this.hash(rawKey);

        const keyRecord = await this.apiKeyRepository.findOne({
            where: { hashedKey, isActive: true },
            relations: ['user', 'user.roles'],
        });

        if (!keyRecord) {
            throw new UnauthorizedException();
        }

        if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
            throw new UnauthorizedException('API key expired');
        }

        // Update lastUsedAt without blocking the request
        this.apiKeyRepository.update(keyRecord.id, { lastUsedAt: new Date() }).catch((err) => {
            this.logger.warn(`Failed to update lastUsedAt for key ${keyRecord.id}: ${err.message}`);
        });

        const roles = (keyRecord.user.roles ?? []).map((r) => r.name);
        const permissions = await this.permissionMetadataService.findAllUsingRoles(roles);

        return {
            sub: keyRecord.user.id,
            username: keyRecord.user.username,
            email: keyRecord.user.email,
            roles,
            permissions: permissions.map((p) => p.name),
        };
    }

    async updateKey(id: number, userId: number, dto: UpdateApiKeyDto): Promise<void> {
        const keyRecord = await this.apiKeyRepository.findOne({
            where: { id, user: { id: userId } },
        });

        if (!keyRecord) {
            throw new NotFoundException('API key not found');
        }

        await this.apiKeyRepository.update(id, { isActive: dto.isActive });
    }

    private hash(rawKey: string): string {
        return createHash('sha256').update(rawKey).digest('hex');
    }
}
