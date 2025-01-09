import { ValidationOptions } from "class-validator";
export declare function IsNotInEnum(enumType: object, validationOptions?: ValidationOptions): (object: Object, propertyName: string) => void;
