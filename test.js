
var snd = require('./snd')
var expect = require('chai').expect

describe('snd.read', function () {

  var data

  before(function () {
    data = snd.read('fixtures/exargonbass.wav')
  })

  it('has frames', function () {
    expect(data.frames).to.equal(15585)
  })
  it('has sample rate', function () {
    expect(data.samplerate).to.equal(44100)
  })
  it('has channels', function () {
    expect(data.channels).to.equal(2)
  })
  it('has data', function () {
    expect(data.buffer).to.be.an.instanceof(Buffer)
    expect(data.buffer).to.have.length(15585 * 2 * 4)
  })
  after(function () {
    snd.write('/tmp/test.wav', data)
  })
})
