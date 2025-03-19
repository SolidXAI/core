import { Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { DiscoveryService } from "@nestjs/core";
import { EntityManager, Repository } from 'typeorm';
import { CRUDService } from 'src/services/crud.service';
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { ModuleMetadataService } from 'src/services/module-metadata.service';
import { MediaStorageProviderMetadataService } from 'src/services/media-storage-provider-metadata.service';
import { ConfigService } from '@nestjs/config';
import { MediaService } from "src/services/media.service";
import { FileService } from "src/services/file.service";
import { CrudHelperService } from "src/services/crud-helper.service";


import { User } from '../entities/user.entity';
import { OauthUserDto } from '../dtos/oauth-user-dto';
import { RoleMetadata } from '../entities/role-metadata.entity';
import { ActiveUserData } from '../interfaces/active-user-data.interface';
import { classify } from '@angular-devkit/core/src/utils/strings';

@Injectable()
export class UserService extends CRUDService<User> {
  constructor(
    readonly modelMetadataService: ModelMetadataService,
    readonly moduleMetadataService: ModuleMetadataService,
    readonly mediaStorageProviderService: MediaStorageProviderMetadataService,
    readonly configService: ConfigService,
    readonly fileService: FileService,
    readonly mediaService: MediaService,
    readonly discoveryService: DiscoveryService,
    readonly crudHelperService: CrudHelperService,
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    @InjectRepository(User, 'default')
    readonly repo: Repository<User>,
    @InjectRepository(RoleMetadata)
    private readonly roleRepository: Repository<RoleMetadata>,
  ) {
    super(modelMetadataService, moduleMetadataService, mediaStorageProviderService, configService, fileService, mediaService, discoveryService, crudHelperService, entityManager, repo, 'user', 'solid-core');
  }


  async findOneByEmail(email: string): Promise<User> {
    return await this.repo.findOne({
      where: {
        email: email
      },
      relations: {}
    });
    // if (!entity) {
    //     throw new NotFoundException(`user with email #${email} not found`);
    // }
    // return entity;
  }

  async findOneByAccessCode(accessCode: string): Promise<User> {
    return await this.repo.findOne({
      where: {
        accessCode: accessCode
      },
      relations: {}
    });
  }

  async findOneByUsername(username: string): Promise<User> {
    return await this.repo.findOne({
      where: {
        username: username
      },
      relations: {}
    });
    // if (!entity) {
    //     throw new NotFoundException(`user with username ${username} not found`);
    // }
    // return entity;
  }

  async updateUser(id: any, updateDto, files,solidRequestContext :any = {}) {
    const user = await this.repo.findOne({
      where: { id: id },
      relations: {
        roles: true
      }
    });
    if (!user) {
      throw new Error(`User not found.`);
    }
    const roles  = updateDto.roles ? updateDto.roles :[]; 
    await this.addRolesToUser(user.username, roles);
    await this.update(id, updateDto, files, true);
  }

  async addRoleToUser(username: string, roleName: string): Promise<User> {
    // Find the role, find the user and populate the many 2 many table.
    const user = await this.repo.findOne({
      where: { username: username },
      relations: {
        roles: true
      }
    });
    if (!user) {
      throw new Error(`User with username '${username}' not found.`);
    }
    const role = await this.roleRepository.findOne({ where: { name: roleName } });
    if (!role) {
      throw new Error(`Role '${roleName}' not found.`);
    }

    if (user.roles && user.roles.length > 0) {
      user.roles.push(role);
    }
    else {
      user.roles = [role];
    }

    return await this.repo.save(user);
  }

  async addRolesToUser(username: string, roleNames: string[]): Promise<User> {
    const user = await this.repo.findOne({
      where: { username: username },
      relations: { roles: true }
    });

    if (!user) {
      throw new Error(`User with username '${username}' not found.`);
    }

    const roles = await this.roleRepository.find({
      where: roleNames.map(roleName => ({ name: roleName }))
    });

    if (roles.length !== roleNames.length) {
      const foundRoleNames = roles.map(role => role.name);
      const missingRoles = roleNames.filter(roleName => !foundRoleNames.includes(roleName));
      throw new Error(`The following roles were not found: ${missingRoles.join(', ')}`);
    }

    const currentRoles = user.roles.map(role => role.name);

    const rolesToAdd = roles.filter(role => !currentRoles.includes(role.name));

    const rolesToRemove = user.roles.filter(role => !roleNames.includes(role.name));

    if (rolesToAdd.length > 0) {
      user.roles.push(...rolesToAdd);
    }

    if (rolesToRemove.length > 0) {
      user.roles = user.roles.filter(role => !rolesToRemove.includes(role));
    }

    return await this.repo.save(user);
  }


  async removeRoleFromUser(username: string, roleName: string): Promise<User> {

    // load the role with the respective permissions.
    const user = await this.repo.findOne({
      where: {
        username: username
      },
      relations: {
        roles: true
      }
    });

    if (!user) {
      throw new Error(`User with username '${username}' not found.`);
    }

    // modify the permissions array.
    user.roles = user.roles.filter(role => role.name !== roleName);

    return await this.repo.save(user);
  }

  // PROVIDER SPECIFIC CODE
  async resolveUserOnOauthGoogle(oauthUserDto: OauthUserDto): Promise<User> {
    const user = await this.repo.findOne({
      where: {
        email: oauthUserDto.email,
      },
      relations: {
        roles: true
      }
    });

    // if we are unable to find a user then we need to create one. 
    if (!user) {
      const user = new User();
      user.username = oauthUserDto.email;
      user.email = oauthUserDto.email;
      user.lastLoginProvider = oauthUserDto.provider;
      user.accessCode = oauthUserDto.accessCode;
      user.googleAccessToken = oauthUserDto.accessToken;
      user.googleId = oauthUserDto.providerId;
      user.googleProfilePicture = oauthUserDto.picture;

      return await this.repo.save(user);
    }
    // else we update the user and store the generated code & access token. 
    else {
      const entity = await this.repo.preload({
        id: user.id,
        lastLoginProvider: oauthUserDto.provider,
        accessCode: oauthUserDto.accessCode,
        googleAccessToken: oauthUserDto.accessToken,
        googleId: oauthUserDto.providerId,
        googleProfilePicture: oauthUserDto.picture,
      });

      await this.repo.save(entity);
    }

    return user;
  }

  async findUsersByRole(roleName: string, relations: any = {}): Promise<User[]> {
    return await this.repo.find({
      where: {
        roles: {
          name: roleName
        }
      },
      relations: relations
    });
  }

  async checkIfPermissionExists(query: any, activeUser: ActiveUserData) {

    const matchingPermssions = activeUser.permissions.filter((p) => query.permissionNames.includes(p));
    return matchingPermssions
  }
}
