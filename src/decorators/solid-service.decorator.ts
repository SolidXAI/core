import { SetMetadata } from "@nestjs/common";

export const SOLID_SERVICE = 'SOLID_SERVICE';

export const SolidSeeder: ClassDecorator = SetMetadata(SOLID_SERVICE, { seeder: true });