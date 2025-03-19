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


import { MenuItemMetadata } from '../entities/menu-item-metadata.entity';
import { UpdateMenuItemMetadataDto } from '../dtos/update-menu-item-metadata.dto';
import { ActiveUserData } from 'src/interfaces/active-user-data.interface';
import { ModuleMetadata } from '../entities/module-metadata.entity';
import { dasherize } from '@angular-devkit/core/src/utils/strings';

@Injectable()
export class MenuItemMetadataService extends CRUDService<MenuItemMetadata> {
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
    @InjectRepository(MenuItemMetadata, 'default')
    readonly repo: Repository<MenuItemMetadata>,
  ) {
    super(modelMetadataService, moduleMetadataService, mediaStorageProviderService, configService, fileService, mediaService, discoveryService, crudHelperService, entityManager, repo, 'menuItemMetadata', 'app-builder');
  }


  async findOneByUserKey(name: string, relations = {}) {
    const entity = await this.repo.findOne({
      where: {
        name: name,
      },
      relations: relations,
    });
    return entity;
  }

  async upsert(updateSolidMenuItemDto: UpdateMenuItemMetadataDto) {
    // Leave out all the extra attributes only keep the ones we are interested in updating.
    const { moduleUserKey, parentMenuItemUserKey, actionUserKey, rolesIds, rolesCommand, ...cleanUpdateSolidMenuItemDto } = updateSolidMenuItemDto;

    // First check if module already exists using name
    const existingMenuItem = await this.repo.findOne({
      where: {
        name: updateSolidMenuItemDto.name
      },
      relations: ["roles"]
    });

    // if found
    if (existingMenuItem) {
      const updatedSolidActionDto = { ...existingMenuItem, ...cleanUpdateSolidMenuItemDto };
      // @ts-ignore
      return this.repo.save(updatedSolidActionDto);
      // await this.repo.remove(existingSolidAction);
    }
    // if not found - create new 
    else {
      // @ts-ignore
      const moduleMetadata = this.repo.create(cleanUpdateSolidMenuItemDto);
      return this.repo.save(moduleMetadata);
    }
    // const moduleMetadata = this.repo.create(updateSolidMenuItemDto);
    // return this.repo.save(moduleMetadata);

  }


  async findUserMenus(activeUser: ActiveUserData) {
    // 1. For the users role, fire a query to load all menus that this role has access to. 
    // const usersMenuItems = this.solidMenuItemRepo.find({
    //     where: {
    //         roles: {
    //             name: In(activeUser.roles)
    //         }
    //     },
    //     relations: ['module', 'parentMenuItem', 'action']
    // });
    const menuItems = await this.repo
      .createQueryBuilder('menuItem')
      .leftJoinAndSelect('menuItem.module', 'module')
      .leftJoinAndSelect('menuItem.parentMenuItem', 'parentMenuItem')
      .leftJoinAndSelect('menuItem.action', 'action')
      .leftJoinAndSelect('action.model', 'model') // Join the model relation of action
      .leftJoinAndSelect('action.view', 'view') // Join the model relation of action
      .leftJoinAndSelect('menuItem.roles', 'roles')
      .where('roles.name IN (:...roleNames)', { roleNames: activeUser.roles })
      .addOrderBy('module.menuSequenceNumber', 'ASC')
      .addOrderBy('menuItem.sequenceNumber', 'ASC')
      .getMany();

    // 2. First arrange the output of the above query by module based on module
    const modulesToMenuItemsMap = new Map<string, MenuItemMetadata[]>();
    const modulesMap = new Map<string, ModuleMetadata>();
    menuItems.forEach(menuItem => {
      const moduleName = menuItem.module.name;

      // Keep track of all menu items under a given module.
      if (!modulesToMenuItemsMap.has(moduleName)) {
        modulesToMenuItemsMap.set(moduleName, []);
      }
      modulesToMenuItemsMap.get(moduleName).push(menuItem);

      // Keep track of the modules information separately.
      if (!modulesMap.has(moduleName)) {
        modulesMap.set(moduleName, menuItem.module);
      }
    });

    // 3. Then for each module, do a recursive compilation of children based on parentMenuItem, while doing this use the relation - action to get hold of the path. 
    const menu: any[] = [];

    modulesToMenuItemsMap.forEach((menuItems, moduleName) => {
      const rootMenuItems = menuItems.filter(item => !item.parentMenuItem);
      const moduleMetadata = modulesMap.get(moduleName);

      const moduleMenu = {
        title: moduleMetadata.displayName,
        // No need for path the module level.
        // path: ``,
        key: moduleName.toLowerCase().replace(/\s+/g, '-'),
        // TODO: We need to add the module icon as part of the metadata so it can be brought here. 
        // icon: `/images/menu/${moduleName.toLowerCase().replace(/\s+/g, '-')}.svg`,
        children: this.buildMenuTree(rootMenuItems, menuItems, activeUser),
        icon: moduleMetadata.menuIconUrl,
      };

      menu.push(moduleMenu);
    });

    return menu.filter(m => m.children.length > 0);
  }

  // Recursive function to build the tree
  private buildMenuTree(rootItems: MenuItemMetadata[], allMenuItems: MenuItemMetadata[], activeUser: ActiveUserData): any[] {
    const menuItemsData = rootItems.map(rootItem => {
      const allowedMenuItems = allMenuItems.filter(i => {
        if (!i.parentMenuItem) {
          return true
        } else {
          return this.crudHelperService.hasReadPermissionOnModel(activeUser, i.action.model.singularName)
        }
      });
      // Get immediate children of the current loop variable menuItem.
      const children = allowedMenuItems.filter(item => item.parentMenuItem && item.parentMenuItem.id === rootItem.id);

      // TODO: We should specify path only if there are no more children present. 
      // For now adding path everywhere. 
      let path = '';

      if (rootItem.action && rootItem.action.type === 'custom') {
        path = rootItem.action.customComponent;
      }
      if (rootItem.action && rootItem.action.type === 'solid') {
        if (this.crudHelperService.hasReadPermissionOnModel(activeUser, rootItem.action.model.singularName)) {


          // TODO: Here we are assuming that we will always take the user to collection view of a model. 
          // We can make provision to take them other views also in the future. 
          // path = `/admin/core/${rootItem.module.name}/${rootItem.action.model.singularName}/${rootItem.action.view.name}`;
          path = `/admin/core/${rootItem.module.name}/${dasherize(rootItem.action.model.singularName)}/${rootItem.action.view.type}`;
        }
      }

      // We are not checking for empty path coz, this is required for parent menu items.
      const data = {
        title: rootItem.displayName || rootItem.name,
        path: path,
        key: rootItem.name.toLowerCase().replace(/\s+/g, '-'),
      }
      if (children.length > 0) {
        data["children"] = this.buildMenuTree(children, allMenuItems, activeUser);
      }
      return data;

    });
    return menuItemsData.filter(mi => mi && mi)
  }


}
