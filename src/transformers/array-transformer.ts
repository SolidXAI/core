// const integerTransformer = ({ value }: any) => {
//     return Number(value)
// }
// export default integerTransformer

const arrayTransformer = ({ value }: any) => {
    if (value === null || value === undefined) return value;
    const parsedValues = value.map(item => {
        // if(Typeof ) 
        const parsedItem = JSON.parse(item);
        return parsedItem;
    });
    return parsedValues ?? parsedValues;
};

export default arrayTransformer;