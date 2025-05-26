import { ApiProperty } from "@nestjs/swagger";

export class ImportInstructionsResponseDto {
    standard: StandardImportInstructionsResponseDto;
    @ApiProperty({
        type: [String],
        description: 'List of custom import instructions',
    })
    custom: string[];
}

export class StandardImportInstructionsResponseDto {
    @ApiProperty({
        type: [String],
        description: 'List of required fields for import',
    })
    requiredFields: string[];
    @ApiProperty({
        type: [String],
        description: 'List of date fields for import',
    })
    dateFields: string[];
    @ApiProperty({
        type: [String],
        description: 'List of date-time fields for import',
    })
    dateTimeFields: string[];
    @ApiProperty({
        type: [String],
        description: 'List of number fields for import',
    })
    numberFields: string[];
    @ApiProperty({
        type: [String],
        description: 'List of email fields for import',
    })
    emailFields: string[];
    @ApiProperty({
        type: [Object],
        description: 'List of regex fields for import, each with field name and regex pattern',
    })
    regexFields: RegexFieldInstructionResponseDto[];
    @ApiProperty({
        type: [String],
        description: 'List of JSON fields for import',
    })
    jsonFields: string[];
    @ApiProperty({
        type: [String],
        description: 'List of boolean fields for import',
    })
    booleanFields: string[];
}

export class RegexFieldInstructionResponseDto {
    @ApiProperty({
        type: String,
        description: 'Name of the field',
    })
    fieldName: string;
    @ApiProperty({
        type: String,
        description: 'Regex pattern for the field',
    })
    regexPattern: string;
}   