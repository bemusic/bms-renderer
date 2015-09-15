
var ref = require('ref')
var ffi = require('ffi')
var fs  = require('fs')
var Struct = require('ref-struct')

var SFM_READ = 0x10
var SFM_WRITE = 0x20
var SF_FORMAT_WAV = 0x010000
var SF_FORMAT_FLOAT = 0x0006

var SNDFILE = ref.types.void
var SNDFILEPtr = ref.refType(SNDFILE)
var SF_INFO = Struct({
  frames: 'long',
  samplerate: 'int32',
  channels: 'int32',
  format: 'int32',
  sections: 'int32',
  seekable: 'int32',
})
var SF_INFOPtr = ref.refType(SF_INFO)
var floatPtr = ref.refType(ref.types.float)

var libsndfile = ffi.Library('libsndfile', {
  'sf_open': [ SNDFILEPtr, [ 'string', 'int', SF_INFOPtr ] ],
  'sf_close': [ 'int', [ SNDFILEPtr ] ],
  'sf_readf_float': [ 'long', [ SNDFILEPtr, floatPtr, 'long' ] ],
  'sf_writef_float': [ 'long', [ SNDFILEPtr, floatPtr, 'long' ] ],
})

exports.read = function (path) {

  var info = new SF_INFO
  info.format = 0
  var ptr = libsndfile.sf_open(path, SFM_READ, info.ref())
  if (ptr.isNull()) throw new Error('Cannot load ' + path)

  var sound = { }
  sound.frames = info.frames
  sound.samplerate = info.samplerate
  sound.channels = info.channels

  var size = 4 * sound.frames * sound.channels
  var buffer = new Buffer(size)
  libsndfile.sf_readf_float(ptr, buffer, sound.frames)
  sound.buffer = buffer
  libsndfile.sf_close(ptr)

  return sound
}

exports.write = function (path, sound) {

  var info = new SF_INFO
  info.format = SF_FORMAT_WAV | SF_FORMAT_FLOAT
  info.samplerate = sound.samplerate
  info.channels = sound.channels

  var ptr = libsndfile.sf_open(path, SFM_WRITE, info.ref())
  if (ptr.isNull()) throw new Error('Cannot write ' + path)

  var size = 4 * sound.frames * sound.channels
  libsndfile.sf_writef_float(ptr, sound.buffer, sound.frames)
  libsndfile.sf_close(ptr)
}
