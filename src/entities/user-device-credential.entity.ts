import { Exclude, Expose } from "class-transformer";
import { CommonEntity } from "src/entities/common.entity";
import { Column, Entity, Index, ManyToOne } from "typeorm";
import { User } from "./user.entity";

/**
 * A per-device MPIN credential.
 *
 * Login presents `credentialRef` (a server-issued opaque handle) plus the MPIN.
 * The handle - not a mobile number or email - is what identifies the account,
 * which is why the login route needs no identifier and offers no user
 * enumeration surface.
 */
@Entity("ss_user_device_credential")
// Non-unique: one physical device may legitimately hold credentials for
// several accounts, and each account setup mints its own row.
@Index(["user", "deviceId"])
@Exclude()
export class UserDeviceCredential extends CommonEntity {

    // SHA-256 of the opaque handle, and the login lookup key. Never exposed:
    // the raw handle is returned to the client once at setup and never stored.
    // SHA-256 rather than bcrypt because the handle is 256 bits of randomness -
    // there is nothing to brute-force, so a slow hash would only add latency.
    // Same treatment as UserApiKey.hashedKey.
    @Index({ unique: true })
    @Column()
    hashedCredentialRef: string;

    // bcrypt hash of the MPIN, via HashingService. Never exposed - same
    // treatment as User.password. Slow hashing is warranted here: a 4-6 digit
    // secret is exactly the low-entropy case bcrypt exists for.
    @Column()
    hashedMpin: string;

    // Mirrors User.passwordScheme / passwordSchemeVersion so
    // HashingService.needsRehash can upgrade the hash on a successful login.
    @Column()
    mpinScheme: string;

    /**
     * The hashing *policy* version this row was hashed under - not a version of
     * MPIN itself. It comes from `HashingService.currentVersion()`, which
     * `BcryptService` currently returns as **2**, so freshly created rows read
     * 2, exactly as `ss_user.password_scheme_version` does.
     *
     * It matters because `BcryptService.normalize` applies the configured
     * pepper only when `version >= 2`. Storing the version per row means an
     * older hash still verifies after the policy changes: `compare()` uses the
     * version the row was written with, and `needsRehash()` upgrades it on the
     * next successful login.
     *
     * The `default: 1` is inherited from the `User` precedent and is never
     * reached, since every write path sets this explicitly. Note it would be
     * *wrong* if it ever were: a row hashed at 2 but recorded as 1 would be
     * compared without the pepper and could never authenticate.
     */
    @Column({ default: 1 })
    mpinSchemeVersion: number;

    // Client-supplied, stable for the physical device. Used for grouping and
    // the device-management UI only - never a lookup key. Deliberately NOT
    // unique: several accounts on one device share a deviceId.
    @Expose()
    @Column()
    deviceId: string;

    /**
     * Human-readable natural key - `<username>-<deviceId>` - unique per row.
     *
     * Neither column alone can serve as the model's user key: `deviceId` is
     * shared by every account on a device, and `deviceName` is nullable.
     * Combining them is unique in both directions - one user across many
     * devices, and many users on one device.
     *
     * Populated by MpinService rather than declared as a `computed` field in
     * the metadata manifest. Computed fields are evaluated by
     * ComputedFieldCrudManager on the generic CRUD path (`crud.service.ts`),
     * which this service bypasses by writing through the repository directly,
     * so a computed declaration would silently leave this null. It is also
     * beyond ConcatComputedFieldProvider, which resolves `dto[field]` flatly
     * within one model and cannot reach `username` across the user relation.
     */
    @Expose()
    @Index({ unique: true })
    @Column()
    credentialKey: string;

    @Expose()
    @Column({ nullable: true })
    deviceName: string;

    @Expose()
    @Column({ nullable: true })
    platform: string;

    // Revocation is a soft-delete: the row survives so that a correct MPIN can
    // be answered with "this device was removed" rather than a baffling
    // "incorrect MPIN". Only active rows count towards mpinMaxDevicesPerUser.
    @Expose()
    @Column({ default: true })
    isActive: boolean;

    // Cumulative, and reset only on a successful login - never when a lockout
    // expires. That is what makes the second threshold detectable without a
    // separate lockout counter.
    @Expose()
    @Column({ default: 0 })
    failedAttempts: number;

    @Expose()
    @Column({ nullable: true })
    lockedUntil: Date;

    @Expose()
    @Column({ nullable: true })
    lastUsedAt: Date;

    // Deliberately no inverse property on User. Nothing needs
    // `user.deviceCredentials`, and leaving the most widely referenced entity
    // in the system untouched keeps this feature purely additive.
    //
    // `nullable: false` because TypeORM makes relations nullable by default,
    // which would let a credential exist with no owner. Such a row could never
    // authenticate - loginWithMpin rejects it - so it would simply be dead
    // data, but the database should refuse it outright. This also keeps the
    // column honest against the metadata manifest, which declares it required.
    @ManyToOne(() => User, { nullable: false })
    user: User;
}
