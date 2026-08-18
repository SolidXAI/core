import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ActiveUser } from '../decorators/active-user.decorator';
import { ActiveUserData } from '../interfaces/active-user-data.interface';
import { ResolveSecretsDto } from '../dtos/resolve-secrets.dto';
import { WorkflowSecretService } from '../services/workflow-secret.service';

/**
 * The one endpoint that returns secret plaintext, for callers that run outside the
 * process and cannot use the in-process resolver — MCP probes, external runners.
 *
 * Deliberately separate from WorkflowSecretController, which masks every value it
 * returns. Keeping them apart preserves that invariant on the admin surface and, since
 * PermissionsGuard derives permissions as `ControllerName.methodName`, makes this
 * capability grantable on its own rather than riding along with CRUD access.
 *
 * The permission `SecretResolutionController.resolve` is registered on seed and is
 * default-deny. Granting it allows reading *any* secret in the store, so it belongs on
 * a dedicated role held by service accounts, not on human operator roles.
 */
@ApiTags('Solid Core')
@Controller('secret-resolution')
export class SecretResolutionController {
    constructor(private readonly workflowSecretService: WorkflowSecretService) { }

    @ApiBearerAuth("jwt")
    @ApiOperation({
        summary: 'Resolve secrets to plaintext',
        description:
            'Returns decrypted values for the named keys. POST rather than GET so keys stay out of URLs, access logs and intermediary caches. Throws if any key is unknown, inactive, or undecryptable — partial results are never returned.',
    })
    @Post('resolve')
    resolve(@Body() dto: ResolveSecretsDto, @ActiveUser() activeUser: ActiveUserData) {
        return this.workflowSecretService.resolveForActor(dto.keys, activeUser);
    }
}
