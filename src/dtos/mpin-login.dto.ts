import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Deliberately carries no identifier - no mobile, email or username.
 *
 * `credentialRef` is a server-issued 256-bit handle that already points at a
 * single credential row, and therefore at a single user. That is what removes
 * the user-enumeration surface a public login route would otherwise have: an
 * attacker cannot probe "does this phone number have MPIN?" because there is
 * nowhere to put a phone number.
 */
export class MpinLoginDto {
    // Bounded so a pathological payload never reaches the regex test or the
    // hash comparison. The handle is always 64 hex characters.
    @IsNotEmpty()
    @IsString()
    @MaxLength(128)
    credentialRef: string;

    @IsNotEmpty()
    @IsString()
    @MaxLength(32)
    mpin: string;
}
