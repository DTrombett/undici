'use strict'

const util = require('../core/util')
const DecoratorHandler = require('./decorator-handler')
const zlib = require('node:zlib')
const { pipeline } = require('node:stream')

class ContentEncodingHandler extends DecoratorHandler {
  #paused = false

  constructor (handler, { ignoreUnknown = false } = {}) {
    super(handler)
    this.ignoreUnknown = ignoreUnknown
  }

  onHeaders (statusCode, headers, resume, statusText) {
    const decoders = []
    for (let i = 0; i < headers.length; i += 2) {
      if (headers[i].length === 16 && util.headerNameToString(headers[i]) === 'content-encoding') {
        const codings = headers[i + 1].toString('latin1').toLowerCase().split(/\s*,\s*/)
        for (let i = codings.length - 1; i >= 0; i--) {
          const coding = codings[i]
          if (coding === 'gzip' || coding === 'x-gzip') {
            decoders.push(zlib.createGunzip({
              flush: zlib.constants.Z_SYNC_FLUSH,
              finishFlush: zlib.constants.Z_SYNC_FLUSH
            }))
          } else if (coding === 'deflate') {
            decoders.push(zlib.createInflate({
              flush: zlib.constants.Z_SYNC_FLUSH,
              finishFlush: zlib.constants.Z_SYNC_FLUSH
            }))
          } else if (coding === 'br') {
            decoders.push(zlib.createBrotliDecompress({
              flush: zlib.constants.BROTLI_OPERATION_FLUSH,
              finishFlush: zlib.constants.BROTLI_OPERATION_FLUSH
            }))
          } else if (!this.ignoreUnknown) throw new Error(`Invalid coding: ${coding}`)
        }
        break
      }
    }
    if (decoders.length) {
      this.decoder = decoders.shift()
      this.decoder.on('drain', () => {
        if (!this.#paused) {
          resume()
        }
      })
      const destination = decoders.length
        ? pipeline(this.decoder, ...decoders, (err) => {
          if (err) {
            this.onError(err)
          }
        })
        : this.decoder
      destination
        .on('error', this.onError.bind(this))
        .on('data', (chunk) => {
          this.#paused = (super.onData(chunk) === false)
        })
        .on('end', () => {
          super.onComplete(this.trailers)
        })
    }
    return super.onHeaders(statusCode, headers, () => {
      resume()
      this.#paused = false
    }, statusText)
  }

  onData (chunk) {
    return this.decoder ? (this.decoder.write(chunk) && !this.#paused) : super.onData(chunk)
  }

  onComplete (trailers) {
    if (this.decoder) {
      this.decoder.end()
      this.trailers = trailers
    } else {
      super.onComplete(trailers)
    }
  }
}

module.exports = ContentEncodingHandler
