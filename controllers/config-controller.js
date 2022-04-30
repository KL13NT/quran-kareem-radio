const { client } = require("./mongo-controller");

const db = client.db();
const collection = db.collection("config");

const updateConfig = (guildId, change) =>
  collection.updateOne({ guildId }, { $set: change }, { upsert: true });

const getConfig = (guildId) => {
  const projection = {
    _id: 0,
  };
  return collection.findOne({ guildId }, { projection });
};

module.exports = {
  updateConfig,
  getConfig,
};
