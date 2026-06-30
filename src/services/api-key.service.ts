import {
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { ERROR_MESSAGES } from 'src/constants/error-messages';
import { CreateApiKeyDto } from 'src/dtos/create-api-key.dto';
import { UpdateApiKeyDto } from 'src/dtos/update-api-key.dto';
import { UserApiKey } from 'src/entities/user-api-key.entity';
import { User } from 'src/entities/user.entity';
import { ActiveUserData } from 'src/interfaces/active-user-data.interface';
import { UserApiKeyRepository } from 'src/repository/user-api-key.repository';
import { PermissionMetadataService } from 'src/services/permission-metadata.service';
import { AuthenticationService } from './authentication.service';
import { UserRepository } from 'src/repository/user.repository';

@Injectable()
export class ApiKeyService {
    private readonly logger = new Logger(ApiKeyService.name);

    constructor(
        private readonly apiKeyRepository: UserApiKeyRepository,
        private readonly permissionMetadataService: PermissionMetadataService,
        private readonly authenticationService: AuthenticationService,
        private readonly userRepository: UserRepository,
    ) { }

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

        // Bypass security rules for auth validation — must find the key regardless of caller context
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

        // Fire-and-forget — does not need security rule context
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

        await this.apiKeyRepository.manager
            .createQueryBuilder()
            .update(UserApiKey)
            .set({ isActive: dto.isActive })
            .where('id = :id', { id })
            .execute();
    }


    async apiKeyMe(apiKey: string) {

        const hasedKey = this.hash(apiKey);
        const apiKeyRecord = await this.apiKeyRepository.findOne({
            where: {
                hashedKey: hasedKey,
            },
            relations: {
                user: {
                    roles: true
                }
            }
        });

        if (!apiKeyRecord) {
            throw new UnauthorizedException(ERROR_MESSAGES.INVALID_CREDENTIALS);
        }

        const user = apiKeyRecord.user;

        const tokens = await this.authenticationService.generateTokens(user);


        return {
            user: {
                email: user.email,
                mobile: user.mobile,
                username: user.username,
                forcePasswordChange: user.forcePasswordChange,
                id: user.id,
                roles: user.roles.map((role) => role.name)
            },
            ...tokens
        }
    }

    private hash(rawKey: string): string {
        return createHash('sha256').update(rawKey).digest('hex');
    }
}
