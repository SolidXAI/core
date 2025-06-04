import { Logger } from '@nestjs/common';
import { TransformFnParams } from 'class-transformer';
const logger = new Logger('datetimeTransformer');
const datetimeTransformer = ({ value }: TransformFnParams): Date | null => {
    logger.debug("date time transformer debug", value);
    if (value === '' || value === undefined || value === null) return null;

    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
};

export default datetimeTransformer;
