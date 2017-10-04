'use strict'

const fs = require('fs')
const NotechartLoader = require('bemuse-notechart/loader').NotechartLoader
const path = require('path')
const _ = require('lodash')
const Promise = require('bluebird')

function cut (sortedTimes) {
  var last = { }
  sortedTimes = _.cloneDeep(sortedTimes)

  sortedTimes.forEach(function (note) {
    try {
      if (last[note.keysound]) {
        last[note.keysound].cutTime = note.time
      }
    } finally {
      last[note.keysound] = note
    }
  })

  return _.reject(sortedTimes, function (note) {
    return note.cutTime === note.time
  })
}


function getHash (times) {

  const out = { }
  for (const note of times) {
    if (note.src) {
      const frame = Math.round(note.time * 60)
      out[note.src + ':' + frame] = true
    }
  }
  const data = _.sortBy(Object.keys(out)).join('\n')
  fs.writeFileSync('/tmp/d' + Date.now() + '.nfo', data)
  return require('crypto').createHash('md5').update(data).digest('hex')
}


const getNotes = Promise.coroutine(function* (filepath) {

  const buffer = fs.readFileSync(filepath)
  const loader = new NotechartLoader()
  const notechart = yield loader.load(buffer, { name: filepath }, { })
  const notes = notechart.notes.concat(notechart.autos)
  const info = notechart.songInfo

  const keys = { }
  const times = (_(notes)
    .filter(note => !note.keysoundStart)
    .map(note => ({
      time: note.time,
      src: lookup(note.keysound),
      keysound: note.keysound,
    }))
    .sortBy('time')
    .thru(cut)
    .value()
  )
  const xinfo = {
    sequenceHash: getHash(times)
  }

  return {
    path: filepath,
    info: Object.assign(xinfo, info),
    data: times,
    keysounds: _(keys).values().map('result').compact().value()
  }

  function lookup(k) {
    var result = keys[k] || (keys[k] = { result: find(k) })
    return result.result
  }

  function find(k) {
    var wav = notechart.keysounds[k.toLowerCase()]
    if (!wav) return null
    wav = path.normalize(path.resolve(filepath, '..', wav)).replace(/[\/\\¥]/g, path.sep)
    if (fs.existsSync(wav)) return wav
    wav = wav.replace(/\.\w\w\w$/, '.wav')
    if (fs.existsSync(wav)) return wav
    wav = wav.replace(/\.\w\w\w$/, '.ogg')
    if (fs.existsSync(wav)) return wav
    wav = wav.replace(/\.\w\w\w$/, '.mp3')
    if (fs.existsSync(wav)) return wav
    return null
  }
})

module.exports = getNotes
