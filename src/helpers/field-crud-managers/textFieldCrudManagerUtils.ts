import { isString } from "class-validator";

export const normalizeTextFieldValue = (fieldValue: any): any => {
    return isString(fieldValue) ? fieldValue.trim() : fieldValue;
};

export const normalizeTextFieldInDto = (dto: any, fieldName?: string | null): any => {
    if (!fieldName || !Object.prototype.hasOwnProperty.call(dto, fieldName)) {
        return dto;
    }

    dto[fieldName] = normalizeTextFieldValue(dto[fieldName]);
    return dto;
};
