DROP PROCEDURE IF EXISTS cleanup_model_metadata;

DELIMITER $$

CREATE PROCEDURE cleanup_model_metadata(
    IN p_model_singular_name VARCHAR(255),
    IN p_also_drop_model     TINYINT(1)   -- 0 = false, 1 = true (DEFAULT 0)
)
BEGIN
    DECLARE v_model_id        INT;
    DECLARE v_controller_name VARCHAR(512);

    -- Default p_also_drop_model to 0 when NULL is passed
    IF p_also_drop_model IS NULL THEN
        SET p_also_drop_model = 0;
    END IF;

    --------------------------------------------------------------------
    -- Derive ControllerName from model singular name
    -- e.g. 'city' -> 'CityController'
    --      'bankIfscMaster' -> 'BankIfscMasterController'
    --------------------------------------------------------------------
    SET v_controller_name = CONCAT(
        UPPER(LEFT(p_model_singular_name, 1)),
        SUBSTR(p_model_singular_name, 2),
        'Controller'
    );

    SELECT m.id
      INTO v_model_id
      FROM ss_model_metadata AS m
     WHERE m.singular_name = p_model_singular_name
     LIMIT 1;

    IF v_model_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = CONCAT('CleanupModelMetadata: Model with singular_name "', p_model_singular_name, '" not found.');
    END IF;

    --------------------------------------------------------------------
    -- Temp tables for IDs (session-scoped, dropped at end of session)
    --------------------------------------------------------------------
    DROP TEMPORARY TABLE IF EXISTS tmp_view_ids;
    DROP TEMPORARY TABLE IF EXISTS tmp_action_ids;
    DROP TEMPORARY TABLE IF EXISTS tmp_permission_ids;

    CREATE TEMPORARY TABLE tmp_view_ids       (id INT PRIMARY KEY);
    CREATE TEMPORARY TABLE tmp_action_ids     (id INT PRIMARY KEY);
    CREATE TEMPORARY TABLE tmp_permission_ids (id INT PRIMARY KEY);

    INSERT INTO tmp_view_ids (id)
    SELECT v.id
      FROM ss_view_metadata AS v
     WHERE v.model_id = v_model_id;

    INSERT INTO tmp_action_ids (id)
    SELECT a.id
      FROM ss_action_metadata AS a
     WHERE a.model_id = v_model_id;

    --------------------------------------------------------------------
    -- Collect permissions for this controller:
    -- e.g. CityController.create, CityController.update, etc.
    --------------------------------------------------------------------
    INSERT INTO tmp_permission_ids (id)
    SELECT p.id
      FROM ss_permission_metadata AS p
     WHERE p.name LIKE CONCAT(v_controller_name, '.%');

    --------------------------------------------------------------------
    -- 1) Delete user-view metadata
    --------------------------------------------------------------------
    DELETE FROM ss_user_view_metadata
     WHERE view_metadata_id IN (SELECT id FROM tmp_view_ids);

    --------------------------------------------------------------------
    -- 2) Delete menu items linked via action_id
    --------------------------------------------------------------------
    DELETE FROM ss_menu_item_metadata
     WHERE action_id IN (SELECT id FROM tmp_action_ids);

    --------------------------------------------------------------------
    -- 3) Delete actions
    --------------------------------------------------------------------
    DELETE FROM ss_action_metadata
     WHERE id IN (SELECT id FROM tmp_action_ids);

    --------------------------------------------------------------------
    -- 4) Delete views
    --------------------------------------------------------------------
    DELETE FROM ss_view_metadata
     WHERE id IN (SELECT id FROM tmp_view_ids);

    --------------------------------------------------------------------
    -- 5) Delete import transaction error logs for this model's imports
    --------------------------------------------------------------------
    DELETE FROM ss_import_transaction_error_log
     WHERE import_transaction_id IN (
           SELECT it.id
             FROM ss_import_transaction AS it
            WHERE it.model_metadata_id = v_model_id
     );

    --------------------------------------------------------------------
    -- 6) Delete import transactions linked to the model
    --------------------------------------------------------------------
    DELETE FROM ss_import_transaction
     WHERE model_metadata_id = v_model_id;

    --------------------------------------------------------------------
    -- 7) Delete permissions for this controller
    --    a) Delete from role-permission join table
    --    b) Delete from permission metadata
    --------------------------------------------------------------------
    DELETE FROM ss_role_metadata_permissions_ss_permission_metadata
     WHERE ss_permission_metadata_id IN (SELECT id FROM tmp_permission_ids);

    DELETE FROM ss_permission_metadata
     WHERE id IN (SELECT id FROM tmp_permission_ids);

    --------------------------------------------------------------------
    -- 8) Optionally delete the model row itself (+ fields)
    --------------------------------------------------------------------
    IF p_also_drop_model = 1 THEN

        -- 8a) Null user_key_field_id pointing to fields of this model
        UPDATE ss_model_metadata AS mm
           SET user_key_field_id = NULL
         WHERE user_key_field_id IN (
                SELECT f.id
                  FROM ss_field_metadata AS f
                 WHERE f.model_id = v_model_id
         );

        -- 8b) Null parent_model_id pointing to this model
        UPDATE ss_model_metadata
           SET parent_model_id = NULL
         WHERE parent_model_id = v_model_id;

        -- 8c) Delete model (fields deleted via ON DELETE CASCADE)
        DELETE FROM ss_model_metadata
         WHERE id = v_model_id;

    END IF;

    -- Cleanup temp tables
    DROP TEMPORARY TABLE IF EXISTS tmp_view_ids;
    DROP TEMPORARY TABLE IF EXISTS tmp_action_ids;
    DROP TEMPORARY TABLE IF EXISTS tmp_permission_ids;

END$$

DELIMITER ;
