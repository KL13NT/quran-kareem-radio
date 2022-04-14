const { createAudioResource } = require("@discordjs/voice");

const { STREAM } = process.env;

const createAudioPlayerSource = () =>
  createAudioResource(STREAM, {
    silencePaddingFrames: 0,
  });

module.exports = { createAudioPlayerSource };
