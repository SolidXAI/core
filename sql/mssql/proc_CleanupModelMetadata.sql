CREATE PROCEDURE [dbo].[CleanupModelMetadata]
    @ModelSingularName NVARCHAR(255),
    @AlsoDropModel BIT = 0   -- 0 = only menus/views/actions/imports; 1 = also delete model + fields
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ModelId INT;
    DECLARE @ControllerName NVARCHAR(255);

    --------------------------------------------------------------------
    -- Derive ControllerName from model singular name
    -- e.g. 'city' -> 'CityController'
    --      'bankIfscMaster' -> 'BankIfscMasterController'
    --------------------------------------------------------------------
    SET @ControllerName =
        UPPER(LEFT(@ModelSingularName, 1)) +
        SUBSTRING(@ModelSingularName, 2, LEN(@ModelSingularName) - 1) +
        N'Controller';

    SELECT @ModelId = m.id
    FROM   dbo.ss_model_metadata AS m
    WHERE  m.singular_name = @ModelSingularName;

    IF @ModelId IS NULL
    BEGIN
        RAISERROR ('CleanupModelMetadata: Model with singular_name "%s" not found.', 16, 1, @ModelSingularName);
        RETURN;
    END

    BEGIN TRY
        BEGIN TRAN;

        --------------------------------------------------------------------
        -- Temp tables for IDs
        --------------------------------------------------------------------
        IF OBJECT_ID('tempdb..#ViewIds') IS NOT NULL DROP TABLE #ViewIds;
        IF OBJECT_ID('tempdb..#ActionIds') IS NOT NULL DROP TABLE #ActionIds;
        IF OBJECT_ID('tempdb..#PermissionIds') IS NOT NULL DROP TABLE #PermissionIds;

        CREATE TABLE #ViewIds (id INT PRIMARY KEY);
        CREATE TABLE #ActionIds (id INT PRIMARY KEY);
        CREATE TABLE #PermissionIds (id INT PRIMARY KEY);

        INSERT INTO #ViewIds (id)
        SELECT v.id
        FROM   dbo.ss_view_metadata AS v
        WHERE  v.model_id = @ModelId;

        INSERT INTO #ActionIds (id)
        SELECT DISTINCT a.id
        FROM   dbo.ss_action_metadata AS a
        WHERE  a.model_id = @ModelId
           OR  (a.view_id IS NOT NULL AND a.view_id IN (SELECT id FROM #ViewIds));

        --------------------------------------------------------------------
        -- Collect permissions for this controller:
        -- e.g. CityController.create, CityController.update, etc.
        --------------------------------------------------------------------
        INSERT INTO #PermissionIds (id)
        SELECT p.id
        FROM   dbo.ss_permission_metadata AS p
        WHERE  p.name LIKE @ControllerName + N'.%';

        --------------------------------------------------------------------
        -- 1) Delete user-view metadata
        --------------------------------------------------------------------
        DELETE uvm
        FROM   dbo.ss_user_view_metadata AS uvm
        WHERE  uvm.view_metadata_id IN (SELECT id FROM #ViewIds);

        --------------------------------------------------------------------
        -- 2) Delete menu items linked via action_id
        --    Role join table is handled by ON DELETE CASCADE.
        --------------------------------------------------------------------
        DELETE mi
        FROM   dbo.ss_menu_item_metadata AS mi
        WHERE  mi.action_id IN (SELECT id FROM #ActionIds);

        --------------------------------------------------------------------
        -- 3) Delete actions
        --------------------------------------------------------------------
        DELETE a
        FROM   dbo.ss_action_metadata AS a
        WHERE  a.id IN (SELECT id FROM #ActionIds);

        --------------------------------------------------------------------
        -- 4) Delete views
        --------------------------------------------------------------------
        DELETE v
        FROM   dbo.ss_view_metadata AS v
        WHERE  v.id IN (SELECT id FROM #ViewIds);

        --------------------------------------------------------------------
        -- 5) Delete import transaction error logs for this model's imports
        --------------------------------------------------------------------
        DELETE itel
        FROM   dbo.ss_import_transaction_error_log AS itel
        WHERE  itel.import_transaction_id IN (
                   SELECT it.id
                   FROM   dbo.ss_import_transaction AS it
                   WHERE  it.model_metadata_id = @ModelId
               );

        --------------------------------------------------------------------
        -- 6) Delete import transactions linked to the model
        --------------------------------------------------------------------
        DELETE it
        FROM   dbo.ss_import_transaction AS it
        WHERE  it.model_metadata_id = @ModelId;

        --------------------------------------------------------------------
        -- 7) Delete permissions for this controller
        --    a) Delete from role-permission join table
        --    b) Delete from permission metadata
        --------------------------------------------------------------------
        DELETE rp
        FROM   dbo.ss_role_metadata_permissions_ss_permission_metadata AS rp
        WHERE  rp.ss_permission_metadata_id IN (SELECT id FROM #PermissionIds);

        DELETE p
        FROM   dbo.ss_permission_metadata AS p
        WHERE  p.id IN (SELECT id FROM #PermissionIds);

        --------------------------------------------------------------------
        -- 8) Optionally delete the model + fields
        --------------------------------------------------------------------
        IF @AlsoDropModel = 1
        BEGIN
            --------------------------------------------------------------
            -- 8a) Null user_key_field_id pointing to this model's fields
            --------------------------------------------------------------
            UPDATE mm
            SET    mm.user_key_field_id = NULL
            FROM   dbo.ss_model_metadata AS mm
            WHERE  mm.user_key_field_id IN (
                       SELECT f.id
                       FROM   dbo.ss_field_metadata AS f
                       WHERE  f.model_id = @ModelId
                   );

            --------------------------------------------------------------
            -- 8b) Null parent_model_id pointing to this model
            --------------------------------------------------------------
            UPDATE mm
            SET    mm.parent_model_id = NULL
            FROM   dbo.ss_model_metadata AS mm
            WHERE  mm.parent_model_id = @ModelId;

            --------------------------------------------------------------
            -- 8c) Delete model
            --     Fields are deleted automatically via ON DELETE CASCADE
            --------------------------------------------------------------
            DELETE m
            FROM   dbo.ss_model_metadata AS m
            WHERE  m.id = @ModelId;
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
               @ErrorState = ERROR_STATE();

        RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH
END
