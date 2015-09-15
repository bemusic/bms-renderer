
var fs = require('fs')
var bms = require('bms')
var path = require('path')
var _ = require('lodash')


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


function getNotes (filepath) {

  var buffer = fs.readFileSync(filepath)
  var src = bms.Reader.read(buffer)
  var result = bms.Compiler.compile(src)
  var chart = result.chart
  var timing = bms.Timing.fromBMSChart(chart)
  var notes = bms.Notes.fromBMSChart(chart)
  var info = bms.SongInfo.fromBMSChart(chart)
  var keys = { }
  var times = (_(notes.all())
    .map(function(note) {
      return {
        time: timing.beatToSeconds(note.beat),
        src: lookup(note.keysound),
        keysound: note.keysound,
      }
    })
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
    var wav = chart.headers.get('wav' + k)
    if (!wav) return null
    wav = path.resolve(filepath, '..', wav)
    if (fs.existsSync(wav)) return wav
    wav = wav.replace(/\.\w\w\w$/, '.ogg')
    if (fs.existsSync(wav)) return wav
    wav = wav.replace(/\.\w\w\w$/, '.mp3')
    if (fs.existsSync(wav)) return wav
    return null
  }
}

module.exports = getNotes
