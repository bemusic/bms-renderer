#!/usr/bin/env node
var argv = require('minimist')(process.argv.slice(2))
if (argv._.length !== 2) {
  console.error('Usage: bms-renderer <in.bms> <out.wav>')
  console.error('')
  throw new Error('Invald command arguments')
}

var filepath = argv._[0]
var outfilepath = argv._[1]

var getNotes = require('./getNotes')
var snd = require('./snd')
var _ = require('lodash')

var song = getNotes(filepath)

var samples = { }

function frameForTime (seconds) {
  return Math.floor(seconds * 44100)
}

console.log('Loading samples...')
song.keysounds.forEach(function (samplepath) {
  var sound = samples[samplepath] = snd.read(samplepath)
  if (sound.samplerate !== 44100) {
    throw new Error(samplepath + ' must be 44100 hz')
  }
  if (sound.channels !== 2) {
    throw new Error(samplepath + ' must be 2 channels')
  }
  process.stdout.write('.')
})
process.stdout.write('\n')

var validNotes = _(song.data).map(function (note) {
  return _.assign({ sound: samples[note.src] }, note)
}).filter('sound').value()
console.log('Number of valid notes: ' + validNotes.length)

var last = _(validNotes).map(function (note) {
  var length = note.sound.frames
  return frameForTime(note.time) + length
}).max()

var skip = _(validNotes).map(function (note) {
  return frameForTime(note.time)
}).min()

var frames = last - skip
console.log('Total song length: ' + (frames / 44100))

console.log('Writing notes...')
var buffer = new Buffer(frames * 2 * 4)
_.each(validNotes, function (note) {
  var sound   = note.sound
  var start   = frameForTime(note.time) - skip
  var cut     = note.cutTime && (frameForTime(note.cutTime) - skip)
  var offset  = start * 2 * 4

  var framesToCopy = sound.frames
  if (cut > 0) {
    framesToCopy = Math.min(framesToCopy, cut - start)
  }

  var soundBuffer = sound.buffer
  var length = Math.min(soundBuffer.length, framesToCopy * 2 * 4)
  for (var i = 0; i < length; i += 4) {
    var position = offset + i
    buffer.writeFloatLE(buffer.readFloatLE(position) + soundBuffer.readFloatLE(i), position)
  }
  process.stdout.write('.')
})
process.stdout.write('\n')

console.log('Writing output!')
snd.write(outfilepath, { samplerate: 44100, channels: 2, frames: frames, buffer: buffer })
