#!/usr/bin/env node

import { CommandFactory } from "nest-commander";
import { SolidCoreCliModule } from "./solid-core-cli.module";

async function bootstrap() {

    // const app = await NestFactory.create(appModule);

    // Create an instance of the application, capture the application context so we can inject it into a service in itself.
    // @ts-ignore
    const app = await CommandFactory.createWithoutRunning(SolidCoreCliModule, ['debug', 'error', 'fatal', 'log', 'verbose', 'warn']);
    // const app = await CommandFactory.createWithoutRunning(AppModule, ['debug', 'error', 'fatal', 'log', 'verbose', 'warn']);
    // const app = await CommandFactory.createWithoutRunning(AppModule, ['error', 'fatal']);

    // Now run the command factory.
    try {
        await CommandFactory.runApplication(app);
    }
    catch (e) {
        process.exit(1);
    }

    // Exit explicitly, make sure that any commands you have created and are using Promises, you do not keep them orphan/dangling.
    process.exit(0);
}

// https://github.com/typeorm/typeorm/issues/8583
// const types = require('pg').types;
// types.setTypeParser(types.builtins.INT8, function(val) {
//   return parseInt(val)
// });

bootstrap();