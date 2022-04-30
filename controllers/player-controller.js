const { EventEmitter } = require("events");
const { AudioPlayer } = require("@discordjs/voice");
const { createAudioPlayerSource } = require("../utils");

const { MODE } = process.env;

class PlayerManager extends EventEmitter {
  resource = null;

  player = null;

  init = () => {
    this.resource = createAudioPlayerSource();
    this.player = new AudioPlayer({
      debug: MODE === "DEVELOPMENT",
      behaviors: {
        noSubscriber: "play",
      },
    });

    this.player.on("error", (error) => {
      console.error(error);
    });

    this.player.on("stateChange", (change) => {
      console.log(change);
    });

    this.player.on("debug", (log) => {
      console.log(log);
    });

    this.player.play(this.resource);
  };

  handleStreamErrors = (message) => (reason /* string | Error | void */) => {
    console.log(message, reason);

    this.resource.playStream.removeAllListeners();
    this.resource.playStream.destroy();

    console.log("Creating another audio source");

    this.resource = createAudioPlayerSource();
    const interval = setInterval(() => {
      if (this.resource.started && this.resource.readable) {
        console.log("New source stream is readable");

        this.player.play(this.resource);
        this.attachListeners();
        clearInterval(interval);
      } else {
        console.log("New source stream is NOT readable");

        this.resource = createAudioPlayerSource();
      }
    }, 5000);
  };

  attachListeners = () => {
    this.resource.playStream.on(
      "error",
      this.handleStreamErrors("Stream error")
    );

    this.resource.playStream.on(
      "close",
      this.handleStreamErrors("Stream closed")
    );

    this.resource.playStream.on("end", this.handleStreamErrors("Stream ended"));

    this.resource.playStream.on(
      "pause",
      this.handleStreamErrors("Stream paused")
    );
  };

  subscribe = (connection) => {
    connection.subscribe(this.player);
  };
}

module.exports = {
  PlayerManager,
};
