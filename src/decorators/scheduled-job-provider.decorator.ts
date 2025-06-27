export const IS_SCHEDULED_JOB_PROVIDER = 'IS_SCHEDULED_JOB_PROVIDER';

export const ScheduledJobProvider = () => {
    return (target: Function) => {
        Reflect.defineMetadata(IS_SCHEDULED_JOB_PROVIDER, true, target);
    };
};
