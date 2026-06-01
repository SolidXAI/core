BEGIN;

-- 0) Scope: solid-core dashboard legacy keys
-- Models:
--   dashboard, dashboardVariable, dashboardQuestion, dashboardQuestionSqlDatasetConfig, dashboardLayout
-- Actions:
--   dashboard-list-action, dashboardVariable-list-action, dashboardQuestion-list-action,
--   dashboardLayout-list-action, dashboardQuestionSqlDatasetConfig-list-action
-- Menus:
--   dashboardManagement-menu-item, dashboard-menu-item, dashboardQuestion-menu-item, dashboardLayout-menu-item
-- Views:
--   dashboard-list-view, dashboard-form-view,
--   dashboardVariable-list-view, dashboardVariable-form-view,
--   dashboardQuestion-list-view, dashboardQuestion-form-view,
--   dashboardQuestionSqlDatasetConfig-list-view, dashboardQuestionSqlDatasetConfig-form-view,
--   dashboardLayout-list-view, dashboardLayout-form-view

-- 1) Remove role<->permission joins for dashboard controller permissions
-- (table name may vary by naming strategy; this is the common one)
DELETE FROM ss_role_metadata_permissions_ss_permission_metadata
WHERE ss_permission_metadata_id IN (
  SELECT id
  FROM ss_permission_metadata
  WHERE name ILIKE 'Dashboard%'
);

-- 2) Remove dashboard permissions
DELETE FROM ss_permission_metadata
WHERE name ILIKE 'Dashboard%';

-- 3) Remove menu<->role joins for dashboard menus
DELETE FROM ss_menu_item_metadata_roles_ss_role_metadata
WHERE ss_menu_item_metadata_id IN (
  SELECT m.id
  FROM ss_menu_item_metadata m
  WHERE m.name IN (
    'dashboardManagement-menu-item',
    'dashboard-menu-item',
    'dashboardQuestion-menu-item',
    'dashboardLayout-menu-item'
  )
);

-- 4) Remove dashboard menus
DELETE FROM ss_menu_item_metadata
WHERE name IN (
  'dashboardManagement-menu-item',
  'dashboard-menu-item',
  'dashboardQuestion-menu-item',
  'dashboardLayout-menu-item'
);

-- 5) Remove dashboard actions
DELETE FROM ss_action_metadata
WHERE name IN (
  'dashboard-list-action',
  'dashboardVariable-list-action',
  'dashboardQuestion-list-action',
  'dashboardLayout-list-action',
  'dashboardQuestionSqlDatasetConfig-list-action'
);

-- 6) Remove user-specific view overrides for dashboard views
DELETE FROM ss_user_view_metadata
WHERE view_metadata_id IN (
  SELECT v.id
  FROM ss_view_metadata v
  WHERE v.name IN (
    'dashboard-list-view',
    'dashboard-form-view',
    'dashboardVariable-list-view',
    'dashboardVariable-form-view',
    'dashboardQuestion-list-view',
    'dashboardQuestion-form-view',
    'dashboardQuestionSqlDatasetConfig-list-view',
    'dashboardQuestionSqlDatasetConfig-form-view',
    'dashboardLayout-list-view',
    'dashboardLayout-form-view'
  )
);

-- 7) Remove saved filters tied to dashboard models/views
DELETE FROM ss_saved_fitlers
WHERE model_id IN (
  SELECT m.id
  FROM ss_model_metadata m
  JOIN ss_module_metadata mm ON mm.id = m.module_id
  WHERE mm.name = 'solid-core'
    AND m.singular_name IN (
      'dashboard',
      'dashboardVariable',
      'dashboardQuestion',
      'dashboardQuestionSqlDatasetConfig',
      'dashboardLayout'
    )
)
OR view_id IN (
  SELECT v.id
  FROM ss_view_metadata v
  WHERE v.name IN (
    'dashboard-list-view',
    'dashboard-form-view',
    'dashboardVariable-list-view',
    'dashboardVariable-form-view',
    'dashboardQuestion-list-view',
    'dashboardQuestion-form-view',
    'dashboardQuestionSqlDatasetConfig-list-view',
    'dashboardQuestionSqlDatasetConfig-form-view',
    'dashboardLayout-list-view',
    'dashboardLayout-form-view'
  )
);

-- 8) Remove security rules attached to dashboard models (if any)
DELETE FROM ss_security_rule
WHERE model_metadata_id IN (
  SELECT m.id
  FROM ss_model_metadata m
  JOIN ss_module_metadata mm ON mm.id = m.module_id
  WHERE mm.name = 'solid-core'
    AND m.singular_name IN (
      'dashboard',
      'dashboardVariable',
      'dashboardQuestion',
      'dashboardQuestionSqlDatasetConfig',
      'dashboardLayout'
    )
);

-- 9) Remove dashboard views
DELETE FROM ss_view_metadata
WHERE name IN (
  'dashboard-list-view',
  'dashboard-form-view',
  'dashboardVariable-list-view',
  'dashboardVariable-form-view',
  'dashboardQuestion-list-view',
  'dashboardQuestion-form-view',
  'dashboardQuestionSqlDatasetConfig-list-view',
  'dashboardQuestionSqlDatasetConfig-form-view',
  'dashboardLayout-list-view',
  'dashboardLayout-form-view'
);

-- 10) Remove dashboard models (fields should cascade via model_id FK)
DELETE FROM ss_model_metadata
WHERE singular_name IN (
  'dashboard',
  'dashboardVariable',
  'dashboardQuestion',
  'dashboardQuestionSqlDatasetConfig',
  'dashboardLayout'
)
AND module_id IN (
  SELECT id FROM ss_module_metadata WHERE name = 'solid-core'
);

COMMIT;
