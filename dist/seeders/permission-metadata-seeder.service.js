"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var PermissionMetadataSeederService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionMetadataSeederService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const solid_registry_1 = require("../helpers/solid-registry");
const permission_metadata_entity_1 = require("../entities/permission-metadata.entity");
const role_metadata_service_1 = require("../services/role-metadata.service");
let PermissionMetadataSeederService = PermissionMetadataSeederService_1 = class PermissionMetadataSeederService {
    constructor(permissionRepo, solidRegistry, roleService) {
        this.permissionRepo = permissionRepo;
        this.solidRegistry = solidRegistry;
        this.roleService = roleService;
        this.logger = new common_1.Logger(PermissionMetadataSeederService_1.name);
    }
    async seed() {
        const controllers = this.solidRegistry.getControllers();
        for (let id = 0; id < controllers.length; id++) {
            try {
                const controller = controllers[id];
                this.logger.log(`Resolving controller: ${controller.name}`);
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
            }
            catch (error) {
                this.logger.error(error);
            }
        }
        await this.roleService.addAllPermissionsToRole("Admin");
    }
};
exports.PermissionMetadataSeederService = PermissionMetadataSeederService;
exports.PermissionMetadataSeederService = PermissionMetadataSeederService = PermissionMetadataSeederService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(permission_metadata_entity_1.PermissionMetadata)),
    __param(2, (0, common_1.Inject)((0, common_1.forwardRef)(() => role_metadata_service_1.RoleMetadataService))),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        solid_registry_1.SolidRegistry,
        role_metadata_service_1.RoleMetadataService])
], PermissionMetadataSeederService);
//# sourceMappingURL=permission-metadata-seeder.service.js.map