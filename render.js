#!/usr/bin/env node
'use strict'

const argv = require('yargs')
  .usage('Usage: \n$0 <input.bms> <output.wav>\n$0 [-s] [start_time] [-l] [length] <input.bms> <output.wav>')

  .option('start', { alias: 's', type: "number" })
  .default('start', 0)
  .describe('start', 'Start time to render in seconds. Omit to render from the beginning.')

  .option('length', { alias: 'l', type: "number" })
  .default('length', 0)
  .describe('length', 'Length to render in seconds. Omit to render to the end.')

  .boolean('info')
  .describe('info', 'Only prints the song info.')

  .demand(2, 2)
  .version()
  .argv

require('babel-polyfill')

const childProcess = require('child_process')
const getNotes = require('./getNotes')
const _ = require('lodash')
const satisfies = require('semver').satisfies
const Promise = require('bluebird')

const renderers = {
  ffi (song, outfilepath) {
    const snd = require('./snd')
    const samples = { }

    function frameForTime (seconds) {
      return Math.floor(seconds * 44100)
    }

    process.stderr.write('Loading samples...\n')
    song.keysounds.forEach(function (samplepath) {
      var sound = samples[samplepath] = snd.read(samplepath)
      if (sound.samplerate !== 44100) {
        throw new Error(samplepath + ' must be 44100 hz')
      }
      if (sound.channels !== 2) {
        throw new Error(samplepath + ' must be 2 channels')
      }
      process.stderr.write('.')
    })
    process.stderr.write('\n')

    var validNotes = _(song.data).map(function (note) {
      return _.assign({ sound: samples[note.src] }, note)
    }).filter('sound').value()
    process.stderr.write('Number of valid notes: ' + validNotes.length + '\n')

    const shiftStartFrame = frameForTime(argv.start);
    const lengthFrame = frameForTime(argv.length);

    var endSongFrame = _(validNotes).map(function (note) {
      var length = note.sound.frames
      return frameForTime(note.time) + length
    }).max()

    var skip = _(validNotes).map(function (note) {
      return frameForTime(note.time)
    }).min()

    const startFrame = Math.min(skip + shiftStartFrame, endSongFrame);
    const endFrame = argv.length == 0 ? endSongFrame : Math.min(startFrame + lengthFrame, endSongFrame);

    const frames = endFrame - startFrame;
    
    process.stderr.write('Total song length: ' + (frames / 44100) + '\n')

    process.stderr.write('Writing notes...' + '\n')
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
      const soundBufferBeginReading = Math.max(0, startFrame - skip - start) * 2 * 4
      const length = Math.min(soundBuffer.length - soundBufferBeginReading, framesToCopy * 2 * 4)

      for (var i = soundBufferBeginReading; i < (soundBufferBeginReading + length); i += 4) {
        const position = (offset + i) - ((shiftStartFrame) * 2 * 4)

        if (position > buffer.length - 4) {
          break;
        }

        const floatFile = buffer.readFloatLE(position)
        const floatSound = soundBuffer.readFloatLE(i)
        buffer.writeFloatLE(floatFile + floatSound, position)
      }
      process.stderr.write('.')
    })
    process.stderr.write('\n')
    process.stderr.write('Writing output!\n')
    snd.write(outfilepath, { samplerate: 44100, channels: 2, frames: frames, buffer: buffer })
  },
  bmsampler (song, outfilepath) {
    const stdin = [ ]
    const writeKeysoundFactory = _.memoize(
      note => _.once(() => stdin.push(JSON.stringify({
        type: 'sample',
        key: note.keysound,
        path: note.src
      }))),
      note => note.keysound
    )
    const writeNote = note => stdin.push(JSON.stringify({
      type: 'play',
      key: note.keysound,
      time: note.time
    }))
    const notes = song.data.filter(note => note.src)
    notes.map(writeKeysoundFactory).forEach(thunk => thunk())
    notes.forEach(writeNote)
    stdin.push(JSON.stringify({ type: 'go' }))
    childProcess.execFileSync('bmsampler', [ outfilepath ], {
      input: stdin.join('\n'),
      stdio: [ 'pipe', 'pipe', process.stderr ]
    })
  }
}

function canUseBmsampler () {
  const BMSAMPLER_VERSION = '^0.2.0'
  try {
    const output = childProcess.execFileSync('bmsampler', [ '-v' ], { input: '', encoding: 'utf8' }).trim()
    if (satisfies(output, BMSAMPLER_VERSION)) {
      return true
    } else {
      console.error('bmsampler version ' + output + ' is incompatible with bms-renderer. Required version range: ' + BMSAMPLER_VERSION)
      return false
    }
  } catch (e) {
    return false
  }
}

{
  const filepath = argv._[0]
  const outfilepath = argv._[1]
  const partialRendering = (argv.start != 0 || argv.length != 0)
  Promise.coroutine(function* () {
    const song = yield getNotes(filepath)
    console.log(JSON.stringify(song.info, null, 2))
    if (!argv.info) {
      const render = (canUseBmsampler() && !partialRendering) ? renderers.bmsampler : renderers.ffi
      render(song, outfilepath)
    }
  })().done()
}
