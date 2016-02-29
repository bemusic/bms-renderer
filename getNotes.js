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

  return {
    path: filepath,
    info: info,
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
    wav = path.resolve(filepath, '..', wav)
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
