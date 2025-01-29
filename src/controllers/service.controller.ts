import { Controller, Get } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { Public } from 'src/decorators/public.decorator';
import { SolidRegistry } from '../helpers/solid-registry';
import { ApiTags } from '@nestjs/swagger';


@Controller('')
@ApiTags("Common")
export class ServiceController {
    constructor(
        private readonly solidRegistry: SolidRegistry,
    ) { }

    @Public()
    @Get('ping')
    pingPong() {
        return { pong: 'v1.0.2' };
    }

    // @Public()
    // @Get('play')
    // play() {
    //     return this.solidRegistry.getControllers();
    // }

    //   //This method identifies a provider as a seeder if it has a seed method i.e duck typing
    //   private isSeeder(provider: InstanceWrapper) {
    //     const { instance } = provider;
    //     if (!instance) return false;

    //     const seedMethod = this.metadataScanner
    //       .getAllMethodNames(Object.getPrototypeOf(instance))
    //       .find((methodName) => methodName === 'seed');
    //     if (!seedMethod) return false;
    //     return true;
    //   }

}
