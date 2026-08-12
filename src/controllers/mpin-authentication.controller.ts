import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActiveUser } from '../decorators/active-user.decorator';
import { Public } from '../decorators/public.decorator';
import { ChangeMpinDto } from '../dtos/change-mpin.dto';
import { MpinLoginDto } from '../dtos/mpin-login.dto';
import { SetupMpinDto } from '../dtos/setup-mpin.dto';
import { ActiveUserData } from '../interfaces/active-user-data.interface';
import { MpinService } from '../services/mpin.service';

/**
 * There is deliberately no public "is MPIN set up for this identifier" route.
 * That would reintroduce exactly the user-enumeration oracle the opaque
 * credential handle removes. The client decides whether to show the MPIN
 * screen from the presence of its own stored handle.
 */
@Controller('iam/mpin')
@ApiTags('Solid Core')
export class MpinAuthenticationController {
    constructor(private readonly mpinService: MpinService) { }

    @ApiBearerAuth('jwt')
    @Post('setup')
    @HttpCode(HttpStatus.OK)
    setup(
        @Body() setupMpinDto: SetupMpinDto,
        @ActiveUser() activeUser: ActiveUserData,
    ) {
        return this.mpinService.setupMpin(activeUser, setupMpinDto);
    }

    @ApiBearerAuth('jwt')
    @Post('change')
    @HttpCode(HttpStatus.OK)
    change(
        @Body() changeMpinDto: ChangeMpinDto,
        @ActiveUser() activeUser: ActiveUserData,
    ) {
        return this.mpinService.changeMpin(activeUser, changeMpinDto);
    }

    // Public by necessity - the caller has no session yet. The credential
    // handle is unguessable, so this carries no enumeration surface.
    @Public()
    @Post('login')
    @HttpCode(HttpStatus.OK)
    login(@Body() mpinLoginDto: MpinLoginDto) {
        return this.mpinService.loginWithMpin(mpinLoginDto);
    }

    @ApiBearerAuth('jwt')
    @Get('devices')
    listDevices(@ActiveUser() activeUser: ActiveUserData) {
        return this.mpinService.listDevices(activeUser);
    }

    // By row id, never by credential handle, so the management UI never has to
    // hold the secret.
    @ApiBearerAuth('jwt')
    @Delete('devices/:id')
    revokeDevice(
        @Param('id', ParseIntPipe) id: number,
        @ActiveUser() activeUser: ActiveUserData,
    ) {
        return this.mpinService.revokeDevice(activeUser, id);
    }
}
