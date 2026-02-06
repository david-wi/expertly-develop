import { test, expect } from '@playwright/test'

test.describe('Dashboard Widget System', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/')
  })

  test('displays dashboard with widgets', async ({ page }) => {
    // Check that the dashboard title is visible
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

    // Check that default widgets are present
    await expect(page.getByText('Overview')).toBeVisible()
    await expect(page.getByText('My Active Tasks')).toBeVisible()
    await expect(page.getByText('Queues')).toBeVisible()
  })

  test('shows customize dashboard button', async ({ page }) => {
    const customizeButton = page.getByRole('button', { name: /Customize Dashboard/i })
    await expect(customizeButton).toBeVisible()
  })

  test('enters edit mode when clicking customize', async ({ page }) => {
    // Click customize button
    await page.getByRole('button', { name: /Customize Dashboard/i }).click()

    // Should now show Done button
    await expect(page.getByRole('button', { name: /Done/i })).toBeVisible()

    // Should show Add Widget button
    await expect(page.getByRole('button', { name: /Add Widget/i })).toBeVisible()

    // Should show Reset button
    await expect(page.getByRole('button', { name: /Reset/i })).toBeVisible()
  })

  test('exits edit mode when clicking done', async ({ page }) => {
    // Enter edit mode
    await page.getByRole('button', { name: /Customize Dashboard/i }).click()
    await expect(page.getByRole('button', { name: /Done/i })).toBeVisible()

    // Click Done
    await page.getByRole('button', { name: /Done/i }).click()

    // Should return to normal mode
    await expect(page.getByRole('button', { name: /Customize Dashboard/i })).toBeVisible()
  })

  test('opens add widget modal', async ({ page }) => {
    // Enter edit mode
    await page.getByRole('button', { name: /Customize Dashboard/i }).click()

    // Click Add Widget
    await page.getByRole('button', { name: /Add Widget/i }).click()

    // Modal should be visible
    await expect(page.getByText('Add Widget', { exact: true })).toBeVisible()

    // Should show available widgets
    await expect(page.getByText('Stats Overview')).toBeVisible()
    await expect(page.getByText('My Active Tasks')).toBeVisible()
    await expect(page.getByText('My Queues')).toBeVisible()
    await expect(page.getByText('Monitors Summary')).toBeVisible()
  })

  test('shows "Already added" for widgets that are present', async ({ page }) => {
    // Enter edit mode
    await page.getByRole('button', { name: /Customize Dashboard/i }).click()

    // Click Add Widget
    await page.getByRole('button', { name: /Add Widget/i }).click()

    // Default widgets should show "Already added"
    await expect(page.getByText('Already added').first()).toBeVisible()
  })

  test('closes add widget modal with X button', async ({ page }) => {
    // Enter edit mode
    await page.getByRole('button', { name: /Customize Dashboard/i }).click()

    // Click Add Widget
    await page.getByRole('button', { name: /Add Widget/i }).click()
    await expect(page.getByText('Add Widget', { exact: true })).toBeVisible()

    // Close modal
    await page.locator('.fixed button').first().click()

    // Modal should be closed
    await expect(page.getByText('Add Widget', { exact: true })).not.toBeVisible()
  })

  test('resets dashboard to default layout', async ({ page }) => {
    // Enter edit mode
    await page.getByRole('button', { name: /Customize Dashboard/i }).click()

    // Click Reset
    await page.getByRole('button', { name: /Reset/i }).click()

    // Should exit edit mode (Reset also exits edit mode)
    await expect(page.getByRole('button', { name: /Customize Dashboard/i })).toBeVisible()

    // Default widgets should still be present
    await expect(page.getByText('Overview')).toBeVisible()
    await expect(page.getByText('My Active Tasks')).toBeVisible()
  })

  test('persists widget layout across page refresh', async ({ page }) => {
    // Verify Overview widget is visible
    await expect(page.getByText('Overview')).toBeVisible()

    // Refresh the page
    await page.reload()

    // Widgets should still be visible
    await expect(page.getByText('Overview')).toBeVisible()
    await expect(page.getByText('My Active Tasks')).toBeVisible()
    await expect(page.getByText('Queues')).toBeVisible()
  })

  test('shows drag handles in edit mode', async ({ page }) => {
    // Enter edit mode
    await page.getByRole('button', { name: /Customize Dashboard/i }).click()

    // Drag handles should be visible (they have class 'drag-handle')
    const dragHandles = page.locator('.drag-handle')
    await expect(dragHandles.first()).toBeVisible()
  })

  test('shows remove buttons in edit mode', async ({ page }) => {
    // Enter edit mode
    await page.getByRole('button', { name: /Customize Dashboard/i }).click()

    // Remove buttons (X icons) should be visible
    const removeButtons = page.locator('button[title="Remove widget"]')
    await expect(removeButtons.first()).toBeVisible()
  })

  test('removes widget when clicking X in edit mode', async ({ page }) => {
    // Enter edit mode
    await page.getByRole('button', { name: /Customize Dashboard/i }).click()

    // Count widgets before removal
    const widgetsBefore = await page.locator('.drag-handle').count()

    // Click first remove button
    await page.locator('button[title="Remove widget"]').first().click()

    // Should have one less widget
    const widgetsAfter = await page.locator('.drag-handle').count()
    expect(widgetsAfter).toBe(widgetsBefore - 1)
  })
})
