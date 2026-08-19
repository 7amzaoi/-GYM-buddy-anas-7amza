export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = 'Request'
): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, rej) => {
    t = setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (t !== undefined) clearTimeout(t);
  }
}
