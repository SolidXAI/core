import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ListOfValues } from "../entities/list-of-values.entity";
import { PaginationQueryDto } from "src/dtos/pagination-query.dto";
import { Injectable, NotFoundException } from "@nestjs/common";

@Injectable()
export class ListOfValuesService {
    constructor(
        @InjectRepository(ListOfValues)
        private readonly listOfValuesRepo: Repository<ListOfValues>,
    ) { }

    findAll(paginationQuery: PaginationQueryDto) {
        const { limit, offset } = paginationQuery;
        return this.listOfValuesRepo.find({
            relations: {},
            skip: offset,
            take: limit,
        });
    }

    async findOneByValueAndType(lovValue: string, lovType: string) {
        return await this.listOfValuesRepo.findOne({
            where: {
                value: lovValue,
                type: lovType,
            },
        });
    }

    async findOne(id: number, relations = {}) {
        const lov = await this.listOfValuesRepo.findOne({
            where: {
                id: id,
            },
            relations: relations,
        });
        if (!lov) {
            throw new NotFoundException(`list of values #${id} not found`);
        }
        return lov;
    }

    async create(createDto: any) {
        const lov = this.listOfValuesRepo.create(createDto);
        return this.listOfValuesRepo.save(lov);
    }

    async remove(id: number) {
        const lov = await this.findOne(id);
        return this.listOfValuesRepo.remove(lov);
    }
}