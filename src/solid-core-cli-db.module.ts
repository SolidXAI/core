import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { WinstonTypeORMLogger } from './winston.logger';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            // This becomes the default by default.
            // name: 'default',
            useFactory: (logger: Logger) => {

                const entities = [
                    join(__dirname, './entities/*.entity.{ts,js}'),
                ];

                // DO NOT REMOVE BELOW COMMENT
                // We no longer register subscribers on the TypeORM datasource. 
                // instead we register them directly as NestJS providers, and they register themselves as subscribers on the data source during service instantiation in their respective constructor. 
                // check ModelSubscriber for a reference. 
                // Steps are    
                // 1. Create the subscriber like a NestJS injectable service. 
                // 2. Register the subscriber in the respective module like you would any other NestJS service. 
                // 3. Make sure to not provide the subscribers array below. 
                // const subscribers = [
                //     join(__dirname, './app-builder/subscribers/*.subscriber.{ts,js}'),
                //     join(__dirname, './common/subscribers/*.subscriber.{ts,js}'),
                //     join(__dirname, './iam/subscribers/*.subscriber.{ts,js}'),
                //     join(__dirname, './queues/subscribers/*.subscriber.{ts,js}'),
                //     ...enabledModules.map(module =>
                //         join(__dirname, `./${module}/subscribers/*.subscriber.{ts,js}`)
                //     ),
                // ];

                return {
                    // type of our database. 
                    type: 'postgres',
                    host: process.env.DEFAULT_DATABASE_HOST,
                    port: +process.env.DEFAULT_DATABASE_PORT,
                    username: process.env.DEFAULT_DATABASE_USER,
                    password: process.env.DEFAULT_DATABASE_PASSWORD,
                    // name of our database
                    database: process.env.DEFAULT_DATABASE_NAME,
                    // models will be loaded automatically
                    // autoLoadEntities: true,
                    entities: entities,
                    // your entities will be synced with the database (recommended: disable in prod)
                    synchronize: Boolean(process.env.DEFAULT_DATABASE_SYNCHRONIZE),
                    logging: Boolean(process.env.DEFAULT_DATABASE_LOGGING),
                    // logger: new WinstonTypeORMLogger(logger),  // Pass in the custom WinstonLogger
                    namingStrategy: new SnakeNamingStrategy(),
                    // subscribers: subscribers
                }
            },
            inject: [WINSTON_MODULE_PROVIDER]
        }),
    ],
})
export class SolidCoreCliDBModule{
}
