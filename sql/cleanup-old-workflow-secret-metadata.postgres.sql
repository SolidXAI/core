-- Run after deploying the Secret model metadata. This removes only the old
-- WorkflowSecret metadata and permissions. It does not touch secret values.
BEGIN;

CREATE TEMP TABLE old_workflow_secret_model ON COMMIT DROP AS
SELECT id FROM ss_model_metadata WHERE singular_name = 'workflowSecret';

DELETE FROM ss_menu_item_metadata_roles_ss_role_metadata
WHERE ss_menu_item_metadata_id IN (
    SELECT id FROM ss_menu_item_metadata WHERE name = 'workflowSecret-menu-item'
);

DELETE FROM ss_menu_item_metadata WHERE name = 'workflowSecret-menu-item';

DELETE FROM ss_role_metadata_permissions_ss_permission_metadata
WHERE ss_permission_metadata_id IN (
    SELECT id FROM ss_permission_metadata
    WHERE name LIKE 'WorkflowSecretController.%'
);

DELETE FROM ss_permission_metadata
WHERE name LIKE 'WorkflowSecretController.%';

DELETE FROM ss_user_view_metadata
WHERE view_metadata_id IN (
    SELECT id FROM ss_view_metadata
    WHERE name IN ('workflowSecret-list-view', 'workflowSecret-tree-view', 'workflowSecret-form-view')
);

DELETE FROM ss_saved_fitlers
WHERE model_id IN (SELECT id FROM old_workflow_secret_model)
   OR view_id IN (
       SELECT id FROM ss_view_metadata
       WHERE name IN ('workflowSecret-list-view', 'workflowSecret-tree-view', 'workflowSecret-form-view')
   );

DELETE FROM ss_action_metadata
WHERE name IN ('workflowSecret-list-action', 'workflowSecret-tree-action');

DELETE FROM ss_view_metadata
WHERE name IN ('workflowSecret-list-view', 'workflowSecret-tree-view', 'workflowSecret-form-view');

DELETE FROM ss_security_rule
WHERE model_metadata_id IN (SELECT id FROM old_workflow_secret_model);

DELETE FROM ss_model_sequence
WHERE model_id IN (SELECT id FROM old_workflow_secret_model);

UPDATE ss_model_metadata
SET user_key_field_id = NULL
WHERE id IN (SELECT id FROM old_workflow_secret_model);

DELETE FROM ss_field_metadata
WHERE model_id IN (SELECT id FROM old_workflow_secret_model);

DELETE FROM ss_model_metadata
WHERE id IN (SELECT id FROM old_workflow_secret_model);

COMMIT;
