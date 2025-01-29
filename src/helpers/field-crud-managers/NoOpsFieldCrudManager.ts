import { FieldCrudManager } from "src/interfaces";

export class NoOpsFieldCrudManager implements FieldCrudManager{
    createDto: any;
    constructor(){
    }
    validate(dto: any) {
        return [];
    }
    transformForCreate(dto: any) {
        return dto;
    }
}