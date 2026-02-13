import { test, expect } from "./fixtures";

test.describe("Settings Drawer", () => {
    test("should open and close settings drawer", async ({ openWebview }) => {
        const page = await openWebview();

        // Hide loading overlay to allow interaction (since we mock VS Code API, we don't need real backend connection for this test)
        await page.addStyleTag({ content: '.loading-overlay { display: none !important; }' });

        const settingsButton = page.locator('button[aria-label="设置"]');
        await expect(settingsButton).toBeVisible();
        await settingsButton.click();

        const drawer = page.locator(".settings-drawer");
        await expect(drawer).toBeVisible();

        const closeButton = page.locator('button[aria-label="关闭"]');
        await closeButton.click();

        await expect(drawer).not.toBeVisible();
    });

    test("should update and save settings", async ({ openWebview }) => {
        const page = await openWebview();

        // Hide loading overlay to allow interaction
        await page.addStyleTag({ content: '.loading-overlay { display: none !important; }' });

        // Open settings
        await page.locator('button[aria-label="设置"]').click();

        // Update main file
        const mainFileInput = page.locator('input[placeholder="main.tex"]');
        await mainFileInput.fill("thesis.tex");

        // Toggle auto compile
        const autoCompileCheckbox = page.locator('input[type="checkbox"]');
        // Ensure it's checked first if needed, or just toggle
        // For test reliability, let's force it to be unchecked then checked
        const isChecked = await autoCompileCheckbox.isChecked();
        if (isChecked) {
            await autoCompileCheckbox.click();
        }
        await autoCompileCheckbox.click(); // Now it should be checked

        // Save
        const saveButton = page.locator('button:has-text("确认")');
        await saveButton.click();

        // Drawer should close automatically upon success (this verifies our fix)
        const drawer = page.locator(".settings-drawer");
        await expect(drawer).not.toBeVisible();

        // Re-open to verify persistence
        await page.locator('button[aria-label="设置"]').click();
        await expect(mainFileInput).toHaveValue("thesis.tex");
        await expect(autoCompileCheckbox).toBeChecked();
    });
});
