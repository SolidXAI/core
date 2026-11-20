import 'reflect-metadata';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { REQUEST_USER_KEY } from '../constants';
import { AccessTokenGuard } from '../guards/access-token.guard';
import { ApiKeyService } from './api-key.service';
import { AuthenticationService } from './authentication.service';

describe('API key portal sessions', () => {
    const jwt = new JwtService();
    const config = { audience: 'portal-test', issuer: 'portal-test', secret: 'portal-test-secret' };
    const settings = { getConfigValue: (name: string) => config[name] };
    const key = {
        id: 17,
        isActive: true,
        expiresAt: null as Date | null,
        user: { id: 5, active: true, forcePasswordChange: false, username: 'reviewer', roles: [{ name: 'Reviewer' }] },
    };

    function setup() {
        const repo = { findOne: jest.fn().mockResolvedValue(key), update: jest.fn().mockResolvedValue(undefined) };
        const permissions = { findAllUsingRoles: jest.fn().mockResolvedValue([{ name: 'AgentSessionController.listInbox' }]) };
        const refreshTokens = { getCurrentRefreshTokenState: jest.fn() };
        const auth: AuthenticationService = Object.assign(Object.create(AuthenticationService.prototype), {
            jwtService: jwt,
            settingService: settings,
            userRepository: { findOne: jest.fn().mockResolvedValue(key.user) },
            refreshTokenIdsStorage: refreshTokens,
        });
        const service = new ApiKeyService(repo as any, permissions as any, auth, undefined);
        // Passing undefined for the interactive session stores detects accidental use of them.
        const guard = new AccessTokenGuard(jwt, permissions as any, undefined, undefined, settings as any, { set: jest.fn() } as any, service);
        return { auth, guard, repo, service, refreshTokens };
    }

    it('issues an expiring bearer token without creating or exposing a refresh session', async () => {
        const { auth, guard, service, refreshTokens } = setup();
        const session = await service.createPortalSession('host-api-key');
        expect(session).not.toHaveProperty('refreshToken');
        const claims = await jwt.verifyAsync(session.accessToken, config);
        expect(claims).toMatchObject({ sub: key.user.id, portalApiKeyId: key.id, roles: ['Reviewer'] });
        expect(claims.exp - claims.iat).toBe(300);

        const request = { headers: { authorization: `Bearer ${session.accessToken}` } };
        const ctx = { switchToHttp: () => ({ getRequest: () => request }) } as ExecutionContext;
        expect(await guard.canActivate(ctx)).toBe(true);
        expect(request[REQUEST_USER_KEY].permissions).toEqual(['AgentSessionController.listInbox']);
        expect(await auth.me(request[REQUEST_USER_KEY])).toMatchObject({ refreshToken: null });
        expect(refreshTokens.getCurrentRefreshTokenState).not.toHaveBeenCalled();
        await expect(auth.generateSsoCode(request[REQUEST_USER_KEY], session.accessToken)).rejects.toThrow();
    });

    it('rejects revoked keys and inactive accounts both at exchange and during bearer authentication', async () => {
        const { service, repo } = setup();
        for (const record of [
            null,
            { ...key, isActive: false },
            { ...key, expiresAt: new Date(Date.now() - 60_000) },
            { ...key, user: { ...key.user, active: false } },
        ]) {
            repo.findOne.mockResolvedValue(record);
            await expect(service.createPortalSession('host-api-key')).rejects.toBeInstanceOf(UnauthorizedException);
            await expect(service.validatePortalSession(key.id, key.user.id)).rejects.toBeInstanceOf(UnauthorizedException);
        }
    });

    it('caps the bearer lifetime at the API key expiry', async () => {
        const { service, repo } = setup();
        repo.findOne.mockResolvedValue({ ...key, expiresAt: new Date(Date.now() + 45_000) });
        const session = await service.createPortalSession('host-api-key');
        const claims = await jwt.verifyAsync(session.accessToken, config);
        expect(claims.exp - claims.iat).toBeGreaterThan(0);
        expect(claims.exp - claims.iat).toBeLessThanOrEqual(45);
    });
});
