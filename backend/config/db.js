// This project runs in a "no external DB required" mode by default.
// A production-grade MongoDB integration can be re-added later if needed.
const connectDB = async () => {
  console.log("DB mode: in-process memory store");
};

export default connectDB;
