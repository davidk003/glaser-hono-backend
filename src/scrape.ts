import { chromium, Browser, Page } from 'playwright';
import { HTTPException } from 'hono/http-exception'


export async function scrapeName(url: string): Promise<string | null>
{
    const browser: Browser = await chromium.launch();
    const page: Page = await browser.newPage();

    try {
        await page.goto(url, {timeout: 500});

        const nameElement = await page.locator('[property="og:title"]').first();
        const actualName = await nameElement.getAttribute('content');

        return actualName;
    } catch (error) {
        // console.error('An error occurred:', error);
        return null;
    } finally {
        await browser.close();
    }

}