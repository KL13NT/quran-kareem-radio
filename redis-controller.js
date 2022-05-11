const { promisify } = require("util");

class RedisController {
  /** @type {import('redis').RedisClientType} */
  client = null;

  /**
   *
   * @param {import('redis').RedisClientType} client
   */
  constructor(client) {
    this.client = client;

    this.get = promisify(this.client.get).bind(this.client);
    this.keys = this.client.keys.bind(this.client);
    this.set = promisify(this.client.set).bind(this.client);
    this.del = promisify(this.client.del).bind(this.client);
  }

  init = async () => {
    this.redis.on("ready", this.readyListener);
    this.redis.on("error", this.errorListener);
  };

  destroy = () => {
    this.redis.removeAllListeners();
    this.redis.end(false);
  };

  errorListener = (err) => {
    console.error(err);

    this.redis.removeAllListeners();
    this.ready = false;
  };

  readyListener = () => {
    console.log("Redis ready");
    this.client.emit("queueExecute", "Redis controller ready");

    this.ready = true;

    this.redis.removeListener("ready", this.readyListener);
  };
}

module.exports = {
  RedisController,
};
