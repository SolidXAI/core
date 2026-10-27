/**
 * The plain words for the ways starting a session on a real iPhone fails. Appium reports them as the text of the build
 * tool or of the phone, which says what went wrong but not what to do.
 */

/** What `mobile.launch {clearData: true}` says on a phone (D41): there is no build to reinstall, so there is no reset. */
export const CLEAR_DATA_ON_PHONE =
  "Clearing data on an iPhone is not supported: Test Hub uses the app already installed on the phone. " +
  "Remove clearData from mobile.launch, or log out at the start of the scenario.";

/** What `mobile.hideKeyboard` says on a phone when the keyboard is still shown after every way of hiding it (D47). */
export const KEYBOARD_STAYS_ON_PHONE =
  "mobile.hideKeyboard: the keyboard could not be hidden on this screen. It stayed up after the keyboard's Done key, a tap " +
  "outside the fields and a swipe down, so this screen only ends editing on a control of its own.";

/** A tap or type whose control is under a keyboard that would not go away. */
export function keyboardBlocks(label: string): string {
  return (
    `The keyboard covers ${label} and could not be hidden: this screen does not end editing on the keyboard's Done ` +
    `key, a tap outside the fields or a swipe down, and ${label} cannot be scrolled above it.`
  );
}

const CAUSES: Array<{ when: (text: string) => boolean; hint: string }> = [
  {
    when: (t) => /has not been explicitly trusted by the user|invalid code signature/i.test(t),
    hint: "Trust the developer on the iPhone: Settings › General › VPN & Device Management, then run again.",
  },
  {
    // A message about an expired profile names the profile, not just any expiry.
    when: (t) => /expired/i.test(t) && /provisioning|profile/i.test(t),
    hint: "WebDriverAgent's provisioning profile has expired. Run again: Test Hub rebuilds it.",
  },
  {
    // Not just "is not available": that phrase appears in unrelated errors. Xcode's own text names the registration.
    when: (t) => /Failed Registering Bundle Identifier|cannot be registered to your development team/i.test(t),
    hint: "Apple refused WebDriverAgent's app id. Set TESTHUB_IOS_WDA_BUNDLE_ID to another unique id.",
  },
  {
    when: (t) => /Developer Mode/i.test(t),
    hint: "Turn on Developer Mode: Settings › Privacy & Security › Developer Mode.",
  },
];

/** The fix for a failed phone session start, or undefined when the text is not one this knows. */
export function explainPhoneStartError(message: string): string | undefined {
  return CAUSES.find((cause) => cause.when(message))?.hint;
}

/** The original error's first line with the fix after it, as one message. */
export function withPhoneHint(message: string): string | undefined {
  const hint = explainPhoneStartError(message);
  if (!hint) return undefined;
  const first = message.split("\n")[0].trim().replace(/[.:\s]+$/, "");
  return first ? `${first}. ${hint}` : hint;
}
