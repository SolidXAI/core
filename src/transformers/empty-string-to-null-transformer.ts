import { TransformFnParams } from "class-transformer";

export const emptyStringToNullTransformer = ({ value }: TransformFnParams) => {
    if (typeof value === "string" && value.trim() === "") {
        return null;
    }

    return value;
};

export default emptyStringToNullTransformer;
