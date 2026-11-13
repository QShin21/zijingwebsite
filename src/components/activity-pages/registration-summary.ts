import type { Content } from "@/lib/content";
import { registrationState } from "@/lib/rules";
import { normalizeSignup } from "@/lib/signup-schema";
import { signupState } from "@/lib/activity-signups";

/** Public presentation uses the same registration window as the write service. */
export function registrationSummary(doc: Content) {
  if (!doc.signupForm?.enabled) {
    return {
      state: registrationState(doc),
      deadline: doc.registrationEnd || "",
    };
  }
  try {
    const form = normalizeSignup(doc.signupForm);
    const dates = [form.end, doc.registrationEnd].filter(
      (date): date is string =>
        Boolean(date) && Number.isFinite(Date.parse(date!)),
    );
    dates.sort((left, right) => Date.parse(left) - Date.parse(right));
    return { state: signupState(form, doc), deadline: dates[0] || "" };
  } catch {
    // i18n-exempt: Chinese state value compared by callers; localized at display
    return { state: "查看报名说明", deadline: doc.registrationEnd || "" };
  }
}
