import { UserService } from '../services/user.service';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { MutateUserRolesDto } from '../dtos/mutate-user-roles.dto';
import { MutateUserRolesBulkDto } from '../dtos/mutate-user-roles-list.dto';
import { ActiveUserData } from '../interfaces/active-user-data.interface';
export declare class UserController {
    private readonly service;
    constructor(service: UserService);
    create(createDto: CreateUserDto, files: Array<Express.Multer.File>): Promise<import("..").User>;
    insertMany(createDtos: CreateUserDto[], filesArray?: Express.Multer.File[][]): Promise<import("..").User[]>;
    update(id: number, updateDto: UpdateUserDto, files: Array<Express.Multer.File>): Promise<import("..").User>;
    findMany(query: any): Promise<{
        groupMeta: any[];
        groupRecords: any[];
        meta?: undefined;
        records?: undefined;
    } | {
        meta: {
            totalRecords: number;
            currentPage: number;
            nextPage: number;
            prevPage: number;
            totalPages: number;
            perPage: number;
        };
        records: import("..").User[];
        groupMeta?: undefined;
        groupRecords?: undefined;
    }>;
    checkIfPermissionExists(query: any, activeUser: ActiveUserData): Promise<string[]>;
    findOne(id: string, query: any): Promise<import("..").User>;
    deleteMany(ids: number[]): Promise<any>;
    delete(id: number): Promise<import("..").User>;
    addRoleToUser(mutateUserRoles: MutateUserRolesDto): Promise<import("..").User>;
    addRolesToUser(mutateUserRolesBulk: MutateUserRolesBulkDto): Promise<import("..").User>;
    removeRoleFromUser(userEmail: string, roleName: string): Promise<import("..").User>;
}
