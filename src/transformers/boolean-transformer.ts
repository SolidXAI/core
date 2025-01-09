const transformBoolean = ({ value }: any) => {
    if (typeof (value) === "boolean") {
        return value
    } else if (value === 'true') {
        return true
    } else {
        return false
    }
};
export default transformBoolean