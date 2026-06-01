export const IS_PUSH_NOTIFICATION_PROVIDER = "IS_PUSH_NOTIFICATION_PROVIDER";

export const PushNotificationProvider = () => {
  return (target: Function) => {
    Reflect.defineMetadata(IS_PUSH_NOTIFICATION_PROVIDER, true, target);
  };
};
