import { extractPage } from '@/lib/extract'

/**
 * Injected on demand by the background via `scripting.executeScript`. WXT appends this
 * function's return value as the script's last expression, so it becomes the injection result.
 * It must stay JSON-serializable.
 */
export default defineUnlistedScript(() => extractPage(document, location.href))
