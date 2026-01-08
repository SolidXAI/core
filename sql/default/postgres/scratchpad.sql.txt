-- delete models 
CALL cleanup_model_metadata('myrusPincodeMaster', false);
CALL cleanup_model_metadata('subSubCategoryMaster', true);
CALL cleanup_model_metadata('subCategoryMaster', true);
CALL cleanup_model_metadata('categoryMaster', true);
CALL cleanup_model_metadata('city', true);
CALL cleanup_model_metadata('state', true);
CALL cleanup_model_metadata('bankIfscMaster', true);
CALL cleanup_model_metadata('applicationDocumentVerificationMob2Vtb', true);

-- delete module
CALL cleanup_module_metadata('myrus-address-master', false);