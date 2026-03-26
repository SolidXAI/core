DROP PROCEDURE IF EXISTS cleanup_module_metadata;

DELIMITER $$

CREATE PROCEDURE cleanup_module_metadata(
    IN p_module_name      VARCHAR(255),
    IN p_also_drop_module TINYINT(1)   -- 0 = false, 1 = true (DEFAULT 0)
)
BEGIN
    DECLARE v_module_id INT;

    -- Default p_also_drop_module to 0 when NULL is passed
    IF p_also_drop_module IS NULL THEN
        SET p_also_drop_module = 0;
    END IF;

    SELECT m.id
      INTO v_module_id
      FROM ss_module_metadata AS m
     WHERE m.name = p_module_name
     LIMIT 1;

    IF v_module_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = CONCAT('CleanupModuleMetadata: Module "', p_module_name, '" not found.');
    END IF;

    ----------------------------------------------------------------
    -- 1) Delete menus for this module (children first, then roots)
    ----------------------------------------------------------------
    DELETE FROM ss_menu_item_metadata
     WHERE module_id = v_module_id
       AND parent_menu_item_id IS NOT NULL;

    DELETE FROM ss_menu_item_metadata
     WHERE module_id = v_module_id
       AND parent_menu_item_id IS NULL;

    ----------------------------------------------------------------
    -- 2) Delete actions for this module
    ----------------------------------------------------------------
    DELETE FROM ss_action_metadata
     WHERE module_id = v_module_id;

    ----------------------------------------------------------------
    -- 3) Optionally delete the module row itself
    --    (assumes ss_model_metadata.module_id has ON DELETE SET NULL)
    ----------------------------------------------------------------
    IF p_also_drop_module = 1 THEN
        DELETE FROM ss_module_metadata
         WHERE id = v_module_id;
    END IF;

END$$

DELIMITER ;
