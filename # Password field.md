# Password field
## Create Scenario
- password
- passwordConfirm (stuck)
## Update Scenario
- A button will show up instead & password fields won't be shown in the form
- Clicking on the button will open a modal containing the password & passwordConfirm fields, with a button named as "Update". clicking on Update will patch the record with the password & passwordConfirm fields
- Add an extra in validateAndTranform in crud service i.e isUpdate i.e default false. this will true when update method of crud service is called. Add logic in PasswordFieldCrudManager to throw required error only if !isUpdate
