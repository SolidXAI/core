CREATE OR REPLACE PROCEDURE cleanup_module_metadata(
    IN p_module_name     text,
    IN p_also_drop_module boolean DEFAULT false
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_module_id int;
BEGIN
    SELECT m.id
      INTO v_module_id
      FROM ss_module_metadata AS m
     WHERE m.name = p_module_name;

    IF v_module_id IS NULL THEN
        RAISE EXCEPTION 'CleanupModuleMetadata: Module "%" not found.', p_module_name;
    END IF;

    ----------------------------------------------------------------
    -- 1) Delete menus for this module (children first, then roots)
    ----------------------------------------------------------------
    DELETE FROM ss_menu_item_metadata AS mi
     WHERE mi.module_id = v_module_id
       AND mi.parent_menu_item_id IS NOT NULL;

    DELETE FROM ss_menu_item_metadata AS mi
     WHERE mi.module_id = v_module_id
       AND mi.parent_menu_item_id IS NULL;

    ----------------------------------------------------------------
    -- 2) Delete actions for this module
    ----------------------------------------------------------------
    DELETE FROM ss_action_metadata AS a
     WHERE a.module_id = v_module_id;

    ----------------------------------------------------------------
    -- 3) Optionally delete the module row itself
    --    (assumes ss_model_metadata.module_id has ON DELETE SET NULL)
    ----------------------------------------------------------------
    IF p_also_drop_module THEN
        DELETE FROM ss_module_metadata AS m
         WHERE m.id = v_module_id;
    END IF;

EXCEPTION
    WHEN others THEN
        -- preserve original error message/SQLSTATE
        RAISE;
END;
$$;