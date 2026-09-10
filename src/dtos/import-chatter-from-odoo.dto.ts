import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUrl } from 'class-validator';

export class ImportChatterFromOdooDto {
    @IsUrl({ require_tld: false })
    @IsNotEmpty()
    odooBaseUrl: string;

    @IsString()
    @IsNotEmpty()
    odooDb: string;

    @IsString()
    @IsNotEmpty()
    odooLogin: string;

    @IsString()
    @IsNotEmpty()
    odooPassword: string;

    /** SolidX model to import chatter into, e.g. "frmsLead". Must have an `odooId` column (see plan §4). */
    @IsString()
    @IsNotEmpty()
    solidxModelName: string;

    /** Odoo model to read records + mail.message from, e.g. "tm.lms". */
    @IsString()
    @IsNotEmpty()
    odooModelName: string;

    /**
     * Import ONLY the SolidX record whose `odooId` equals this value. Omit to sweep every
     * `solidxModelName` record that has a non-null `odooId`.
     */
    @IsNumber()
    @IsOptional()
    odooId?: number;

    /** ISO date - only import Odoo messages created on/after this date. */
    @IsString()
    @IsOptional()
    fromDate?: string;

    /** Page size when sweeping all records (no `odooId` given). Default 100. */
    @IsNumber()
    @IsOptional()
    batchSize?: number;
}
