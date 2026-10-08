/** True on a deployment explicitly marked as a demo (NEXT_PUBLIC_DEMO_MODE=true, committed in .env.production). */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
