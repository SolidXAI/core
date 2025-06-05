import { Body, Controller, Get, Logger, Post } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { Public } from 'src/decorators/public.decorator';
import { SolidRegistry } from '../helpers/solid-registry';
import { ApiTags } from '@nestjs/swagger';


@Controller('')
@ApiTags("Common")
export class ServiceController {
    private readonly logger = new Logger(ServiceController.name);

    constructor(
        private readonly solidRegistry: SolidRegistry,
    ) { }

    @Public()
    @Get('ping')
    pingPong() {
        return { pong: 'v1.0.2' };
    }

    @Public()
    @Post('seed')
    async seedData(@Body() seedData: any) {
        const seeder = this.solidRegistry
            .getSeeders()
            .filter((seeder) => seeder.name === seedData.seeder)
            .map((seeder) => seeder.instance)
            .pop();
        if (!seeder) {
            this.logger.error(`Seeder service ${seedData.seeder} not found. Does your service have a seed() method?`);
            return;
        }
        this.logger.log(`Running the seed() method for seeder :${seeder.constructor.name}`);
        await seeder.seed();
        return { message: `seed data for ${seedData.seeder}` };
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
