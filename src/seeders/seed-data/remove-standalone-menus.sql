-- Delete script: remove standalone menu items, actions, and views
-- Run this against your database after deploying the updated metadata.

-- 1. Chatter Message Details
DELETE FROM ss_menu_item_metadata WHERE name = 'chatterMessageDetails-menu-item';
DELETE FROM ss_action_metadata    WHERE name = 'chatterMessageDetails-list-action';

-- 2. Import Transaction Error Logs (views kept — embedded in importTransaction form)
DELETE FROM ss_menu_item_metadata WHERE name = 'importTransactionErrorLog-menu-item';
DELETE FROM ss_action_metadata    WHERE name = 'importTransactionErrorLog-list-action';

-- 3. Agent Events (removed from menu; views retained for embedded use)
DELETE FROM ss_menu_item_metadata WHERE name = 'agentEvent-menu-item';
DELETE FROM ss_action_metadata    WHERE name IN ('agentEvent-list-action');