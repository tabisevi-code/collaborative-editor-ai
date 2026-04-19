import fs from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";


async function registerUser(page: Page, identifier: string, displayName: string, password: string) {
  await page.goto("/register");
  await page.getByLabel(/display name/i).fill(displayName);
  await page.getByLabel(/identifier/i).fill(identifier);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByLabel(/confirm password/i).fill(password);
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page.getByText(/welcome back/i)).toBeVisible();
}


async function selectEditorRange(page: Page, start: number, end: number) {
  await page.evaluate(
    ({ startOffset, endOffset }) => {
      const editor = document.querySelector('[data-testid="document-editor"]');
      if (!(editor instanceof HTMLElement)) {
        throw new Error("Editor not found");
      }

      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
      let traversed = 0;
      let current = walker.nextNode();
      let startNode: Node | null = null;
      let endNode: Node | null = null;
      let startInnerOffset = 0;
      let endInnerOffset = 0;

      while (current) {
        const length = current.textContent?.length ?? 0;
        if (!startNode && traversed + length >= startOffset) {
          startNode = current;
          startInnerOffset = Math.max(0, startOffset - traversed);
        }
        if (!endNode && traversed + length >= endOffset) {
          endNode = current;
          endInnerOffset = Math.max(0, endOffset - traversed);
          break;
        }
        traversed += length;
        current = walker.nextNode();
      }

      if (!startNode || !endNode) {
        throw new Error("Could not resolve selection offsets");
      }

      const range = document.createRange();
      range.setStart(startNode, startInnerOffset);
      range.setEnd(endNode, endInnerOffset);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
    },
    { startOffset: start, endOffset: end }
  );
}


test("owner can share by link, collaborate live, run AI, revert, and download real exports", async ({ browser, page }) => {
  const uniqueSuffix = `${Date.now()}`;
  const ownerId = `owner_${uniqueSuffix}`;
  const collaboratorId = `collab_${uniqueSuffix}`;
  const password = "demo-pass-123";

  await registerUser(page, ownerId, "Owner User", password);

  await page.getByTestId("new-document-trigger").click();
  await page.getByTestId("new-document-title").fill("Playwright Outstanding Doc");
  await page.getByTestId("new-document-content").fill("Hello collaborative world");
  await page.getByTestId("new-document-submit").click();

  await expect(page).toHaveURL(/\/documents\//);
  const documentUrl = page.url();
  const documentId = documentUrl.split("/documents/")[1];

  const editor = page.getByTestId("document-editor");
  await editor.click();
  await page.keyboard.press(`${process.platform === "darwin" ? "Meta" : "Control"}+A`);
  await page.keyboard.type("Hello collaborative world");

  await page.getByRole("button", { name: "File" }).click();
  await page.getByRole("menuitem", { name: "Share" }).click();
  await page.getByTestId("share-link-role").selectOption("editor");
  await page.getByTestId("share-link-create").click();
  const shareUrl = await page.locator("text=/\/share\//").last().textContent();
  expect(shareUrl).toBeTruthy();
  await page.locator("[data-testid='permissions-panel'] .side-panel-header").getByRole("button", { name: "Close" }).click();

  const collaboratorContext = await browser.newContext({ acceptDownloads: true });
  const collaboratorPage = await collaboratorContext.newPage();
  await collaboratorPage.goto(shareUrl!.trim());
  await collaboratorPage.getByRole("link", { name: /create account and accept link/i }).click();
  await collaboratorPage.getByLabel(/display name/i).fill("Collaborator User");
  await collaboratorPage.getByLabel(/identifier/i).fill(collaboratorId);
  await collaboratorPage.getByLabel(/^password$/i).fill(password);
  await collaboratorPage.getByLabel(/confirm password/i).fill(password);
  await collaboratorPage.getByRole("button", { name: /create account/i }).click();
  await collaboratorPage.getByRole("button", { name: /accept editor access/i }).click();
  await expect(collaboratorPage).toHaveURL(new RegExp(`/documents/${documentId}`));

  await expect(collaboratorPage.getByText("Hello collaborative world")).toBeVisible();
  const originalEditorText = (await page.getByTestId("document-editor").textContent()) || "";

  await selectEditorRange(page, 0, 5);
  await expect(collaboratorPage.locator(".gdoc-remote-label", { hasText: ownerId })).toBeVisible();

  await page.getByTestId("open-ai-panel").click();
  await expect(page.getByTestId("ai-panel")).toBeVisible();
  await page.getByTestId("ai-run").click();
  await expect(page.getByTestId("ai-apply-all")).toBeVisible();
  await page.getByTestId("ai-apply-all").click();
  await expect(page.getByTestId("document-editor")).not.toHaveText(originalEditorText);

  await page.getByTestId("open-version-history").click();
  await expect(page.getByTestId("version-preview-panel")).toBeVisible();
  await page.locator('[data-testid^="revert-version-"]').last().click();
  await expect(page.getByText(/remote revert was applied/i)).toBeVisible();

  await page.getByRole("button", { name: "File" }).click();
  await page.getByRole("menuitem", { name: "Export" }).click();
  await page.getByTestId("export-format").selectOption("pdf");
  await page.getByTestId("export-start").click();
  await expect(page.getByText(/export ready/i)).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-download").click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const pdfBytes = await fs.readFile(downloadPath!);
  expect(pdfBytes.subarray(0, 4).toString()).toBe("%PDF");

  await page.locator("[data-testid='export-panel'] .side-panel-header").getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "File" }).click();
  await page.getByRole("menuitem", { name: "Export" }).click();
  await page.getByTestId("export-format").selectOption("docx");
  await page.getByTestId("export-start").click();
  await expect(page.getByText(/export ready/i)).toBeVisible();

  const docxDownloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-download").click();
  const docxDownload = await docxDownloadPromise;
  const docxPath = await docxDownload.path();
  expect(docxPath).toBeTruthy();
  const docxBytes = await fs.readFile(docxPath!);
  expect(docxBytes.subarray(0, 2).toString()).toBe("PK");

  await collaboratorContext.close();
});
