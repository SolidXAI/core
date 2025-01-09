import { Repository } from 'typeorm';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { PermissionMetadata } from '../entities/permission-metadata.entity';
import { RoleMetadataService } from '../services/role-metadata.service';
export declare class PermissionMetadataSeederService {
    private readonly permissionRepo;
    private readonly solidRegistry;
    private readonly roleService;
    private readonly logger;
    constructor(permissionRepo: Repository<PermissionMetadata>, solidRegistry: SolidRegistry, roleService: RoleMetadataService);
    seed(): Promise<void>;
}
