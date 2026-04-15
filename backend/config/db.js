import mongoose from "mongoose";

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI not set");
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, { dbName: "ecoride" });
  console.log("MongoDB connected");
};

export default connectDB;
