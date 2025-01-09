import { Repository } from "typeorm";
import { ListOfValues } from "../entities/list-of-values.entity";
import { PaginationQueryDto } from "src/dtos/pagination-query.dto";
export declare class ListOfValuesService {
    private readonly listOfValuesRepo;
    constructor(listOfValuesRepo: Repository<ListOfValues>);
    findAll(paginationQuery: PaginationQueryDto): Promise<ListOfValues[]>;
    findOneByValueAndType(lovValue: string, lovType: string): Promise<ListOfValues>;
    findOne(id: number, relations?: {}): Promise<ListOfValues>;
    create(createDto: any): Promise<ListOfValues[]>;
    remove(id: number): Promise<ListOfValues>;
}
