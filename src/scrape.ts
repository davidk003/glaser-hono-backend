import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { Browser, Page } from 'playwright';
import { HTTPException } from 'hono/http-exception'

interface gotoOptions {
  referer?: string;
  timeout?: number;
  waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
}

const gotoOptions: gotoOptions = { timeout: 10000, waitUntil: 'load' }

export async function scrapeName(url: string): Promise<string | null>
{
    chromium.use(StealthPlugin())
    const browser: Browser = await chromium.launch();
    const page: Page = await browser.newPage();

    try {
        let startTime = Date.now();
        await page.goto(url, gotoOptions);
        console.log(`Name goto took: ${Date.now() - startTime}ms`);

        const nameElement = await page.locator('[property="og:title"]').first();
        const actualName = await nameElement.getAttribute('content');

        return actualName;
    } catch (error) {
        await browser.close();
        // console.error('An error occurred:', error);
        return null;
    } finally {
        await browser.close();
    }

}

export async function scrapePostText(url: string): Promise<string[] | null>
{
    chromium.use(StealthPlugin())
    const browser: Browser = await chromium.launch();
    const page: Page = await browser.newPage();

    try {
        let startTime = Date.now();
        await page.goto(url, gotoOptions);
        console.log(`Post text goto took: ${Date.now() - startTime}ms`);
      // Consider data-ad-preview="message" can have more than one element for reposts/reply posts
        const postElement = await page.locator('[data-ad-preview="message"]').first();
        const contentSpan = await postElement.locator('div > div > span').first();
        const textBlockList = await contentSpan.locator('> div').all();
        console.log(textBlockList.length);
        let textContentList:string[] = [];
        for (const textBlock of textBlockList) {
            const text = await textBlock.innerText();
            textContentList.push(text);
        }
        return textContentList;
    } catch (error) {
        await browser.close();
        // console.error('An error occurred:', error);
        return null;
    } finally {
        await browser.close();
    }
}



export async function scrapeDate(url: string): Promise<string | null> {
    chromium.use(StealthPlugin())
    const browser: Browser = await chromium.launch();
    const page: Page = await browser.newPage();
  
    try {
        let startTime = Date.now();
        await page.goto(url, {timeout: 10000, waitUntil: 'domcontentloaded'});
        console.log(`Date goto took: ${Date.now() - startTime}ms`);

        const parentElement = (await page.locator('[aria-labelledby]').all())[1];
    //   const childDiv = await parentElement.locator('span').first();
      
      const spans = await page.evaluate(() => {
        const parentElements = document.querySelectorAll('[aria-labelledby]');
        if (parentElements.length < 2) {
          throw new Error('Not enough elements found');
        }
        const childDiv : HTMLSpanElement | null = parentElements[1].querySelector('span');
        if (!childDiv) {
          throw new Error('Child div not found');
        }
        const spans = childDiv.querySelectorAll('span');
        return Array.from(spans).map(span => {
          return [span.textContent, (span.offsetTop === 0 ? span.offsetLeft : null)];
        });
      });
  
      // console.log(spans);
      
      //Remove all null values because they are fake characters
      const filteredSpans = spans.filter((el) => el[1] !== null);
      //Sort real characters by leftoffset to get true ordering
      filteredSpans.sort((a, b) => (a[1] as number) - (b[1] as number));
      //Add all sorted characters to get same date as displayed
      const date = filteredSpans.map(x => x[0]).join('');
      // console.log(filteredSpans);
  
      return date;
    } catch (error) {
      console.error('An error occurred:', error);
      await browser.close();
      return null;
    } finally {
      await browser.close();
    }
}


export async function scrapeImages(url: string): Promise<(string | null)[]>
{
  //Through img tags, then image tags with alt
  //Consider testing no image, multiple images, repost images
  //Upon observation, alt values are generated by facebook, and
  //More than one image leaves an empty alt value.
  //Reposts have a "No photo description available." alt value
    
    const imgSelector = `div > img[alt]`
    const browser: Browser = await chromium.launch();
    const page: Page = await browser.newPage();
    chromium.use(StealthPlugin())
    let startTime = Date.now();
    await page.goto(url, {timeout: 10000, waitUntil: 'domcontentloaded'});
    console.log(`Image goto took: ${Date.now() - startTime}ms`);

    //Locator will return null/undefined if there is not image
    const imgElements = await page.locator(imgSelector).all();
    // const imgSrc = img.map(async (img) => {return (await img.getAttribute("src"))});
    const srcList: (string | null)[] = [];

    for (const img of imgElements) {
        const src = await img.getAttribute("src");
        srcList.push(src);
    }

    await browser.close();

    return srcList;
}

export async function scrapeLikeCount()
{
  chromium.use(StealthPlugin())
  const browser: Browser = await chromium.launch();
  const page: Page = await browser.newPage();
}

export async function scrapeCommentCount()
{
  chromium.use(StealthPlugin())
  const browser: Browser = await chromium.launch();
  const page: Page = await browser.newPage();
}

export async function scrapeShareCount()
{
  chromium.use(StealthPlugin())
  const browser: Browser = await chromium.launch();
  const page: Page = await browser.newPage();
}

export async function getScript(URL: string): Promise<string[] | null>
{
  chromium.use(StealthPlugin())
  const browser: Browser = await chromium.launch();
  const page: Page = await browser.newPage();
  await page.goto(URL);

  // await Bun.write("output.html", await page.content())
  
  let result: string[] = [];
  // Evaluate the script tags on the page to find the desired key-value pairs
  const reactions = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script'));

    scripts.forEach(async (script) => {
      const text = script.textContent;
      if (text)
      {
        await Bun.write("output.html", text);
      }
      // // Parse JSON strings found within the script tag text
      // const matches = text?.match(/{"i18n_reaction_count":"\d+","i18n_reaction_count_plural":"\d+","reaction_type":"\w+"}/g);
      // if (matches) {
      //   matches.forEach(match => {
      //     try {
      //       const reactionData = JSON.parse(match);
      //       result.push(reactionData);
      //     } catch (e) {
      //       console.error('Error parsing JSON:', e);
      //     }
      //   });
      // }
      if (text!==null) {
        console.log(text);
      }
    });
  });

  await browser.close();
  console.log(result);
  return result;
}
