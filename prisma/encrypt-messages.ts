// Encrypts existing message text with MESSAGE_ENCRYPTION_KEY: `npm run messages:encrypt`.
// Safe to re-run. Plaintext rows are encrypted; with MESSAGE_ENCRYPTION_KEY_PREVIOUS set, rows under the old key are
// re-encrypted with the new one. Also removes message text that older versions copied into notifications.
import { PrismaClient } from "@prisma/client";
import { UNREADABLE_MESSAGE, decryptText, encryptText, isEncrypted, messageEncryptionEnabled } from "../lib/message-crypto";

async function main() {
  if (!messageEncryptionEnabled()) throw new Error("Set MESSAGE_ENCRYPTION_KEY first.");
  const rotating = Boolean(process.env.MESSAGE_ENCRYPTION_KEY_PREVIOUS);
  const prisma = new PrismaClient();
  let updated = 0;
  let unreadable = 0;
  try {
    const messages = await prisma.message.findMany({ select: { id: true, body: true, recordLabel: true } });
    for (const message of messages) {
      const needs = (value: string | null) => value != null && (!isEncrypted(value) || rotating);
      if (!needs(message.body) && !needs(message.recordLabel)) continue;
      const body = decryptText(message.body);
      const recordLabel = decryptText(message.recordLabel);
      if (body === UNREADABLE_MESSAGE || recordLabel === UNREADABLE_MESSAGE) {
        unreadable += 1;
        continue;
      }
      await prisma.message.update({ where: { id: message.id }, data: { body: encryptText(body), recordLabel: encryptText(recordLabel) } });
      updated += 1;
    }
    const scrubbed = await prisma.notification.updateMany({ where: { type: "MESSAGE", NOT: { message: "Open Messages to read it." } }, data: { message: "Open Messages to read it." } });
    console.log(`Encrypted ${updated} of ${messages.length} message(s); cleared text from ${scrubbed.count} notification(s).${unreadable ? ` ${unreadable} message(s) could not be decrypted with the configured keys and were left as-is.` : ""}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(`messages:encrypt: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
