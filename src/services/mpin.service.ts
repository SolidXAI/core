import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { ERROR_MESSAGES } from 'src/constants/error-messages';
import { SUCCESS_MESSAGES } from 'src/constants/success-messages';
import { ChangeMpinDto } from 'src/dtos/change-mpin.dto';
import { MpinLoginDto } from 'src/dtos/mpin-login.dto';
import { SetupMpinDto } from 'src/dtos/setup-mpin.dto';
import { UserDeviceCredential } from 'src/entities/user-device-credential.entity';
import { ActiveUserData } from 'src/interfaces/active-user-data.interface';
import { UserDeviceCredentialRepository } from 'src/repository/user-device-credential.repository';
import { UserRepository } from 'src/repository/user.repository';
import type { SolidCoreSetting } from 'src/services/settings/default-settings-provider.service';
import { AuthenticationService } from './authentication.service';
import { HashingService } from './hashing.service';
import { SettingService } from './setting.service';
import { UserActivityHistoryService } from './user-activity-history.service';

/**
 * The most-chosen PINs in published analyses of breached sets. `1234` alone
 * accounts for roughly a tenth of four-digit choices, so a list this short
 * removes a disproportionate share of guessable values.
 */
const MPIN_DENYLIST = new Set([
    '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
    '1234', '4321', '1212', '2001', '1004', '2000', '6969', '2580',
    '000000', '111111', '123456', '654321', '121212', '112233', '123123',
]);

@Injectable()
export class MpinService {
    private readonly logger = new Logger(MpinService.name);

    constructor(
        private readonly credentialRepository: UserDeviceCredentialRepository,
        private readonly userRepository: UserRepository,
        private readonly hashingService: HashingService,
        private readonly settingService: SettingService,
        private readonly authenticationService: AuthenticationService,
        private readonly userActivityHistoryService: UserActivityHistoryService,
    ) { }

    // ---------------------------------------------------------------- setup

    async setupMpin(activeUser: ActiveUserData, dto: SetupMpinDto) {
        this.assertEnabled();
        this.assertMpinAcceptable(dto.mpin);

        // The account comes from the access token, never from the body - a
        // client can only ever create a credential for the user it is signed
        // in as.
        const user = await this.userRepository.findOne({ where: { id: activeUser.sub } });
        if (!user) {
            throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
        }

        // Lower-cased because @IsUUID is case-insensitive: iOS renders a UUID
        // uppercase (identifierForVendor.uuidString) while Android renders it
        // lowercase, and both validate. Without normalising, the same physical
        // device could present two spellings, miss this exact-match lookup and
        // end up with two credential rows consuming two slots against the cap.
        const deviceId = dto.deviceId.toLowerCase();

        const existing = await this.credentialRepository.findOne({
            where: { user: { id: user.id }, deviceId },
        });

        // Re-running setup on the same device rotates the credential rather
        // than adding a second one.
        const record = existing ?? this.credentialRepository.create({
            user,
            deviceId,
        });

        // Recomputed on every setup so a renamed user does not keep a stale
        // key. It is an identifier for humans and tooling, never a lookup key,
        // so drift here costs nothing operationally.
        record.credentialKey = this.buildCredentialKey(user.username, deviceId);

        const credentialRef = this.mintCredentialRef();
        record.hashedCredentialRef = this.hashCredentialRef(credentialRef);
        record.hashedMpin = await this.hashingService.hash(dto.mpin);
        record.mpinScheme = this.hashingService.name();
        record.mpinSchemeVersion = this.hashingService.currentVersion();
        record.deviceName = dto.deviceName ?? null;
        record.platform = dto.platform ?? null;
        record.isActive = true;
        record.failedAttempts = 0;
        record.lockedUntil = null;

        await this.evictOldestIfAtCap(user.id, existing?.id);
        await this.credentialRepository.save(record);

        // Returned once. Only its SHA-256 is stored, so it can never be
        // re-issued - the client must persist it before reporting success.
        return { credentialRef, message: SUCCESS_MESSAGES.MPIN_SETUP_SUCCESS };
    }

    async changeMpin(activeUser: ActiveUserData, dto: ChangeMpinDto) {
        this.assertEnabled();
        this.assertMpinAcceptable(dto.newMpin);

        // Scoped to the caller, so holding someone else's handle is not enough
        // to change their MPIN.
        const credential = await this.credentialRepository.findOne({
            where: {
                hashedCredentialRef: this.hashCredentialRef(dto.credentialRef),
                user: { id: activeUser.sub },
            },
        });

        if (!credential || !credential.isActive) {
            throw new UnauthorizedException(ERROR_MESSAGES.MPIN_INVALID);
        }
        this.assertNotLocked(credential);

        const matches = await this.hashingService.compare(
            dto.currentMpin,
            credential.hashedMpin,
            credential.mpinSchemeVersion,
        );
        if (!matches) {
            throw await this.registerFailedAttempt(credential);
        }

        // Rotate the handle alongside the MPIN: a changed credential should
        // invalidate anything captured previously.
        const credentialRef = this.mintCredentialRef();
        credential.hashedCredentialRef = this.hashCredentialRef(credentialRef);
        credential.hashedMpin = await this.hashingService.hash(dto.newMpin);
        credential.mpinScheme = this.hashingService.name();
        credential.mpinSchemeVersion = this.hashingService.currentVersion();
        credential.failedAttempts = 0;
        credential.lockedUntil = null;
        await this.credentialRepository.save(credential);

        return { credentialRef, message: SUCCESS_MESSAGES.MPIN_CHANGED_SUCCESS };
    }

    // ---------------------------------------------------------------- login

    async loginWithMpin(dto: MpinLoginDto) {
        this.assertEnabled();

        // A single indexed exact-match lookup. The row already names the user,
        // so there is nothing to resolve and no identifier to enumerate with.
        const credential = await this.credentialRepository.findOne({
            where: { hashedCredentialRef: this.hashCredentialRef(dto.credentialRef) },
            relations: { user: { roles: true } },
        });

        // An unknown handle is reported exactly as a wrong MPIN is.
        if (!credential || !credential.user) {
            throw new UnauthorizedException(ERROR_MESSAGES.MPIN_INVALID);
        }

        // A dead credential is reported as such regardless of what MPIN was
        // supplied. Gating this on a correct MPIN would be marginally more
        // conservative, but it protects almost nothing - "this dead handle was
        // once real" grants no capability - and it costs an asymmetry that
        // reads as a bug: the attempt that causes deactivation reports
        // MPIN_REVOKED, while the very next identical attempt would report
        // MPIN_INVALID. The enumeration resistance that matters comes from the
        // handle being unguessable, not from this branch.
        if (!credential.isActive) {
            throw new UnauthorizedException(ERROR_MESSAGES.MPIN_REVOKED);
        }

        // Checked before the hash comparison, so attempts made during a lockout
        // neither extend it nor cost a bcrypt call.
        this.assertNotLocked(credential);

        const matches = await this.hashingService.compare(
            dto.mpin,
            credential.hashedMpin,
            credential.mpinSchemeVersion,
        );

        if (!matches) {
            throw await this.registerFailedAttempt(credential);
        }

        credential.failedAttempts = 0;
        credential.lockedUntil = null;
        credential.lastUsedAt = new Date();
        if (this.hashingService.needsRehash(credential.hashedMpin, credential.mpinSchemeVersion)) {
            credential.hashedMpin = await this.hashingService.hash(dto.mpin);
            credential.mpinScheme = this.hashingService.name();
            credential.mpinSchemeVersion = this.hashingService.currentVersion();
        }
        await this.credentialRepository.save(credential);

        const user = credential.user;
        await this.userActivityHistoryService.logEvent('login', user);

        // A fresh token pair - never a replay of a stored refresh token. This
        // is what makes MPIN survive logout and refresh-token expiry. The
        // stable deviceId keeps repeat logins in one session bucket.
        const tokens = await this.authenticationService.generateTokens(user, credential.deviceId);

        return {
            user: {
                id: user.id,
                email: user.email,
                mobile: user.mobile,
                username: user.username,
                forcePasswordChange: user.forcePasswordChange,
                roles: (user.roles ?? []).map((role) => role.name),
            },
            ...tokens,
        };
    }

    // ----------------------------------------------------- device management

    async listDevices(activeUser: ActiveUserData) {
        this.assertEnabled();

        const credentials = await this.credentialRepository.find({
            where: { user: { id: activeUser.sub }, isActive: true },
        });

        return credentials
            .sort((a, b) => this.lastUsedMillis(b) - this.lastUsedMillis(a))
            .map((credential) => this.toDeviceView(credential));
    }

    async revokeDevice(activeUser: ActiveUserData, id: number) {
        this.assertEnabled();

        const credential = await this.credentialRepository.findOne({
            where: { id, user: { id: activeUser.sub } },
        });
        if (!credential) {
            throw new NotFoundException(ERROR_MESSAGES.MPIN_CREDENTIAL_NOT_FOUND);
        }

        // Soft-delete. The row survives so a correct MPIN can be answered with
        // MPIN_REVOKED rather than a baffling MPIN_INVALID; only active rows
        // count towards the device cap.
        credential.isActive = false;
        await this.credentialRepository.save(credential);

        return { message: SUCCESS_MESSAGES.MPIN_DEVICE_REVOKED };
    }

    // -------------------------------------------------------------- internals

    /**
     * Never exposes the stored hashes, independently of whatever serialiser
     * configuration a consuming app runs. The entity also withholds them via
     * @Exclude()/@Expose(), but building the response explicitly means a
     * carelessly added decorator cannot leak a credential.
     */
    private toDeviceView(credential: UserDeviceCredential) {
        return {
            id: credential.id,
            deviceId: credential.deviceId,
            deviceName: credential.deviceName,
            platform: credential.platform,
            isActive: credential.isActive,
            failedAttempts: credential.failedAttempts,
            lockedUntil: credential.lockedUntil,
            lastUsedAt: credential.lastUsedAt,
            createdAt: credential.createdAt,
        };
    }

    private assertEnabled(): void {
        if (!this.settingService.getConfigValue<SolidCoreSetting>('mpinEnabled')) {
            // 404 rather than 403: a disabled feature should look absent.
            throw new NotFoundException(ERROR_MESSAGES.MPIN_NOT_ENABLED);
        }
    }

    private assertNotLocked(credential: UserDeviceCredential): void {
        if (credential.lockedUntil && credential.lockedUntil.getTime() > Date.now()) {
            throw new UnauthorizedException(ERROR_MESSAGES.MPIN_LOCKED);
        }
    }

    private assertMpinAcceptable(mpin: string): void {
        const pattern = String(
            this.settingService.getConfigValue<SolidCoreSetting>('mpinRegex') ?? '^\\d{4,6}$',
        );

        // Fails closed. `matches` starts false and a malformed pattern - the
        // setting is admin-editable free text - becomes a rejection rather
        // than a skipped check, so a typo cannot silently let users set an
        // MPIN weaker than policy allows.
        let matches = false;
        try {
            matches = new RegExp(pattern).test(mpin);
        } catch {
            this.logger.error(`Invalid mpinRegex setting: ${pattern}`);
            throw new BadRequestException(ERROR_MESSAGES.MPIN_FORMAT_INVALID);
        }

        if (!matches) {
            throw new BadRequestException(ERROR_MESSAGES.MPIN_FORMAT_INVALID);
        }

        // Predictability is semantics, not shape - a regex expressing "not
        // sequential" would be unreadable and easy to get subtly wrong.
        if (this.isPredictable(mpin)) {
            // Safe to distinguish, and 400 rather than 401: this only ever
            // happens on a bearer-authenticated route, so it is a validation
            // failure rather than an authentication one.
            throw new BadRequestException(ERROR_MESSAGES.MPIN_TOO_PREDICTABLE);
        }
    }

    private isPredictable(mpin: string): boolean {
        if (/^(\d)\1+$/.test(mpin)) {
            return true;
        }
        if (this.isSequential(mpin)) {
            return true;
        }
        return MPIN_DENYLIST.has(mpin);
    }

    private isSequential(mpin: string): boolean {
        let ascending = true;
        let descending = true;
        for (let i = 1; i < mpin.length; i++) {
            const step = mpin.charCodeAt(i) - mpin.charCodeAt(i - 1);
            if (step !== 1) ascending = false;
            if (step !== -1) descending = false;
        }
        return ascending || descending;
    }

    /**
     * Records a failure and escalates. `failedAttempts` is cumulative and
     * resets only on success - never when a lockout expires - which is what
     * makes the second threshold detectable without a separate counter.
     *
     * Returns the exception for the caller to throw, so the save is always
     * awaited before the response leaves.
     */
    private async registerFailedAttempt(
        credential: UserDeviceCredential,
    ): Promise<UnauthorizedException> {
        const lockThreshold = Number(
            this.settingService.getConfigValue<SolidCoreSetting>('mpinMaxFailedAttempts'),
        );
        const deactivateThreshold = Number(
            this.settingService.getConfigValue<SolidCoreSetting>('mpinMaxTotalFailedAttempts'),
        );
        const lockoutSeconds = Number(
            this.settingService.getConfigValue<SolidCoreSetting>('mpinLockoutDuration'),
        );

        credential.failedAttempts += 1;
        let error = new UnauthorizedException(ERROR_MESSAGES.MPIN_INVALID);

        if (credential.isActive && deactivateThreshold > 0 && credential.failedAttempts >= deactivateThreshold) {
            credential.isActive = false;
            credential.lockedUntil = null;
            // This attempt caused the deactivation, so it is reported. The
            // caller reached the limit on a handle they demonstrably hold and
            // caused this state themselves, so nothing is disclosed - and
            // without it they would keep retrying a permanently dead credential.
            error = new UnauthorizedException(ERROR_MESSAGES.MPIN_REVOKED);
        } else if (credential.isActive && lockThreshold > 0 && credential.failedAttempts % lockThreshold === 0) {
            credential.lockedUntil = new Date(Date.now() + lockoutSeconds * 1000);
            error = new UnauthorizedException(ERROR_MESSAGES.MPIN_LOCKED);
        }

        await this.credentialRepository.save(credential);
        return error;
    }

    /**
     * The cap evicts rather than rejects. A reinstall wipes the client's
     * deviceId, so the app generates a new one and setup adds a row instead of
     * replacing the old, orphaned one. Rejecting at the cap would mean a user
     * who reinstalls a few times could never set MPIN up again.
     */
    private async evictOldestIfAtCap(userId: number, excludeId?: number): Promise<void> {
        const cap = Number(
            this.settingService.getConfigValue<SolidCoreSetting>('mpinMaxDevicesPerUser'),
        );
        if (!cap || cap <= 0) {
            return;
        }

        const active = (await this.credentialRepository.find({
            where: { user: { id: userId }, isActive: true },
        })).filter((credential) => credential.id !== excludeId);

        // One slot is about to be taken by the credential being written.
        const overflow = active.length - (cap - 1);
        if (overflow <= 0) {
            return;
        }

        // Sorted in JS rather than SQL because a never-used credential has a
        // null lastUsedAt, and Postgres sorts nulls last on ASC - which would
        // treat the least-used rows as the most recently used.
        const doomed = active
            .sort((a, b) => this.lastUsedMillis(a) - this.lastUsedMillis(b))
            .slice(0, overflow);

        for (const credential of doomed) {
            credential.isActive = false;
        }
        await this.credentialRepository.save(doomed);
        this.logger.log(
            `Evicted ${doomed.length} MPIN credential(s) for user ${userId} at the device cap of ${cap}`,
        );
    }

    private lastUsedMillis(credential: UserDeviceCredential): number {
        return credential.lastUsedAt?.getTime() ?? credential.createdAt?.getTime() ?? 0;
    }

    /**
     * `<username>-<deviceId>`, the model's natural key.
     *
     * Not slugified: lodash `kebabCase` splits digit/letter boundaries, so it
     * would shred a UUID into `3-f-7-b-8-a-10-...`. The username is lower-cased
     * and stripped of whitespace, which is enough for a key that is only ever
     * read, never parsed back into its parts.
     */
    private buildCredentialKey(username: string, deviceId: string): string {
        const normalizedUsername = (username ?? '').trim().toLowerCase().replace(/\s+/g, '-');
        return `${normalizedUsername}-${deviceId}`;
    }

    private mintCredentialRef(): string {
        return randomBytes(32).toString('hex');
    }

    // SHA-256, not bcrypt: 256 bits of randomness has nothing to brute-force,
    // so a slow hash would only add latency to every login. Same reasoning as
    // ApiKeyService.hash.
    private hashCredentialRef(credentialRef: string): string {
        return createHash('sha256').update(credentialRef).digest('hex');
    }
}
