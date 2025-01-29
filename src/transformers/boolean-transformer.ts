import { TransformFnParams } from "class-transformer";

const transformBoolean = ({ value }: TransformFnParams): boolean => {
    if (typeof (value) === "boolean") {
        return value
    } else if (value === 'true') {
        return true
    } else {
        return false
    }
};
export default transformBoolean