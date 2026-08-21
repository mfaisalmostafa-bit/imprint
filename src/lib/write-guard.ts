/** Writes are locked by default. A confirm phrase is required. Never mutate live. */

export const CONFIRM_PHRASES: Record<string, string> = {
  "manager.create": "CREATE MANAGER RECORD",
  "wix.patch": "PATCH WIX PRODUCT",
  "wix.delete": "DELETE WIX PRODUCT",
  "zoho.sheet.add": "ADD SHEET ROWS",
  "zoho.sheet.update": "UPDATE SHEET ROWS",
  "zoho.workdrive.folder": "CREATE WORKDRIVE FOLDER",
  "zoho.mail.send": "SEND EMAIL",
};

export const OP_DESC: Record<string, string> = {
  "manager.create": "Create a Manager.io record.",
  "wix.patch": "Overwrite a live product description.",
  "wix.delete": "Delete a hidden Wix product.",
  "zoho.sheet.add": "Append rows to a worksheet.",
  "zoho.workdrive.folder": "Create a WorkDrive folder.",
  "zoho.mail.send": "Send as automations@tepee-x.com.",
};

export type GuardResult =
  | { ok: true }
  | { ok: false; status: 400 | 423; error: string; required?: string; plan?: Record<string, unknown> };

const writesEnabled = false;

export function requireWrite(op: string, confirm: string, body: Record<string, unknown> = {}): GuardResult {
  const phrase = CONFIRM_PHRASES[op];
  if (!phrase) return { ok: false, status: 400, error: `unknown write op '${op}'` };
  if (!writesEnabled) {
    return {
      ok: false,
      status: 423,
      error: "writes are disabled",
      required: phrase,
      plan: { op, would_do: OP_DESC[op], ...body },
    };
  }
  if (confirm !== phrase) {
    return { ok: false, status: 400, error: "confirmation phrase required", required: phrase };
  }
  return { ok: true };
}
