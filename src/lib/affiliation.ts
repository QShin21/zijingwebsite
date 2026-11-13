export const affiliations = ["tsinghua", "peer", "external"] as const;
export type Affiliation = (typeof affiliations)[number];

export const affiliationLabels: Record<Affiliation, string> = {
  tsinghua: "清华用户",
  peer: "友校学生",
  external: "校外人士",
};

const tsinghuaDomains = new Set([
  "tsinghua.edu.cn",
  "mails.tsinghua.edu.cn",
  "mail.tsinghua.edu.cn",
  "tsinghua.org.cn",
  "mail.tsinghua.org.cn",
]);

// Match whole domain labels. A school with a different domain can be added by
// its exact verified domain through EDUCATION_EMAIL_DOMAINS.
const educationSuffixes = [
  "edu", "edu.cn", "edu.au", "edu.hk", "edu.tw", "edu.sg", "edu.my", "edu.ph",
  "edu.vn", "edu.br", "edu.mx", "edu.ar", "ac.uk", "ac.jp", "ac.kr", "ac.nz",
  "ac.in", "ac.za", "ac.il", "ac.at", "ac.th", "ac.id",
];
const label = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
function emailDomain(value: string) {
  const labels = value.split(".");
  return labels.length >= 2 && labels.every(part => label.test(part)) && /^[a-z]{2,63}$|^xn--[a-z0-9-]+$/.test(labels.at(-1)!)
    ? value
    : null;
}

export function accountEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const email = input.trim().toLowerCase();
  if (email.length > 254) return null;
  const [name, domain, extra] = email.split("@");
  if (extra !== undefined || !domain || !emailDomain(domain) ||
      !/^[a-z0-9!#$%&'*+/=?^`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^`{|}~-]+)*$/.test(name) || name.length > 64) return null;
  return email;
}

/** Called by the server after email ownership is verified. */
export function classifyEmail(email: string, extraDomains = process.env.EDUCATION_EMAIL_DOMAINS): Affiliation {
  const domain = accountEmail(email)?.split("@")[1];
  if (!domain) return "external";
  if (tsinghuaDomains.has(domain)) return "tsinghua";
  const listed = extraDomains?.split(",").map(value => value.trim().toLowerCase()) ?? [];
  if (educationSuffixes.some(suffix => domain.endsWith(`.${suffix}`)) || listed.includes(domain)) return "peer";
  return "external";
}
