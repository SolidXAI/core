import { TransactionalRegistrationValidationSource } from "../constants";
export declare class OTPSignUpDto {
    username: string;
    email: string;
    mobile: string;
    validationSources: TransactionalRegistrationValidationSource[];
    customPayload: any;
}
