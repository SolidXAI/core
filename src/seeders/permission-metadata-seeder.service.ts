import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { PermissionMetadata } from '../entities/permission-metadata.entity';
import { RoleMetadataService } from '../services/role-metadata.service';

@Injectable()
export class PermissionMetadataSeederService {
  private readonly logger = new Logger(PermissionMetadataSeederService.name);

  constructor(
    @InjectRepository(PermissionMetadata)
    private readonly permissionRepo: Repository<PermissionMetadata>,
    private readonly solidRegistry: SolidRegistry,
    @Inject(forwardRef(() => RoleMetadataService))
    private readonly roleService: RoleMetadataService,
  ) { }

  async seed() {

    const controllers = this.solidRegistry.getControllers();

    // Loop over the countries and create them.
    for (let id = 0; id < controllers.length; id++) {
      try {
        const controller = controllers[id];
        // this.logger.log(`Resolving controller: ${controller.name}`);

        const methods = controller.methods;
        for (let mId = 0; mId < methods.length; mId++) {

          const methodName = methods[mId];
          const permissionName = `${controller.name}.${methodName}`;

          const existingPermission = await this.permissionRepo.findOne({
            where: {
              name: permissionName
            }
          });

          if (existingPermission) {
            this.logger.log(`Permission ${permissionName} already exists.`);
          }
          else {
            this.logger.log(`Permission ${permissionName} does not exist, creating new.`);

            const newPermission = this.permissionRepo.create({
              name: permissionName
            });
            await this.permissionRepo.save(newPermission);

          }
        }

      } catch (error) {
        this.logger.error(error);
      }
    }

    // Associate the Admin role with all existing permissions. 
    await this.roleService.addAllPermissionsToRole("Admin");
  }
}