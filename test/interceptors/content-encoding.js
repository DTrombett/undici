'use strict'

const { test, describe } = require('node:test')
const { createServer } = require('node:http')
const { once } = require('node:events')
const { Client, interceptors } = require('../..')
const { createGzip, createDeflate, createBrotliCompress } = require('node:zlib')
const { strictEqual, rejects } = require('node:assert')

describe('Content Encoding Interceptor', () => {
  test('ignores responses without content-encoding header', async (t) => {
    const text = 'hello world'

    const server = createServer((req, res) => {
      res.setHeader('Content-Type', 'text/plain')
      res.end(text)
    }).listen(0)

    const client = new Client(`http://localhost:${server.address().port}`)
      .compose(interceptors.contentEncoding())
    t.after(async () => {
      server.close()
      await client.close()
    })
    await once(server, 'listening')

    const response = await client.request({ method: 'GET', path: '/' })
    strictEqual(await response.body.text(), 'hello world')
  })

  test('correctly decodes gzip', async (t) => {
    const text = 'Hello, World!'

    const server = createServer((req, res) => {
      const gzip = createGzip()

      res.setHeader('Content-Encoding', 'gzip')
      res.setHeader('Content-Type', 'text/plain')

      gzip.pipe(res)
      gzip.write(text)
      gzip.end()
    }).listen(0)

    const client = new Client(`http://localhost:${server.address().port}`)
      .compose(interceptors.contentEncoding())
    t.after(async () => {
      server.close()
      await client.close()
    })
    await once(server, 'listening')

    const response = await client.request({ method: 'GET', path: '/' })
    strictEqual(await response.body.text(), text)
  })

  test('correctly decodes brotli', async (t) => {
    const text = 'Hello, World!'

    const server = createServer((req, res) => {
      const brotli = createBrotliCompress()

      res.setHeader('Content-Encoding', 'br')
      res.setHeader('Content-Type', 'text/plain')

      brotli.pipe(res)
      brotli.write(text)
      brotli.end()
    }).listen(0)

    const client = new Client(`http://localhost:${server.address().port}`)
      .compose(interceptors.contentEncoding())
    t.after(async () => {
      server.close()
      await client.close()
    })
    await once(server, 'listening')

    const response = await client.request({ method: 'GET', path: '/' })
    strictEqual(await response.body.text(), text)
  })

  test('handles empty body', async (t) => {
    const server = createServer((req, res) => {
      res.setHeader('Content-Encoding', 'br')
      res.setHeader('Content-Type', 'text/plain')
      res.end()
    }).listen(0)

    const client = new Client(`http://localhost:${server.address().port}`)
      .compose(interceptors.contentEncoding())
    t.after(async () => {
      server.close()
      await client.close()
    })
    await once(server, 'listening')

    const response = await client.request({ method: 'GET', path: '/' })
    strictEqual(await response.body.text(), '')
  })

  test('wrong compression method', async (t) => {
    const text = 'Hello, World!'

    const server = createServer((req, res) => {
      const brotli = createBrotliCompress()

      res.setHeader('Content-Encoding', 'gzip')
      res.setHeader('Content-Type', 'text/plain')

      brotli.pipe(res)
      brotli.write(text)
      brotli.end()
    }).listen(0)

    const client = new Client(`http://localhost:${server.address().port}`)
      .compose(interceptors.contentEncoding())
    t.after(async () => {
      server.close()
      await client.close()
    })
    await once(server, 'listening')

    const response = await client.request({ method: 'GET', path: '/' })
    await rejects(response.body.text(), { name: 'Error', message: 'incorrect header check' })
  })

  test('unknown compression method', async (t) => {
    const text = 'Hello, World!'

    const server = createServer((req, res) => {
      res.setHeader('Content-Encoding', 'aaa')
      res.setHeader('Content-Type', 'text/plain')
      res.end(text)
    }).listen(0)

    const client = new Client(`http://localhost:${server.address().port}`)
      .compose(interceptors.contentEncoding())
    t.after(async () => {
      server.close()
      await client.close()
    })
    await once(server, 'listening')

    await rejects(client.request({ method: 'GET', path: '/' }), { name: 'Error', message: 'Invalid coding: aaa' })
  })

  test('unknown compression method with ignore option', async (t) => {
    const text = 'Hello, World!'

    const server = createServer((req, res) => {
      res.setHeader('Content-Encoding', 'aaa')
      res.setHeader('Content-Type', 'text/plain')
      res.end(text)
    }).listen(0)

    const client = new Client(`http://localhost:${server.address().port}`)
      .compose(interceptors.contentEncoding({ ignoreUnknown: true }))
    t.after(async () => {
      server.close()
      await client.close()
    })
    await once(server, 'listening')

    const response = await client.request({ method: 'GET', path: '/' })
    strictEqual(await response.body.text(), text)
  })

  test('response decompression according to content-encoding should be handled in a correct order', async (t) => {
    const contentCodings = 'deflate, gzip'
    const text = 'Hello, World!'

    const server = createServer((req, res) => {
      const gzip = createGzip()
      const deflate = createDeflate()

      res.setHeader('Content-Encoding', contentCodings)
      res.setHeader('Content-Type', 'text/plain')

      deflate.pipe(gzip).pipe(res)

      deflate.write(text)
      deflate.end()
    }).listen(0)

    const client = new Client(`http://localhost:${server.address().port}`)
      .compose(interceptors.contentEncoding())
    t.after(async () => {
      server.close()
      await client.close()
    })
    await once(server, 'listening')

    const response = await client.request({ method: 'GET', path: '/' })
    strictEqual(await response.body.text(), text)
  })
})
