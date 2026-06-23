-- =============================================================
-- AI Interaction Metadata Cleanup Script
-- Run this against your PostgreSQL database to remove all
-- metadata and data associated with the aiInteraction model.
-- =============================================================

BEGIN;

-- 1. Remove menu item
DELETE FROM ss_menu_item_metadata
WHERE name = 'aiInteraction-menu-item';

-- 2. Remove action
DELETE FROM ss_action_metadata
WHERE name = 'aiInteraction-list-action';

-- 3. Remove user-level view customisations for aiInteraction views
DELETE FROM ss_user_view_metadata
WHERE view_metadata_id IN (
    SELECT id FROM ss_view_metadata
    WHERE name IN ('aiInteraction-list-view', 'aiInteraction-form-view')
);

-- 4. Remove saved filters pointing at the aiInteraction model
DELETE FROM ss_saved_fitlers
WHERE model_id = (
    SELECT id FROM ss_model_metadata WHERE singular_name = 'aiInteraction'
);

-- 5. Remove security rules scoped to the aiInteraction model
DELETE FROM ss_security_rule
WHERE model_metadata_id = (
    SELECT id FROM ss_model_metadata WHERE singular_name = 'aiInteraction'
);

-- 6. Remove views
DELETE FROM ss_view_metadata
WHERE name IN ('aiInteraction-list-view', 'aiInteraction-form-view');

-- 7. Remove field metadata belonging to the aiInteraction model
DELETE FROM ss_field_metadata
WHERE model_id = (
    SELECT id FROM ss_model_metadata WHERE singular_name = 'aiInteraction'
);

-- 8. Remove the model metadata record itself
DELETE FROM ss_model_metadata
WHERE singular_name = 'aiInteraction';

-- 9. Drop the actual data table
DROP TABLE IF EXISTS ss_ai_interactions;

COMMIT;