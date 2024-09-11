import { Hono } from 'hono'
import { decode, jwt, sign, verify } from 'hono/jwt'
import { cors } from 'hono/cors'
import { createClient } from '@supabase/supabase-js'
import type { JwtVariables } from 'hono/jwt'
import {streamSSE } from 'hono/streaming'
import { logger } from 'hono/logger'
import { HTTPException } from 'hono/http-exception'
import { Queue, Worker } from 'bullmq'
import { scrapeName, scrapeDate, scrapeImages } from './scrape'

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
app.get('/scrape/:url', async (c) => {
  let URL: string | undefined = c.req.param('url')
  if(!URL)
  {
    throw new HTTPException(400, { message: 'Bad URL parameter.' })
  }
  let parsedID : string | null = "parsedID"
  return c.text('Scraping ' + URL)
})

app.get('/', async (c) =>
   {
  const TESTURL = "https://www.facebook.com/NintendoAmerica/posts/pfbid02XR9TzVnLaaREeDewGsfzQEB4UZYa354zobqx6rNyYqiP2Gvaquc6HTWYrw3sDR5fl"
  
  const promises =  
  {
    name: scrapeName(TESTURL), 
    date: scrapeDate(TESTURL),
    images: scrapeImages(TESTURL)
  };
  let resultMap = new Map<string, (string | null | (string| null)[])>()
  
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

  }
  catch (error)
  {
    console.error('An error occurred:', error);
    throw new HTTPException(500, { message: 'Scraping failed' })
  }
  return c.text(JSON.stringify(Object.fromEntries(resultMap)))
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
export default { 
  port: 3000, 
  fetch: app.fetch, 
} 
