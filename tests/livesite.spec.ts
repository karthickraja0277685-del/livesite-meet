import { test, expect } from "@playwright/test";
import AdmZip from "adm-zip";
import crypto from "crypto";

// Helper to create an in-memory ZIP buffer for testing uploads
function buildZipBuffer(files: Record<string, string>): Buffer {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(files)) {
    zip.addFile(name, Buffer.from(content, "utf-8"));
  }
  return zip.toBuffer();
}

function buildTraversalZip(): Buffer {
  const zip = new AdmZip();
  zip.addFile("index.html", Buffer.from("<h1>Site</h1>"));
  zip.addFile("evil.txt", Buffer.from("pwned"));
  zip.getEntries().find((e) => e.entryName === "evil.txt")!.entryName = "../../evil.txt";
  return zip.toBuffer();
}

test.describe("LiveSite Meet E2E Security & Isolation Suite", () => {
  test("1. 3-Browser Context Isolation: Attendee 1 form input and localStorage never leak to Attendees 2 and 3", async ({
    browser,
    request
  }) => {
    const hostId = crypto.randomUUID();

    // 1. Host creates a meeting via API
    const createRes = await request.post("/api/meetings", {
      headers: {
        "x-test-host-id": hostId,
        "x-test-host-email": "host@livesite.test"
      },
      data: { title: "3-Browser Isolation Test Meeting" }
    });
    expect(createRes.status()).toBe(201);
    const { meeting } = await createRes.json();

    // 2. Host uploads a static site with an interactive form and localStorage sync
    const validSiteZip = buildZipBuffer({
      "index.html": `<!DOCTYPE html>
<html>
  <body>
    <h1 id="site-heading">Interactive Demo Site</h1>
    <input id="note-input" placeholder="Type private note" />
    <button id="save-btn" onclick="localStorage.setItem('secretNote', document.getElementById('note-input').value)">Save</button>
  </body>
</html>`
    });

    const uploadRes = await request.post(`/api/meetings/${meeting.id}/upload`, {
      headers: { "x-test-host-id": hostId },
      multipart: {
        file: {
          name: "site.zip",
          mimeType: "application/zip",
          buffer: validSiteZip
        }
      }
    });
    expect(uploadRes.status()).toBe(200);

    // 3. Launch 3 completely separate browser contexts (Attendee 1, Attendee 2, Attendee 3)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const context3 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    const page3 = await context3.newPage();

    for (const [idx, page] of [page1, page2, page3].entries()) {
      await page.goto(`/meet/${meeting.id}`);
      await page.getByTestId("join-name-input").fill(`Attendee ${idx + 1}`);
      await page.getByTestId("join-submit-btn").click();
      await expect(page.getByTestId("isolated-site-iframe")).toBeVisible();
    }

    // Verify all 3 attendees received distinct subdomain origins
    const src1 = await page1.getByTestId("isolated-site-iframe").getAttribute("src");
    const src2 = await page2.getByTestId("isolated-site-iframe").getAttribute("src");
    const src3 = await page3.getByTestId("isolated-site-iframe").getAttribute("src");
    expect(src1).not.toEqual(src2);
    expect(src2).not.toEqual(src3);

    // 4. Attendee 1 types in the form and writes to localStorage inside their iframe
    const frame1 = page1.frameLocator('[data-testid="isolated-site-iframe"]');
    await frame1.locator("#note-input").fill("Attendee 1 Private Secret");
    await frame1.locator("#save-btn").click();

    const frame2 = page2.frameLocator('[data-testid="isolated-site-iframe"]');
    const frame3 = page3.frameLocator('[data-testid="isolated-site-iframe"]');

    // 5. Assert Attendees 2 and 3 do NOT see Attendee 1's input value or localStorage item
    await expect(frame2.locator("#note-input")).toHaveValue("");
    await expect(frame3.locator("#note-input")).toHaveValue("");

    const storage2 = await frame2.locator("body").evaluate(() => localStorage.getItem("secretNote"));
    const storage3 = await frame3.locator("body").evaluate(() => localStorage.getItem("secretNote"));
    expect(storage2).toBeNull();
    expect(storage3).toBeNull();

    await context1.close();
    await context2.close();
    await context3.close();
  });

  test("2. Authorization Guard: Non-host cannot upload a ZIP or end the meeting", async ({
    request,
    playwright,
    baseURL
  }) => {
    const hostId = crypto.randomUUID();
    const createRes = await request.post("/api/meetings", {
      headers: { "x-test-host-id": hostId },
      data: { title: "Host Permission Guard Test" }
    });
    const { meeting } = await createRes.json();

    const zipBuffer = buildZipBuffer({ "index.html": "<h1>Hello</h1>" });
    const anon = await playwright.request.newContext({ baseURL: baseURL! });

    // Non-host (cookie-free client) attempts to upload a ZIP -> Must return 403 Forbidden
    const unauthorizedUpload = await anon.post(
      `/api/meetings/${meeting.id}/upload`,
      {
        multipart: {
          file: {
            name: "site.zip",
            mimeType: "application/zip",
            buffer: zipBuffer
          }
        }
      }
    );
    expect(unauthorizedUpload.status()).toBe(403);

    // Non-host (cookie-free client) attempts to end the meeting -> Must return 403 Forbidden
    const unauthorizedEnd = await anon.post(`/api/meetings/${meeting.id}/end`);
    expect(unauthorizedEnd.status()).toBe(403);

    await anon.dispose();
  });

  test("3. Malicious ZIP Guard: Rejects path traversal (zip-slip) and blocked executable/server file types", async ({
    request
  }) => {
    const hostId = crypto.randomUUID();
    const createRes = await request.post("/api/meetings", {
      headers: { "x-test-host-id": hostId },
      data: { title: "ZIP Validation Security Test" }
    });
    const { meeting } = await createRes.json();

    // Case A: Path traversal (`../../etc/passwd`)
    const traversalZip = buildTraversalZip();
    const traversalRes = await request.post(`/api/meetings/${meeting.id}/upload`, {
      headers: { "x-test-host-id": hostId },
      multipart: {
        file: {
          name: "traversal.zip",
          mimeType: "application/zip",
          buffer: traversalZip
        }
      }
    });
    expect(traversalRes.status()).toBe(400);
    const traversalJson = await traversalRes.json();
    expect(traversalJson.error).toContain("Path traversal");

    // Case B: Blocked server-side / executable file (`.php`)
    const phpZip = buildZipBuffer({
      "index.html": "<h1>Site</h1>",
      "shell.php": "<?php system($_GET['cmd']); ?>"
    });
    const phpRes = await request.post(`/api/meetings/${meeting.id}/upload`, {
      headers: { "x-test-host-id": hostId },
      multipart: {
        file: {
          name: "php.zip",
          mimeType: "application/zip",
          buffer: phpZip
        }
      }
    });
    expect(phpRes.status()).toBe(400);
    const phpJson = await phpRes.json();
    expect(phpJson.error).toContain("Blocked server-side or executable file");
  });

  test("4. Local Demo Login: POST /api/demo-login grants /api/meetings access while unauthenticated context gets 401", async ({
    playwright,
    baseURL
  }) => {
    const demoContext = await playwright.request.newContext({ baseURL: baseURL! });
    const loginRes = await demoContext.post("/api/demo-login");
    expect(loginRes.status()).toBe(200);

    const meetingsRes = await demoContext.get("/api/meetings");
    expect(meetingsRes.status()).toBe(200);

    const anonContext = await playwright.request.newContext({ baseURL: baseURL! });
    const unauthRes = await anonContext.get("/api/meetings");
    expect(unauthRes.status()).toBe(401);

    await demoContext.dispose();
    await anonContext.dispose();
  });
});