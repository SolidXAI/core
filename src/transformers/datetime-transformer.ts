import { TransformFnParams } from 'class-transformer';

const datetimeTransformer = ({ value }: TransformFnParams): Date | null => {
    console.log("date time transformer debug", value);

    if (value === '' || value === undefined || value === null) return null;

    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
};

export default datetimeTransformer;
