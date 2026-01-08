
-- cleanup script 
EXEC dbo.CleanupModelMetadata @ModelSingularName = N'officeMaster', @AlsoDropModel = 1;
EXEC dbo.CleanupModelMetadata @ModelSingularName = N'subSubCategoryMaster', @AlsoDropModel = 1;
EXEC dbo.CleanupModelMetadata @ModelSingularName = N'subCategoryMaster', @AlsoDropModel = 1;
EXEC dbo.CleanupModelMetadata @ModelSingularName = N'categoryMaster', @AlsoDropModel = 1;
EXEC dbo.CleanupModelMetadata @ModelSingularName = N'city', @AlsoDropModel = 1;
EXEC dbo.CleanupModelMetadata @ModelSingularName = N'state', @AlsoDropModel = 1;
EXEC dbo.CleanupModelMetadata @ModelSingularName = N'bankIfscMaster', @AlsoDropModel = 1;
EXEC dbo.CleanupModelMetadata @ModelSingularName = N'applicationDocumentVerificationMob2Vtb', @AlsoDropModel = 1;
