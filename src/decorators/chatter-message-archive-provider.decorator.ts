import { SetMetadata } from '@nestjs/common';

export const IS_CHATTER_MESSAGE_ARCHIVE_PROVIDER = 'IS_CHATTER_MESSAGE_ARCHIVE_PROVIDER';
export const ChatterMessageArchiveProvider = () => SetMetadata(IS_CHATTER_MESSAGE_ARCHIVE_PROVIDER, true);
