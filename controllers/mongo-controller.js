const { MongoClient } = require("mongodb");

const { DB_URI: uri } = process.env;
const client = new MongoClient(uri);

const connect = async () => {
  await client.connect();
  console.log("connected to the database server");
};

module.exports = {
  connect,
  client,
};
