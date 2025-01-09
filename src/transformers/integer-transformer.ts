// const integerTransformer = ({ value }: any) => {
//     return Number(value)
// }
// export default integerTransformer

const integerTransformer = ({ value }: any) => {
    // Ensure null or undefined values are returned as is
    if (value === null || value === undefined) return value;

    // Parse the value into an integer
    const parsedValue = parseInt(value, 10);

    // Return the parsed value if it's a valid number; otherwise, return null or throw an error
    return isNaN(parsedValue) ? null : parsedValue;
};

export default integerTransformer;