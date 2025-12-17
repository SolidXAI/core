CREATE   PROCEDURE [dbo].[CleanupModuleMetadata]
    @ModuleName     NVARCHAR(255),
    @AlsoDropModule BIT = 0   -- 0 = only menus + actions, 1 = also delete module row
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ModuleId INT;

    SELECT @ModuleId = m.id
    FROM   dbo.ss_module_metadata AS m
    WHERE  m.name = @ModuleName;

    IF @ModuleId IS NULL
    BEGIN
        RAISERROR ('CleanupModuleMetadata: Module "%s" not found.', 16, 1, @ModuleName);
        RETURN;
    END

    BEGIN TRY
        BEGIN TRAN;

        ----------------------------------------------------------------
        -- 1) Delete menu items for this module
        --    (children first because parent FK has NO cascade)
        ----------------------------------------------------------------
        -- Children
        DELETE mi
        FROM   dbo.ss_menu_item_metadata AS mi
        WHERE  mi.module_id = @ModuleId
          AND  mi.parent_menu_item_id IS NOT NULL;

        -- Roots
        DELETE mi
        FROM   dbo.ss_menu_item_metadata AS mi
        WHERE  mi.module_id = @ModuleId
          AND  mi.parent_menu_item_id IS NULL;

        -- Note: Role join table
        -- dbo.ss_menu_item_metadata_roles_ss_role_metadata
        -- is cleaned automatically via ON DELETE CASCADE from menu items.

        ----------------------------------------------------------------
        -- 2) Delete actions for this module
        ----------------------------------------------------------------
        DELETE a
        FROM   dbo.ss_action_metadata AS a
        WHERE  a.module_id = @ModuleId;

        ----------------------------------------------------------------
        -- 3) Optionally delete the module row itself
        --    Models keep their rows; module_id is set to NULL on delete
        --    because of ON DELETE SET NULL in ss_model_metadata.
        ----------------------------------------------------------------
        IF @AlsoDropModule = 1
        BEGIN
            DELETE m
            FROM   dbo.ss_module_metadata AS m
            WHERE  m.id = @ModuleId;
        END

        COMMIT TRAN;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRAN;

        DECLARE @ErrorMessage NVARCHAR(4000),
                @ErrorSeverity INT,
                @ErrorState INT;

        SELECT @ErrorMessage = ERROR_MESSAGE(),
               @ErrorSeverity = ERROR_SEVERITY(),
               @ErrorState    = ERROR_STATE();

        RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH
END
