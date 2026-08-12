import { IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class SetupMpinDto {
    /**
     * Stable identifier for the physical device, generated once by the client.
     * Validated as a UUID before it ever reaches a cache key or a bucket name,
     * so it cannot smuggle delimiters into the keyspace.
     */
    @IsUUID()
    deviceId: string;

    /**
     * A string, not a number, even though it looks like digits.
     *
     * A numeric MPIN cannot carry a leading zero: JSON forbids leading zeros in
     * number literals, so a client serialising `012345` numerically emits
     * `12345` and the server stores a five-digit MPIN the user never chose -
     * which still satisfies the default `^\d{4,6}$` and so raises no error.
     * `mpinRegex` is also tenant-configurable and may permit non-digits.
     *
     * Note this cannot be enforced here: the global ValidationPipe runs with
     * `enableImplicitConversion`, so a numeric payload is coerced to a string
     * before @IsString() sees it. Clients must send a quoted JSON string; that
     * requirement is documented in the mobile integration guide.
     *
     * Length and shape are checked server-side against `mpinRegex`, since that
     * setting is the single authority. This only bounds the input.
     */
    @IsNotEmpty()
    @IsString()
    @MaxLength(32)
    mpin: string;

    /**
     * Rendered in a device-management list, so it is bounded here rather than
     * trusting every consuming UI to escape it.
     */
    @IsOptional()
    @IsString()
    @MaxLength(64)
    @Matches(/^[\w\s.'()-]*$/, {
        message: 'deviceName may contain only letters, numbers, spaces and . \' ( ) - _',
    })
    deviceName?: string;

    @IsOptional()
    @IsString()
    @MaxLength(32)
    @Matches(/^[\w.-]*$/, { message: 'platform may contain only letters, numbers and . - _' })
    platform?: string;
}
