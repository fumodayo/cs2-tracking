import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("Missing MONGODB_URI. Copy .env.example to .env.local and set MongoDB connection.");
}

const mongoUri = uri;

const options = {
  serverSelectionTimeoutMS: 5000,
};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

type GlobalWithMongo = typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

const globalWithMongo = globalThis as GlobalWithMongo;

function createClientPromise(): Promise<MongoClient> {
  client = new MongoClient(mongoUri, options);
  return client.connect();
}

function getClientPromise(): Promise<MongoClient> {
  if (process.env.NODE_ENV === "development") {
    if (!globalWithMongo._mongoClientPromise) {
      globalWithMongo._mongoClientPromise = createClientPromise();
    }

    return globalWithMongo._mongoClientPromise;
  }

  if (!clientPromise) {
    clientPromise = createClientPromise();
  }

  return clientPromise;
}

export async function getDatabase() {
  try {
    const mongoClient = await getClientPromise();
    return mongoClient.db(process.env.MONGODB_DB ?? "cs2_case_tracker");
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      globalWithMongo._mongoClientPromise = undefined;
    }

    throw normalizeMongoConnectionError(error);
  }
}

function normalizeMongoConnectionError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("tlsv1 alert internal error") || message.includes("SSL alert number 80")) {
    return new Error(
      "MongoDB Atlas đã từ chối TLS handshake. Hãy vào Atlas Network Access và whitelist IP public hiện tại của máy, hoặc tạm thêm 0.0.0.0/0 khi phát triển local.",
    );
  }

  return error instanceof Error ? error : new Error(message);
}
