import { OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { SolidRegistry } from 'src/helpers/solid-registry';
export declare class SolidIntrospectService implements OnApplicationBootstrap {
    private readonly discoveryService;
    private readonly reflector;
    private readonly metadataScanner;
    private readonly solidRegistry;
    constructor(discoveryService: DiscoveryService, reflector: Reflector, metadataScanner: MetadataScanner, solidRegistry: SolidRegistry);
    private readonly logger;
    onApplicationBootstrap(): void;
    private isSeeder;
    private isSelectionProvider;
    private isComputedFieldProvider;
    private isSolidDatabaseModule;
    private isModule;
}
