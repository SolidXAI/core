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
  private readonly permissionAssignmentBatchSize = 500;

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

  async assertRoleExistsByName(roleName: string): Promise<void> {
    const entity = await this.repo.findOne({
      where: {
        name: roleName
      },
      select: {
        id: true
      }
    });
    if (!entity) {
      throw new NotFoundException(`Entity #${roleName} not found`);
    }
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
      } catch (error: any) {
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
      select: {
        id: true,
        name: true,
      }
    });
    if (!role) {
      throw new Error(`Role '${roleName}' not found.`);
    }

    const joinInfo = this.getRolePermissionJoinInfo();
    const targetPermissions = await this.loadTargetPermissions(permissionNames);

    if (!permissionNames || permissionNames.length === 0) {
      await this.entityManager
        .createQueryBuilder()
        .delete()
        .from(joinInfo.tableName)
        .where(`${joinInfo.roleIdColumn} = :roleId`, { roleId: role.id })
        .execute();

      await this.insertRolePermissionMappings(role.id, targetPermissions.map((permission) => permission.id), joinInfo);
    }
    else {
      const existingRows = await this.entityManager
        .createQueryBuilder()
        .select(joinInfo.permissionIdColumn, 'permissionId')
        .from(joinInfo.tableName, 'role_permission')
        .where(`${joinInfo.roleIdColumn} = :roleId`, { roleId: role.id })
        .getRawMany();

      const existingPermissionIds = new Set(existingRows.map((row) => Number(row.permissionId)));
      const missingPermissionIds = targetPermissions
        .map((permission) => permission.id)
        .filter((permissionId) => !existingPermissionIds.has(permissionId));

      if (missingPermissionIds.length > 0) {
        await this.insertRolePermissionMappings(role.id, missingPermissionIds, joinInfo);
      }
    }

    return await this.findRoleByName(roleName);
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

  private async loadTargetPermissions(permissionNames: string[] | null): Promise<PermissionMetadata[]> {
    if (permissionNames && permissionNames.length !== 0) {
      const uniquePermissionNames = [...new Set(permissionNames)];
      const permissions = await this.permissionRepository.find({ where: { name: In(uniquePermissionNames) } });
      if (permissions.length !== uniquePermissionNames.length) {
        throw new Error(`One or more permissions not found.`);
      }
      return permissions;
    }

    const permissions = await this.permissionRepository.find();
    if (permissions.length === 0) {
      throw new Error(`No permissions configured in the system. Did you forget to run the PermissionSeederService?`);
    }
    return permissions;
  }

  private getRolePermissionJoinInfo(): { tableName: string; roleIdColumn: string; permissionIdColumn: string } {
    const relation = this.repo.metadata.relations.find((candidate) => candidate.propertyName === 'permissions');
    if (!relation?.junctionEntityMetadata) {
      throw new Error('Role-permission join table metadata not found.');
    }

    const roleIdColumn = relation.joinColumns[0]?.databaseName;
    const permissionIdColumn = relation.inverseJoinColumns[0]?.databaseName;
    if (!roleIdColumn || !permissionIdColumn) {
      throw new Error('Role-permission join table column metadata not found.');
    }

    return {
      tableName: relation.junctionEntityMetadata.tableName,
      roleIdColumn,
      permissionIdColumn,
    };
  }

  private async insertRolePermissionMappings(
    roleId: number,
    permissionIds: number[],
    joinInfo: { tableName: string; roleIdColumn: string; permissionIdColumn: string },
  ): Promise<void> {
    for (let index = 0; index < permissionIds.length; index += this.permissionAssignmentBatchSize) {
      const batch = permissionIds.slice(index, index + this.permissionAssignmentBatchSize);
      await this.entityManager
        .createQueryBuilder()
        .insert()
        .into(joinInfo.tableName)
        .values(
          batch.map((permissionId) => ({
            [joinInfo.roleIdColumn]: roleId,
            [joinInfo.permissionIdColumn]: permissionId,
          })),
        )
        .execute();
    }
  }


}
