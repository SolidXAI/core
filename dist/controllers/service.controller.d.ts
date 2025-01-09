import { SolidRegistry } from '../helpers/solid-registry';
export declare class ServiceController {
    private readonly solidRegistry;
    constructor(solidRegistry: SolidRegistry);
    pingPong(): {
        pong: string;
    };
}
