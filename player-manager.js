const { EventEmitter } = require("events");
const { AudioPlayer } = require("@discordjs/voice");
const { createAudioPlayerSource, retryUntilSuccess } = require("./utils");

const { MODE } = process.env;

class PlayerManager extends EventEmitter {
  /** @type {import('@discordjs/voice').AudioResource} */
  resource = null;

  /** @type {AudioPlayer} */
  player = null;

  createResource() {}

  init = () => {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        this.resource = createAudioPlayerSource();
        break;
      } catch (error) {
        console.log(`error: while trying to init resource ${error.message}`);
      }
    }

    this.attachListeners();
    this.player = new AudioPlayer({
      debug: MODE === "DEVELOPMENT",
      behaviors: {
        noSubscriber: "play",
      },
    });

    this.player.on("error", (error) => {
      console.error(`error: ${error.message}`);
    });

    this.player.on("stateChange", (change) => {
      console.log(`Player status changed to ${change.status}`);
    });

    this.player.play(this.resource);
  };

  handleStreamErrors = (message) => (reason /* string | Error | void */) => {
    console.log(message, reason);

    this.resource.playStream.removeAllListeners();
    this.resource.playStream.destroy();

    console.log("Creating another audio source");

    const interval = setInterval(() => {
      try {
        this.resource = createAudioPlayerSource();

        if (this.resource.started && this.resource.readable) {
          console.log("New source stream is readable");

          this.player.play(this.resource);
          this.attachListeners();
          clearInterval(interval);
        } else {
          console.log("New source stream is NOT readable");

          this.resource = createAudioPlayerSource();
        }
      } catch (error) {
        console.log(`error: stream error when retrying ${error.message} `);
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
