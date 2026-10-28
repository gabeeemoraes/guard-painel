/** Requests are bounded so an unavailable marketplace cannot occupy a function indefinitely. */
export async function marketplaceFetch(input: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(input, { ...init, signal: init.signal ?? AbortSignal.timeout(25000) });
  } catch (error: any) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") throw new Error("O marketplace demorou para responder. Tente novamente.");
    // Never include request URLs: some providers put secrets in the query string.
    throw new Error("Não foi possível comunicar com o marketplace. Tente novamente.");
  }
}
