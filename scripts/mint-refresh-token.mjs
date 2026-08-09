#!/usr/bin/env node
/*
 * Mints the CWS_REFRESH_TOKEN that .github/workflows/publish.yml needs.
 *
 *   node scripts/mint-refresh-token.mjs [path/to/client_secret_*.json]
 *
 * Google blocked the old copy-the-code redirect in 2022, so this runs the
 * loopback flow it replaced with: a throwaway server on 127.0.0.1 catches the
 * authorization code, and the code is exchanged for a refresh token that does
 * not expire. Everything is local — no dependencies, nothing leaves the
 * machine except the two calls to Google.
 *
 * Run it in your OWN terminal. It prints a credential that can publish to every
 * existing user of the extension, so it should not be piped anywhere, pasted
 * into a chat, or saved next to the source.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";

const PORT = 8080;
const REDIRECT_URI = `http://localhost:${PORT}`;
const SCOPE = "https://www.googleapis.com/auth/chromewebstore";

const clientPath = process.argv[2] ?? (await findClientFile());
const { client_id: clientId, client_secret: clientSecret } = await readClient(clientPath);

const consentUrl = new URL("https://accounts.google.com/o/oauth2/auth");
consentUrl.search = new URLSearchParams({
  client_id: clientId,
  redirect_uri: REDIRECT_URI,
  response_type: "code",
  scope: SCOPE,
  // offline + consent are what make Google return a refresh token at all, and
  // re-issue one if this client was already approved by this account.
  access_type: "offline",
  prompt: "consent",
}).toString();

console.log(`\nUsing OAuth client from ${clientPath}`);
console.log("\nApprove as the Google account that can publish the extension:\n");
console.log(consentUrl.toString());
console.log("\nWaiting for the redirect back to " + REDIRECT_URI + " …");
open(consentUrl.toString());

const code = await waitForCode();
const tokens = await exchange(code);

if (!tokens.refresh_token) {
  console.error("\nGoogle returned no refresh_token. That usually means this");
  console.error("account already has a live grant for this client — revoke it at");
  console.error("https://myaccount.google.com/permissions and run this again.");
  process.exit(1);
}

console.log("\n─────────────────────────────────────────────");
console.log("CWS_REFRESH_TOKEN (paste into the GitHub secret, then clear your scrollback):\n");
console.log(tokens.refresh_token);
console.log("\n─────────────────────────────────────────────");
console.log("Also needed, from the same file:");
console.log(`  CWS_CLIENT_ID      ${clientId}`);
console.log("  CWS_CLIENT_SECRET  (the client_secret field in that JSON)");
console.log("  CWS_EXTENSION_ID   the 32-character id from your store dashboard URL\n");

async function findClientFile() {
  const match = (await readdir(process.cwd())).find(
    (name) => name.startsWith("client_secret") && name.endsWith(".json"),
  );
  if (!match) {
    console.error("No client_secret*.json here. Pass the path as an argument.");
    process.exit(1);
  }
  return match;
}

async function readClient(path) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    console.error(`Could not read ${path}: ${error.message}`);
    process.exit(1);
  }
  // Desktop clients nest under "installed"; web clients under "web".
  const client = parsed.installed ?? parsed.web ?? parsed;
  if (!client.client_id || !client.client_secret) {
    console.error(`${path} has no client_id/client_secret — is it the OAuth client JSON?`);
    process.exit(1);
  }
  return client;
}

function waitForCode() {
  return new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      const url = new URL(request.url, REDIRECT_URI);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");
      response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      response.end(code ? "Got it. You can close this tab." : `Authorization failed: ${error}`);
      server.close();
      if (code) resolve(code);
      else reject(new Error(error ?? "no code in the redirect"));
    });
    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.error(`Port ${PORT} is busy — free it and run this again.`);
        process.exit(1);
      }
      reject(error);
    });
    server.listen(PORT, "127.0.0.1");
  });
}

async function exchange(code) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  const body = await response.json();
  if (!response.ok) {
    console.error(`\nToken exchange failed (${response.status}): ${body.error} — ${body.error_description ?? ""}`);
    process.exit(1);
  }
  return body;
}

function open(url) {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  try {
    const child = spawn(command, [url], { stdio: "ignore", detached: true, shell: process.platform === "win32" });
    // A missing opener reports asynchronously; the URL is printed above, so a
    // failure to launch a browser is not worth crashing the flow over.
    child.on("error", () => undefined);
    child.unref();
  } catch {
    /* same */
  }
}
