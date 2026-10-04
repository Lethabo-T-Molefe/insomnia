export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getPingEngine } = await import("./lib/ping-engine");
    getPingEngine().start();
  }
}
