import { Logger } from "@nestjs/common";
import { EntityManager, In } from "typeorm";
import { CommonEntity } from "../entities/common.entity";
import { Locale } from "../entities/locale.entity";
import { ModelMetadata } from "../entities/model-metadata.entity";
import { classify } from "../helpers/string.helper";
import { SolidRegistry } from "../helpers/solid-registry";
import { SolidBaseRepository } from "../repository/solid-base.repository";

export class InternationalisationHelperService {
    private readonly logger = new Logger(InternationalisationHelperService.name);

    isInternationalisationEnabled(model: ModelMetadata): boolean {
        return model?.internationalisation === true;
    }

    async deleteChildLocaleEntities<T extends CommonEntity>(
        repo: SolidBaseRepository<T>,
        model: ModelMetadata,
        entityIds: number[],
    ): Promise<void> {
        if (!this.isInternationalisationEnabled(model) || entityIds.length === 0) return;

        const childEntities = await repo.find({
            where: { defaultEntityLocaleId: In(entityIds) } as any,
        });
        if (childEntities.length === 0) return;

        if (model.enableSoftDelete === true) {
            await repo.softRemove(childEntities);
        } else {
            await repo.remove(childEntities);
        }
    }

    pickCurrentLocaleRecord(records: any[], localeName: string, draftPublishEnabled: boolean): any | null {
        const localeRecords = records.filter(record => record.localeName === localeName);
        if (localeRecords.length === 0) return null;

        return localeRecords.sort((a, b) => {
            // isLatest only exists on draft/publish-enabled models (legacy tables lack the column)
            if (draftPublishEnabled && Boolean(a.isLatest) !== Boolean(b.isLatest)) return a.isLatest ? -1 : 1;

            return Number(b.id ?? 0) - Number(a.id ?? 0);
        })[0];
    }

    /** Resolves the locale name to filter/tag records by: explicit locale, else the registry default, else 'en'. */
    resolveDefaultLocaleName(solidRegistry: SolidRegistry): string {
        const defaultLocale = solidRegistry.getDefaultLocale();
        return defaultLocale?.locale ?? 'en';
    }

    async getEntityRecordsInAllLocales(
        entityManager: EntityManager,
        modelName: string,
        id: string,
        defaultEntityLocaleIdFromQuery: string | undefined,
        draftPublishEnabled: boolean,
    ): Promise<{ records: any[], defaultEntityLocaleId: string | null }> {
        const currentEntityRepository = entityManager.getRepository(classify(modelName));

        // Case 1: Creating a new record with no defaultEntityLocaleId to clone
        if (id === 'new' && !defaultEntityLocaleIdFromQuery) {
            this.logger.debug(`Creating new record without cloning from any defaultEntityLocaleId.`);
            return { records: [], defaultEntityLocaleId: null };
        }

        // Case 2: Creating a new record and cloning from an existing defaultEntityLocaleId
        if (id === 'new' && defaultEntityLocaleIdFromQuery) {
            this.logger.debug(`Creating new record by cloning translations from defaultEntityLocaleId: ${defaultEntityLocaleIdFromQuery}`);

            const records = await currentEntityRepository.find({
                where: [
                    { defaultEntityLocaleId: defaultEntityLocaleIdFromQuery },
                    { id: defaultEntityLocaleIdFromQuery },
                    // initialEntityVersionId only exists on draft/publish-enabled models (legacy tables lack the column)
                    ...(draftPublishEnabled ? [{ initialEntityVersionId: defaultEntityLocaleIdFromQuery }] : []),
                ]
            });

            this.logger.debug(`Found ${records.length} cloned records for new entity.`);
            return { records, defaultEntityLocaleId: defaultEntityLocaleIdFromQuery };
        }

        // Case 3: Editing an existing entity
        const entityRecord = await currentEntityRepository.findOne({ where: { id } });

        if (!entityRecord) {
            this.logger.warn(`No entity found for id ${id}`);
            return { records: [], defaultEntityLocaleId: null };
        }

        const defaultEntityLocaleId = entityRecord.defaultEntityLocaleId
            || (draftPublishEnabled ? entityRecord.initialEntityVersionId : null)
            || entityRecord.id;
        if (entityRecord.defaultEntityLocaleId) {
            this.logger.debug(`Editing translated locale record. Translation root id: ${defaultEntityLocaleId}`);
        } else {
            this.logger.debug(`Editing translation root record with id ${defaultEntityLocaleId}`);
        }

        const records = await currentEntityRepository.find({
            where: [
                { defaultEntityLocaleId: defaultEntityLocaleId },
                { id: defaultEntityLocaleId },
                ...(draftPublishEnabled ? [{ initialEntityVersionId: defaultEntityLocaleId }] : []),
            ]
        });

        this.logger.debug(`Found ${records.length} records in all locales for existing entity.`);

        return { records, defaultEntityLocaleId };
    }

    /**
     * Builds the `applicableLocales` shape for a view layout: one entry per registered locale,
     * with the matching translation record's id (if any) resolved via pickCurrentLocaleRecord.
     */
    async buildApplicableLocales(
        entityManager: EntityManager,
        modelName: string,
        id: string,
        defaultEntityLocaleIdFromQuery: string | undefined,
        draftPublishEnabled: boolean,
    ): Promise<any[]> {
        const { records: entityRecordsInAllLocales, defaultEntityLocaleId } =
            await this.getEntityRecordsInAllLocales(entityManager, modelName, id, defaultEntityLocaleIdFromQuery, draftPublishEnabled);
        const allLocales = await entityManager.getRepository(Locale).find({});

        return allLocales.map(locale => {
            const matchingRecord = this.pickCurrentLocaleRecord(entityRecordsInAllLocales, locale.locale, draftPublishEnabled);
            return {
                locale: locale.locale,
                displayName: locale.displayName,
                isDefault: locale.isDefault ? 'yes' : 'no',
                defaultEntityLocaleId,
                entityId: matchingRecord ? matchingRecord.id : null,
            };
        });
    }
}
