import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { decode, jwt, sign, verify } from 'hono/jwt'
import { cors } from 'hono/cors'
import { createClient } from '@supabase/supabase-js'
import type { JwtVariables } from 'hono/jwt'
import {streamSSE } from 'hono/streaming'
import { logger } from 'hono/logger'
import { HTTPException } from 'hono/http-exception'
import { Queue, Worker } from 'bullmq'
import { detect, detectAll, supportedLanguages, langName, toISO3 } from 'tinyld/heavy'
// import {langName} from 'tinyld'
import { scrapeName, scrapeDate, scrapeImages, getScript, scrapePostText, scrapeReactions, scrapeTimeStamp, scrapePostAllAtOnce, scrapeComments, topLangs} from './scrape'
require('dotenv').config()

// Create a single supabase client for interacting with your database
const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.PUBLIC_SUPABASE_ANON_KEY;
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !JWT_SECRET) {
  throw new Error('Missing env key')
}
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
type Variables = JwtVariables

const app = new Hono<{ Variables: Variables }>()
interface Job {
  id: string
  status: 'pending' | 'processing' | 'done'
  progress: number
}

interface Reactions
{
  likes: number;
  shares: number;
  comments: number;
}


// Allow all origins
app.use('/*', cors())
app.use(logger())
// Authenticate with a bearer token
app.use(
  '/*',
  jwt({
    secret: JWT_SECRET,
  })
)
// Setup SSE headers
// app.use('/sse', async (c, next) => {
//   c.header('Content-Type', 'text/event-stream');
//   c.header('Cache-Control', 'no-cache');
//   c.header('Connection', 'keep-alive');
//   await next();
// });

// Flow for scraping:
// 1. User sends a input to scrape
// 2. Server verifies if the input is a URL, postID or user.
// 3. Scrape data accordingly
// 4. Record API transaction and stats in table
// 5. Return scraped data to user
app.get('/scrape', async (c) => {
  // let URL: string | undefined = c.req.param('url')
  const URL = "https://www.facebook.com/Cristiano/posts/pfbid02VYqDSSi3TSgcVJZAHkkx2ZoDEP6US3dsQeh35HHtwiYmnLj9iWBcUNu6s3XP9MQpl";
  if(!URL)
  {
    throw new HTTPException(400, { message: 'Bad URL parameter.' })
  }
  // console.log(URL)
  // await getScript(URL);
  console.log("test")
  let res = await scrapeReactions(URL);
  console.log("test")
  return c.text(JSON.stringify(res) ? JSON.stringify(res) : "No text found");
  // let ret = await scrapePostText(URL);
  // return c.text(ret?.toString() ? ret.toString() : "No text found");
})

app.get('/', async (c) =>
   {
  // const TESTURL = "https://www.facebook.com/NintendoAmerica/posts/pfbid02XR9TzVnLaaREeDewGsfzQEB4UZYa354zobqx6rNyYqiP2Gvaquc6HTWYrw3sDR5fl"
  let TESTURL = "https://www.facebook.com/permalink.php?story_fbid=pfbid0gkrT6tMBuAgSLyAQ9p7ugtKUBCoiH7Qq5QixbDvujLn3Rh24MCvd1cFJ8mfq3DeGl&id=100086144741635"
  let scriptText = getScript(TESTURL);
  const promises =  
  {
    name: scrapeName(TESTURL), 
    // date: scrapeDate(TESTURL),
    images: scrapeImages(TESTURL),
    postText: scrapePostText(TESTURL),
  };
  let resultMap = new Map<string, (string | null | (string| null)[] | number | Reactions)>()
  
  try
  {
    await Promise.allSettled(Object.values(promises))  
    .then(results => {
      Object.keys(promises).forEach((key, index) => {
        if (results[index].status === 'fulfilled')
        {
          resultMap.set(key, results[index].value)
        } 
        else
        {
          resultMap.set(key, null)
        }
      });

      let noRejections: boolean = results.every((res) => res.status == 'fulfilled')
      if(!noRejections)
      {
        throw new HTTPException(500, { message: 'Scraping failed' })
      }
    })
    let sc = await scriptText;
    let reactions = await scrapeReactions(TESTURL);
    let timestamp = null;
    if (sc && sc.length >= 1) {
      // sc = JSON.stringify(sc);
      // reactions = await scrapeReactions(sc[0]);
      timestamp = await scrapeTimeStamp(sc[0]);
    } else {
      throw new HTTPException(500, { message: `Invalid scriptText for scraping reaction sc type is: ${typeof sc} sc length is: ${sc?.length}` });
    }
    if (reactions) {
      resultMap.set('reactions', reactions);
    }
    if (timestamp) {
      resultMap.set('timestamp', timestamp);
    }
    resultMap.delete('scriptText');
  }
  catch (error)
  {
    console.error('An error occurred:', error);
    throw new HTTPException(500, { message: 'Scraping failed' })
  }
  return c.json(Object.fromEntries(resultMap));
})

// Flow for scraping status SSE:
// 1. User queries some job id
// 2. Server queries the job id from a Queue or similar internal data structure
// If it exists in queue, return job not started
// 3. Otherwise it is being processsed, so update the job progress every X ms.
// 4. Close the connection when job is done or on timeout.
app.get('/sse', async (c) => {
  let id = 0;
  return streamSSE(c, async (stream) => {
    let ended = false;
    while (true) {
      stream.onAbort(() => {
        if (!ended) {
          ended = true
          console.log('Stream aborted')
        }
      })
      const message = `It is ${new Date().toISOString()}`
      await stream.writeSSE({
        data: String(id++)
      })
      await stream.sleep(100)
    }
  })
})

//Regex and langdetecton times are <5ms 99% of time spent on await browser
app.get('/getPost', async (c) => {
  console.time('getPost');
  let URL: string | undefined = c.req.header('post-URL');
  //URL VALIDATOR HERE
  if (!URL) {
    throw new HTTPException(400, { message: 'Bad URL parameter.' })
  }

  let res = await scrapePostAllAtOnce(URL);

  let totalText: string[] | null = Array.isArray(res.postText) ? res.postText : null;
  res.langs = totalText ? topLangs(totalText.join(' '), 3) : [];
  console.timeEnd('getPost');
  return c.json(res);
});


app.get('/comments', async (c) => {
  const s = await (Bun.file("output.html").text());
  return c.json(scrapeComments(s, 100));
});


export default { 
  port: 3000, 
  fetch: app.fetch, 
} 
