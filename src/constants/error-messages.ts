// backend/common/constants/error-messages.ts

export const ERROR_MESSAGES = {
    //authentication errors
    USER_NOT_FOUND: 'User does not exist.',
    USER_NOT_ACTIVE: 'User profile is not activated.',
    USER_INACTIVE: 'User is inactive.',
    PASSWORD_INCORRECT: 'Password does not match.',
    PUBLIC_REGISTRATION_DISABLED: 'Public registrations are disabled.',
    UNIQUE_CONSTRAINT_VIOLATION: 'A unique constraint violation occurred.',
    PASSWORDLESS_REGISTRATION_DISABLED: 'Passwordless registration is not enabled.',
    REGISTRATION_REQUIRES_CONTACT: 'Either mobile or email is required for initiating registration.',
    EMAIL_REQUIRED_FOR_VALIDATION: 'Email is required for email validation source.',
    MOBILE_REQUIRED_FOR_VALIDATION: 'Mobile is required for mobile validation source.',
    USER_ALREADY_EXISTS: 'User already exists. Please sign in.',
    VALIDATION_SOURCE_REQUIRED: 'At least one validation source is required.',
    INVALID_OTP: 'Invalid OTP.',
    OTP_EXPIRED: 'OTP has expired.',
    INVALID_VERIFICATION_TYPE: 'Invalid type. Must be either email or mobile.',
    NON_LOCAL_PROVIDER: 'User seems to have used a passwordless mode to authenticate.',
    USER_ID_MISMATCH: "User ID's do not match.",
    USERNAME_MISMATCH: "User username's do not match.",
    INCORRECT_CURRENT_PASSWORD: 'Incorrect current password specified.',
    PASSWORD_REUSED: 'Try a different password',
    INVALID_VERIFICATION_TOKEN: 'Invalid verification token',
    INVALID_REFRESH_TOKEN: 'Invalid refresh token',
    ACCESS_DENIED: 'Access denied',
    INVALID_USER_PROFILE: 'Invalid user profile',
    GOOGLE_OAUTH_PROFILE_FETCH_FAILED: 'Failed to fetch user profile from Google OAuth service',
    LOGOUT_FAILED: 'Logout failed due to an unexpected error.',

    INVALID_CREDENTIALS: 'Invalid credentials',
    LOGIN_FAILED: 'Login Failed',
    OLD_PASSWORD_INCORRECT: 'You have specified an incorrect old password.',
    INVALID_NEW_PASSWORD: 'Invalid new password.',
    PASSWORDS_DO_NOT_MATCH: 'New passwords are not matching.',

    // user management errors
    DELETE_SELF_NOT_ALLOWED: 'Deleting logged-in user is not allowed.',
    DELETE_IDS_REQUIRED: 'At least one ID is required for deletion.',
    USER_MISSING_ID: 'User must exist before initializing roles.',
    ROLES_NOT_FOUND: (roles: string[]) => `The following roles were not found: ${roles.join(', ')}`,
    USER_NOT_FOUND_BY_USERNAME: (username: string) => `User with username '${username}' not found.`,
    ROLE_NOT_FOUND: (roleName: string) => `Role '${roleName}' not found.`,
    PERMISSION_NOT_EXIST: (permission: string) => `Permission '${permission}' does not exist.`,

    // session errors
    SESSION_INVALID: 'Your session is no longer valid. Please log in again.',
    SESSION_EXPIRED: 'Your session has expired. Please log in again.',

    // filter errors
    GROUP_BY_LIMIT: 'buildFilterQuery: Only 1 Group by field is supported currently.',
    INVALID_GROUP_BY_COUNT: 'Exactly one groupBy field is required to count grouped records.',

    // general errors
    FORBIDDEN: 'Forbidden',


    // database errors
    DUPLICATE_ENTRY: 'Duplicate entry. A record with similar unique fields already exists.',

    // validation errors
    ID_REQUIRED_FOR_UPDATE: 'Id is required for update.',
    ID_REQUIRED_FOR_DELETE: 'Id is required for deletion.',

    // CRUD service errors
    RELATION_TYPE_NOT_SUPPORTED: 'Relation type not supported in CRUD service.',
    NO_SOFT_DELETED_RECORD_FOUND: 'No soft-deleted record found with the given ID.',
    CONFLICTING_RECORD_ON_UNARCHIVE: 'Another record is conflicting with the record you are attempting to Un-Archive, either delete or change the other record so as to avoid this conflict.',
    NO_SOFT_DELETED_RECORDS_FOUND: 'No matching soft-deleted records found.',
    EMPTY_PATH_PARTS: 'Path parts cannot be empty',


    // CSV/Excel service errors
    MISSING_HEADERS_OR_FUNCTION: 'Either headers or data records function must be provided.',
    INVALID_CHUNK_SIZE: 'Chunk size must be greater than 0 when data records function is provided.',
    INVALID_FORMAT: (format: string) => `Invalid ${format} format`,


    //field errors
    INVALID_INVERSE_FIELD_TYPE: 'Only relation fields can have inverse fields.',
    MODEL_AND_MODULE_REQUIRED_TO_UPDATE_INVERSE_FIELD: 'Model and module are required to update inverse field.',
    MODEL_NAME_AND_MODULE_NAME_REQUIRED_TO_CREATE_INVERSE_FIELD: 'Model name and module name are required to create inverse field.',
    FIELD_NOT_FOUND: (id: number | string) => `No field with id #${id} exists`,
    PROVIDER_NOT_FOUND: (provider: string) => `Field incorrectly configured. No provider with name ${provider} registered in backend.`,
    FILE_WRITE_FAILED: 'File creation failed, rolling back transaction',
    FILE_DELETE_FAILED: 'File deletion failed, rolling back transaction',
    // file service errors
    FILE_NOT_FOUND: 'File not found',
    FILE_COPY_ERROR: 'Error copying file',
    S3_CLIENT_NOT_INITIALIZED: 'S3 Client not initialized. Please check the S3 configuration.',

    // model errors
    MODEL_METADATA_NOT_FOUND: (id: string | number) => `Model metadata with ID ${id} not found.`,
    MODEL_SERVICE_NOT_FOUND: (model: string) => `Model service for ${model} not found.`,
    RELATION_CO_MODEL_NOT_DEFINED_FOR_FIELD: (fieldName: string) => `Relation coModelSingularName is not defined for relation field ${fieldName}`,
    MODEL_NOT_FOUND: (singularName?: string) => `Model${singularName ? ` with singular name "${singularName}"` : ''} not found.`,
    MODEL_REQUIRED_FOR_CODE_GENERATION: 'Model ID or Model Name is required for generating code.',

    //module errors
    MODULE_NOT_FOUND: (moduleName: string) => `Module with name ${moduleName} not found.`,
    MODULE_ID_NOT_FOUND: (id: string | number) => `Module with ID ${id} not found.`,

    //entity errors
    ENTITY_NOT_FOUND: (entity?: string | number) => `Entity${entity ? ' ' + entity : ''} not found.`,
    ENTITY_NAME_REQUIRED: 'Entity name is required to find the entity.',
    ENTITY_ID_REQUIRED: 'Entity ID is required to find the entity.',

    // import errors
    NO_ERROR_LOG_FOR_IMPORT: (id: string | number) => `No error log entries found for import transaction ID ${id}.`,
    FILE_READ_FAILED_FROM_URL: (url: string) => `Failed to read file from URL: ${url}`,

    // media storage provider errors
    MEDIA_STORAGE_PROVIDER_ID_NOT_FOUND: (id: number | string) => `Media Storage Provider with #${id} not found.`,
    MEDIA_STORAGE_PROVIDER_NOT_FOUND: 'Media Storage Provider not found',

    // SQL errors
    UNSUPPORTED_SQL_OPERATOR: (operator: string) => `Unsupported SQL operator: ${operator}`,

    // AI interaction errors
    PYTHON_EXECUTABLE_NOT_CONFIGURED: 'SolidX AI MCP python executable or client path not configured.',
    UNABLE_TO_RESOLVE_SOLID_COMMAND: 'Unable to resolve a solid_ command that was used to come up with this response.',
    UNABLE_TO_RESOLVE_MCP_HANDLER: 'Unable to resolve a mcp tool handler.',

    DEFAULT_REGEX_PATTERN_NOT_MATCHING_ERROR_MSG: 'Invalid regex pattern.',
};