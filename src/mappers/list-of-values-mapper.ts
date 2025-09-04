import { Injectable } from "@nestjs/common";
import { ListOfValues } from "src/entities/list-of-values.entity";

@Injectable()
export class ListOfValuesMapper {
    toDto(listOfValue: ListOfValues): any {
        return {
            type: listOfValue.type,
            value: listOfValue.value,
            display: listOfValue.display,
            description: listOfValue.description,
            default: listOfValue.default,
            sequence: listOfValue.sequence,
            module: listOfValue.module ? listOfValue.module.id : null
        };
    }
}