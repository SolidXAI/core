CREATE OR REPLACE PROCEDURE cleanup_model_metadata(
    IN p_model_singular_name text,
    IN p_also_drop_model     boolean DEFAULT false
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_model_id int;
    v_controller_name text;
BEGIN
    --------------------------------------------------------------------
    -- Derive ControllerName from model singular name
    -- e.g. 'city' -> 'CityController'
    --      'bankIfscMaster' -> 'BankIfscMasterController'
    --------------------------------------------------------------------
    v_controller_name :=
        upper(left(p_model_singular_name, 1))
        || substr(p_model_singular_name, 2)
        || 'Controller';

    SELECT m.id
      INTO v_model_id
      FROM ss_model_metadata AS m
     WHERE m.singular_name = p_model_singular_name;

    IF v_model_id IS NULL THEN
        RAISE EXCEPTION
            'CleanupModelMetadata: Model with singular_name "%" not found.',
            p_model_singular_name;
    END IF;

    --------------------------------------------------------------------
    -- Temp tables for IDs (session-scoped)
    --------------------------------------------------------------------
    DROP TABLE IF EXISTS view_ids;
    DROP TABLE IF EXISTS action_ids;
    DROP TABLE IF EXISTS permission_ids;

    CREATE TEMP TABLE view_ids (id int PRIMARY KEY) ON COMMIT DROP;
    CREATE TEMP TABLE action_ids (id int PRIMARY KEY) ON COMMIT DROP;
    CREATE TEMP TABLE permission_ids (id int PRIMARY KEY) ON COMMIT DROP;

    INSERT INTO view_ids (id)
    SELECT v.id
      FROM ss_view_metadata AS v
     WHERE v.model_id = v_model_id;

    INSERT INTO action_ids (id)
    SELECT a.id
      FROM ss_action_metadata AS a
     WHERE a.model_id = v_model_id;

    --------------------------------------------------------------------
    -- Collect permissions for this controller:
    -- e.g. CityController.create, CityController.update, etc.
    --------------------------------------------------------------------
    INSERT INTO permission_ids (id)
    SELECT p.id
      FROM ss_permission_metadata AS p
     WHERE p.name LIKE (v_controller_name || '.%');

    --------------------------------------------------------------------
    -- 1) Delete user-view metadata
    --------------------------------------------------------------------
    DELETE FROM ss_user_view_metadata AS uvm
     WHERE uvm.view_metadata_id IN (SELECT id FROM view_ids);

    --------------------------------------------------------------------
    -- 2) Delete menu items linked via action_id
    --    Role join table is handled by ON DELETE CASCADE (assumed)
    --------------------------------------------------------------------
    DELETE FROM ss_menu_item_metadata AS mi
     WHERE mi.action_id IN (SELECT id FROM action_ids);

    --------------------------------------------------------------------
    -- 3) Delete actions
    --------------------------------------------------------------------
    DELETE FROM ss_action_metadata AS a
     WHERE a.id IN (SELECT id FROM action_ids);

    --------------------------------------------------------------------
    -- 4) Delete views
    --------------------------------------------------------------------
    DELETE FROM ss_view_metadata AS v
     WHERE v.id IN (SELECT id FROM view_ids);

    --------------------------------------------------------------------
    -- 5) Delete import transaction error logs for this model's imports
    --------------------------------------------------------------------
    DELETE FROM ss_import_transaction_error_log AS itel
     WHERE itel.import_transaction_id IN (
           SELECT it.id
             FROM ss_import_transaction AS it
            WHERE it.model_metadata_id = v_model_id
     );

    --------------------------------------------------------------------
    -- 6) Delete import transactions linked to the model
    --------------------------------------------------------------------
    DELETE FROM ss_import_transaction AS it
     WHERE it.model_metadata_id = v_model_id;

    --------------------------------------------------------------------
    -- 7) Delete permissions for this controller
    --    a) Delete from role-permission join table
    --    b) Delete from permission metadata
    --------------------------------------------------------------------
    DELETE FROM ss_role_metadata_permissions_ss_permission_metadata AS rp
     WHERE rp.ss_permission_metadata_id IN (SELECT id FROM permission_ids);

    DELETE FROM ss_permission_metadata AS p
     WHERE p.id IN (SELECT id FROM permission_ids);

    --------------------------------------------------------------------
    -- 8) Optionally delete the model row itself (+ fields)
    --------------------------------------------------------------------
    IF p_also_drop_model THEN
        --------------------------------------------------------------
        -- 8a) Null user_key_field_id pointing to fields of this model
        --------------------------------------------------------------
        UPDATE ss_model_metadata AS mm
           SET user_key_field_id = NULL
         WHERE mm.user_key_field_id IN (
                SELECT f.id
                  FROM ss_field_metadata AS f
                 WHERE f.model_id = v_model_id
         );

        --------------------------------------------------------------
        -- 8b) Null parent_model_id pointing to this model
        --------------------------------------------------------------
        UPDATE ss_model_metadata AS mm
           SET parent_model_id = NULL
         WHERE mm.parent_model_id = v_model_id;

        --------------------------------------------------------------
        -- 8c) Delete model
        --     Fields are deleted automatically via ON DELETE CASCADE
        --------------------------------------------------------------
        DELETE FROM ss_model_metadata AS m
         WHERE m.id = v_model_id;
    END IF;

EXCEPTION
    WHEN others THEN
        RAISE;
END;
$$;