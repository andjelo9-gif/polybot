"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export async function addWallet(formData: FormData) {
  const address = String(formData.get("address") ?? "").trim().toLowerCase();
  const label = String(formData.get("label") ?? "").trim();
  if (!ADDRESS_RE.test(address)) return;
  await sql`
    INSERT INTO wallets (address, label)
    VALUES (${address}, ${label || null})
    ON CONFLICT (address) DO UPDATE SET active = TRUE,
      label = COALESCE(NULLIF(${label}, ''), wallets.label)
  `;
  revalidatePath("/wallets");
}

export async function toggleWallet(formData: FormData) {
  const address = String(formData.get("address") ?? "");
  await sql`UPDATE wallets SET active = NOT active WHERE address = ${address}`;
  revalidatePath("/wallets");
}

export async function removeWallet(formData: FormData) {
  const address = String(formData.get("address") ?? "");
  // Keep wallets that appear in signal history (deactivated) so past
  // stats stay meaningful; hard-delete only wallets with no signals.
  const [{ count }] = await sql`
    SELECT count(*)::int AS count FROM signal_wallets WHERE wallet = ${address}
  `;
  if (count > 0) {
    await sql`UPDATE wallets SET active = FALSE WHERE address = ${address}`;
  } else {
    await sql`DELETE FROM wallets WHERE address = ${address}`;
  }
  revalidatePath("/wallets");
}
