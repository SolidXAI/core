export enum Environment {
  Production = 'prod',
  Development = 'dev',
}

export function DisallowInProduction(action?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const currentEnv = process.env.ENV as Environment;

      if (currentEnv === Environment.Production) {
        const className = target.constructor.name;
        const methodName = action || propertyKey;
        throw new Error(`❌ Cannot execute "${className}.${methodName}" in production`);
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}