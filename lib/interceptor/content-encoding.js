'use strict'

const ContentEncodingHandler = require('../handler/content-encoding-handler')

module.exports = (opts) => (dispatch) => (dispatchOpts, handler) => {
  if (dispatchOpts.method === 'HEAD' || dispatchOpts.method === 'CONNECT') {
    return dispatch(dispatchOpts, handler)
  } else {
    return dispatch(dispatchOpts, new ContentEncodingHandler(handler, opts))
  }
}
