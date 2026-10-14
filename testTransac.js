import dns from "node:dns";
import mongoose from "mongoose";
import "dotenv/config";

dns.setServers(["8.8.8.8", "1.1.1.1"]);
const testSchema = new mongoose.Schema({
  name: String,
});

const TestModel =
  mongoose.models.TransactionTest ||
  mongoose.model("TransactionTest", testSchema);

try {
  await mongoose.connect(process.env.MONGO_URI);

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      await TestModel.create([{ name: "transaction-test" }], {
        session,
      });
    });

    console.log("SUCCESS: Transaction committed.");

    await TestModel.deleteOne({ name: "transaction-test" });
  } finally {
    await session.endSession();
  }
} catch (error) {
  console.error("TRANSACTION TEST FAILED:", error);
} finally {
  await mongoose.disconnect();
}