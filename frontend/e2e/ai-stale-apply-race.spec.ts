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


test("stale AI apply is blocked after another collaborator changes the source text", async ({ browser, page }) => {
  const uniqueSuffix = `${Date.now()}`;
  const ownerId = `owner_race_${uniqueSuffix}`;
  const collaboratorId = `collab_race_${uniqueSuffix}`;
  const password = "demo-pass-123";

  await registerUser(page, ownerId, "Owner Race", password);

  await page.getByTestId("new-document-trigger").click();
  await page.getByTestId("new-document-title").fill("AI Race Doc");
  await page.getByTestId("new-document-content").fill("Hello world");
  await page.getByTestId("new-document-submit").click();
  await expect(page).toHaveURL(/\/documents\//);

  const documentId = page.url().split("/documents/")[1];

  await page.getByRole("button", { name: "File" }).click();
  await page.getByRole("menuitem", { name: "Share" }).click();
  await page.getByTestId("share-link-role").selectOption("editor");
  await page.getByTestId("share-link-create").click();
  const shareUrl = await page.locator("text=/\/share\//").last().textContent();
  expect(shareUrl).toBeTruthy();
  await page.locator("[data-testid='permissions-panel'] .side-panel-header").getByRole("button", { name: "Close" }).click();

  const collaboratorContext = await browser.newContext();
  const collaboratorPage = await collaboratorContext.newPage();
  await collaboratorPage.goto(shareUrl!.trim());
  await collaboratorPage.getByRole("link", { name: /create account and accept link/i }).click();
  await collaboratorPage.getByLabel(/display name/i).fill("Collaborator Race");
  await collaboratorPage.getByLabel(/identifier/i).fill(collaboratorId);
  await collaboratorPage.getByLabel(/^password$/i).fill(password);
  await collaboratorPage.getByLabel(/confirm password/i).fill(password);
  await collaboratorPage.getByRole("button", { name: /create account/i }).click();
  await collaboratorPage.getByRole("button", { name: /accept editor access/i }).click();
  await expect(collaboratorPage).toHaveURL(new RegExp(`/documents/${documentId}`));

  await selectEditorRange(page, 0, 5);
  await page.getByTestId("open-ai-panel").click();
  await page.getByTestId("ai-run").click();
  await expect(page.getByTestId("ai-apply-all")).toBeVisible();

  await selectEditorRange(collaboratorPage, 0, 5);
  await collaboratorPage.keyboard.type("Changed");
  await expect(page.getByTestId("document-editor")).toContainText("Changed world");

  await page.getByTestId("ai-apply-all").click();

  await expect(page.getByText(/selected text changed before the ai result was applied/i)).toBeVisible();
  await expect(page.getByTestId("ai-panel")).toBeVisible();
  await expect(page.getByTestId("document-editor")).toContainText("Changed world");
  await expect(collaboratorPage.getByTestId("document-editor")).toContainText("Changed world");

  await collaboratorContext.close();
});
