-- Delete script: remove ChatterMessageDetails and ImportTransactionErrorLog menu artifacts
-- Run this against your database after deploying the updated metadata.

-- 1. Chatter Message Details
DELETE FROM ss_menu_item_metadata WHERE name = 'chatterMessageDetails-menu-item';
DELETE FROM ss_action_metadata    WHERE name = 'chatterMessageDetails-list-action';

-- 2. Import Transaction Error Logs
DELETE FROM ss_menu_item_metadata WHERE name = 'importTransactionErrorLog-menu-item';
DELETE FROM ss_action_metadata    WHERE name = 'importTransactionErrorLog-list-action';
