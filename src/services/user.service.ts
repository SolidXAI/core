import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService, ConfigType } from '@nestjs/config';
import { DiscoveryService, ModuleRef } from "@nestjs/core";
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { CrudHelperService } from "src/services/crud-helper.service";
import { CRUDService } from 'src/services/crud.service';
import { FileService } from "src/services/file.service";
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { ModuleMetadataService } from 'src/services/module-metadata.service';
import { EntityManager, Repository } from 'typeorm';


import { OauthUserDto } from '../dtos/oauth-user-dto';
import { RoleMetadata } from '../entities/role-metadata.entity';
import { User } from '../entities/user.entity';
import { ActiveUserData } from '../interfaces/active-user-data.interface';
import { iamConfig } from 'src/config/iam.config';
import { ERROR_MESSAGES } from 'src/constants/error-messages';
import { UserRepository } from 'src/repository/user.repository';

@Injectable()
export class UserService extends CRUDService<User> {
  constructor(
    readonly modelMetadataService: ModelMetadataService,
    readonly moduleMetadataService: ModuleMetadataService,
    readonly configService: ConfigService,
    readonly fileService: FileService,
    readonly discoveryService: DiscoveryService,
    readonly crudHelperService: CrudHelperService,
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    // @InjectRepository(User, 'default')
    readonly repo: UserRepository,
    @InjectRepository(User, 'default')
    readonly nonSecurityRuleAwareRepo : Repository<User>,
    @InjectRepository(RoleMetadata)
    private readonly roleRepository: Repository<RoleMetadata>,
    readonly moduleRef: ModuleRef,
    @Inject(iamConfig.KEY)
    private readonly iamConfiguration: ConfigType<typeof iamConfig>,

  ) {
    super(modelMetadataService, moduleMetadataService, configService, fileService, discoveryService, crudHelperService, entityManager, repo, 'user', 'solid-core', moduleRef);
  }

  override async delete(id: number, solidRequestContext: any = {}) {
    // Prevent user from deleting themselves
    if (solidRequestContext?.activeUser?.sub === id) {
      throw new BadRequestException(ERROR_MESSAGES.DELETE_SELF_NOT_ALLOWED);
    }

    // ✅ Proceed with the default deletion logic
    return super.delete(id, solidRequestContext);
  }

  override async deleteMany(ids: number[], solidRequestContext: any = {}): Promise<any> {
    if (!ids || ids.length === 0) {
      throw new Error(ERROR_MESSAGES.DELETE_IDS_REQUIRED);
    }

    // ❌ If the active user is trying to delete themselves
    if (solidRequestContext?.activeUser?.sub && ids.includes(solidRequestContext.activeUser.id)) {
      throw new BadRequestException(ERROR_MESSAGES.DELETE_SELF_NOT_ALLOWED);
    }

    return super.deleteMany(ids, solidRequestContext);
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

  async updateUser(id: any, updateDto, files, solidRequestContext: any = {}) {
    const user = await this.repo.findOne({
      where: { id: id },
      relations: {
        roles: true
      }
    });
    if (!user) {
      throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
    }
    const roles = updateDto.roles ? updateDto.roles : [];
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
      throw new Error(ERROR_MESSAGES.USER_NOT_FOUND_BY_USERNAME(username));
    }
    const role = await this.roleRepository.findOne({ where: { name: roleName } });
    if (!role) {
      throw new Error(ERROR_MESSAGES.ROLE_NOT_FOUND(roleName));
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
    const user = await this.nonSecurityRuleAwareRepo.findOne({
      where: { username: username },
      relations: { roles: true }
    });

    if (!user) {
      throw new Error(ERROR_MESSAGES.USER_NOT_FOUND_BY_USERNAME(username));
    }

    const roles = await this.roleRepository.find({
      where: roleNames.map(roleName => ({ name: roleName }))
    });

    if (roles.length !== roleNames.length) {
      const foundRoleNames = roles.map(role => role.name);
      const missingRoles = roleNames.filter(roleName => !foundRoleNames.includes(roleName));
      throw new Error(ERROR_MESSAGES.ROLES_NOT_FOUND(missingRoles));
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

    return await this.nonSecurityRuleAwareRepo.save(user);
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
      throw new Error(ERROR_MESSAGES.USER_NOT_FOUND_BY_USERNAME(username));
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
      user.fullName = oauthUserDto.name;
      user.lastLoginProvider = oauthUserDto.provider;
      user.accessCode = oauthUserDto.accessCode;
      user.googleAccessToken = oauthUserDto.accessToken;
      user.googleId = oauthUserDto.providerId;
      user.googleProfilePicture = oauthUserDto.picture;

      const savedUser = await this.repo.save(user);

      // Initialize the user roles
      this.initializeRolesForNewUser([this.iamConfiguration.defaultRole], savedUser);
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

  async initializeRolesForNewUser(roles: string[], user: User) {
    if (!user.id) {
      throw new BadRequestException(ERROR_MESSAGES.USER_MISSING_ID);
    }
    let userRoles = [];
    // Default Internal user role assigned 
    userRoles.push("Internal User");
    if (roles) {
      userRoles = [...userRoles, ...roles];
    }
    userRoles = Array.from(new Set([...userRoles]));
    if (userRoles.length > 0) {
      await this.addRolesToUser(user.username, userRoles);
    }
  }

}
