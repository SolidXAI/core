import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ModuleRef } from "@nestjs/core";
import { InjectEntityManager } from '@nestjs/typeorm';
import { CRUDService } from 'src/services/crud.service';
import { EntityManager, In } from 'typeorm';

import { ERROR_MESSAGES } from 'src/constants/error-messages';
import { PermissionMetadataRepository } from 'src/repository/permission-metadata.repository';
import { RoleMetadataRepository } from 'src/repository/role-metadata.repository';
import { CreateRoleMetadataDto } from '../dtos/create-role-metadata.dto';
import { PermissionMetadata } from '../entities/permission-metadata.entity';
import { RoleMetadata } from '../entities/role-metadata.entity';

@Injectable()
export class RoleMetadataService extends CRUDService<RoleMetadata> {
  private readonly logger = new Logger(RoleMetadataService.name);

  constructor(
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    // @InjectRepository(RoleMetadata, 'default')
    // readonly repo: Repository<RoleMetadata>,
    readonly repo: RoleMetadataRepository,
    // @InjectRepository(PermissionMetadata)
    // private readonly permissionRepository: Repository<PermissionMetadata>,
    readonly permissionRepository: PermissionMetadataRepository,
    readonly moduleRef: ModuleRef

  ) {
    super(entityManager, repo, 'roleMetadata', 'solid-core', moduleRef);
  }

  async findRoleByName(roleName: string) {
    const entity = await this.repo.findOne({
      where: {
        name: roleName
      },
      relations: {
        permissions: true
      }
    });
    if (!entity) {
      throw new NotFoundException(`Entity #${roleName} not found`);
    }
    return entity;
  }

  // OK
  async createRolesIfNotExists(roles: CreateRoleMetadataDto[]) {
    for (let id = 0; id < roles.length; id++) {
      try {
        const roleObj = roles[id];
        // this.logger.log(`Resolving role: ${JSON.stringify(roleObj)}`);

        const existingRole = await this.repo.findOne({
          where: {
            name: roleObj.name,
          },
          relations: {},
        });

        // Create only if not existing already.
        if (!existingRole) {
          this.logger.debug(`Role ${roleObj.name} does not exist, hence creating`);

          let permissions = [];

          if (roleObj.permissions && roleObj.permissions.length > 0) {
            await Promise.all(
              roleObj.permissions.map(permission => this.preloadPermissionByName(permission.name)),
            );
          }

          // const role = this.repo.create({ ...roleObj, permissions });
          const role = this.repo.create({ ...roleObj });
          await this.repo.save(role);
        } else {
          /*
          this.logger.debug(`Role ${roleObj.name} already exists`);
          const existingPermissions = existingRole.permissions.map(permission => permission.name);
          const newPermissions = roleObj.permissions.map(permission => permission.name);
          const permissionsToAdd = newPermissions.filter(permission => !existingPermissions.includes(permission));
          const permissionsToRemove = existingPermissions.filter(permission => !newPermissions.includes(permission));
          this.logger.debug(`Permissions to add: ${JSON.stringify(permissionsToAdd)}`);
          if (permissionsToAdd.length > 0) {
            await this.addPermissionsToRole(roleObj.name, permissionsToAdd);
          }
          this.logger.debug(`Permissions to remove: ${JSON.stringify(permissionsToRemove)}`);
          if (permissionsToRemove.length > 0) {
            await this.removePermissionsFromRole(roleObj.name, permissionsToRemove);
          }
          */
        }
      } catch (error) {
        this.logger.error(error);
      }
    }
  }

  async addAllPermissionsToRole(roleName: string): Promise<RoleMetadata> {
    return await this._addPermissionsToRole(roleName, null);
  }

  async addPermissionsToRole(roleName: string, permissionNames: string[]): Promise<RoleMetadata> {
    return await this._addPermissionsToRole(roleName, permissionNames);
  }

  async addPermissionToRole(roleName: string, permissionName: string[]) {
    return await this._addPermissionsToRole(roleName, permissionName);
  }

  private async _addPermissionsToRole(roleName: string, permissionNames: string[]): Promise<RoleMetadata> {
    const role = await this.repo.findOne({
      where: { name: roleName },
      relations: {
        permissions: true
      }
    });
    if (!role) {
      throw new Error(`Role '${roleName}' not found.`);
    }

    // this.logger.log(`Found role ${roleName}`);

    // The new set of permissions which are to be added to this role.
    let newPermissions: PermissionMetadata[];

    // Load all the specified permissions in the system. 
    if (permissionNames && permissionNames.length != 0) {
      // this.logger.log(`Loading specified permissions.`);

      newPermissions = await this.permissionRepository.find({ where: { name: In(permissionNames) } });
      if (newPermissions.length !== permissionNames.length) {
        throw new Error(`One or more permissions not found.`);
      }
    }
    else {
      // this.logger.log(`Loading all permissions in system.`);

      // Load all permissions in the system. 
      // TODO: Do we want to convert this to a paginated query to avoid having to load a very large permissions table into memory?
      newPermissions = await this.permissionRepository.find();
      if (newPermissions.length == 0) {
        throw new Error(`No permissions configured in the system. Did you forget to run the PermissionSeederService?`);
      }
    }

    // this.logger.log(`Adding ${newPermissions.length} permissions to role ${roleName}.`);

    // if there are already permissions assigned. 
    if (role.permissions && role.permissions.length > 0) {
      for (let i = 0; i < newPermissions.length; i++) {
        const newPermission = newPermissions[i];
        let newPermissionFound = true;
        for (let j = 0; j < role.permissions.length; j++) {
          const existingPermission = role.permissions[j];
          if (existingPermission.name === newPermission.name) {
            newPermissionFound = false;
            break;
          }
        }

        if (newPermissionFound) {
          role.permissions.push(newPermission);
        }
      }

    }
    // else we create a new permissions set. 
    else {
      role.permissions = newPermissions;
    }

    return await this.repo.save(role);
  }

  async removePermissionsFromRole(roleName: string, permissionNames: string[]): Promise<RoleMetadata> {

    // load the role with the respective permissions.
    const role = await this.repo.findOne({
      where: {
        name: roleName
      },
      relations: {
        permissions: true
      }
    });

    if (!role) {
      throw new Error(ERROR_MESSAGES.ROLE_NOT_FOUND(roleName));
    }

    // modify the permissions array.
    role.permissions = role.permissions.filter(permission => !permissionNames.includes(permission.name));

    return await this.repo.save(role);
  }

  private async preloadPermissionByName(name: string): Promise<PermissionMetadata> {
    const existingPermission = await this.permissionRepository.findOne({
      where: { name },
    });
    if (!existingPermission) {
      throw new NotFoundException(ERROR_MESSAGES.PERMISSION_NOT_EXIST(name));
    }
    return existingPermission;
  }


}
