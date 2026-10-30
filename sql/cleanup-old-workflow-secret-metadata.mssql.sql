-- Run after deploying the Secret model metadata. This removes only the old
-- WorkflowSecret metadata and permissions. It does not touch secret values.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @old_model_id int = (
    SELECT id FROM dbo.ss_model_metadata WHERE singular_name = 'workflowSecret'
);

DELETE mr
FROM dbo.ss_menu_item_metadata_roles_ss_role_metadata AS mr
JOIN dbo.ss_menu_item_metadata AS menu_item
    ON menu_item.id = mr.ss_menu_item_metadata_id
WHERE menu_item.name = 'workflowSecret-menu-item';

DELETE FROM dbo.ss_menu_item_metadata
WHERE name = 'workflowSecret-menu-item';

DELETE rp
FROM dbo.ss_role_metadata_permissions_ss_permission_metadata AS rp
JOIN dbo.ss_permission_metadata AS permission
    ON permission.id = rp.ss_permission_metadata_id
WHERE permission.name LIKE 'WorkflowSecretController.%';

DELETE FROM dbo.ss_permission_metadata
WHERE name LIKE 'WorkflowSecretController.%';

DELETE FROM dbo.ss_user_view_metadata
WHERE view_metadata_id IN (
    SELECT id FROM dbo.ss_view_metadata
    WHERE name IN ('workflowSecret-list-view', 'workflowSecret-tree-view', 'workflowSecret-form-view')
);

DELETE FROM dbo.ss_saved_fitlers
WHERE model_id = @old_model_id
   OR view_id IN (
       SELECT id FROM dbo.ss_view_metadata
       WHERE name IN ('workflowSecret-list-view', 'workflowSecret-tree-view', 'workflowSecret-form-view')
   );

DELETE FROM dbo.ss_action_metadata
WHERE name IN ('workflowSecret-list-action', 'workflowSecret-tree-action');

DELETE FROM dbo.ss_view_metadata
WHERE name IN ('workflowSecret-list-view', 'workflowSecret-tree-view', 'workflowSecret-form-view');

DELETE FROM dbo.ss_security_rule WHERE model_metadata_id = @old_model_id;
DELETE FROM dbo.ss_model_sequence WHERE model_id = @old_model_id;

UPDATE dbo.ss_model_metadata
SET user_key_field_id = NULL
WHERE id = @old_model_id;

DELETE FROM dbo.ss_field_metadata WHERE model_id = @old_model_id;
DELETE FROM dbo.ss_model_metadata WHERE id = @old_model_id;

COMMIT TRANSACTION;
