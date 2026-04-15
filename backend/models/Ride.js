import mongoose from "mongoose";

const pointSchema = new mongoose.Schema({
  type: { type: String, enum: ["Point"], default: "Point" },
  coordinates: { type: [Number], required: true },
});

const rideSchema = new mongoose.Schema(
  {
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    passengers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    requests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    start: { type: String, required: true },
    end: { type: String, required: true },
    startLocation: { type: pointSchema, required: true },
    endLocation: { type: pointSchema, required: true },
    distanceKm: { type: Number, required: true },
    co2SavedKg: { type: Number, default: 0 },

    // 🟢 NEW FIELD
    capacity: { type: Number, default: 3, min: 1, max: 8 }, // example: driver + 2 ri

    status: {
      type: String,
      enum: ["Open", "Full", "Completed", "Cancelled"],
      default: "Open",
    },
  },
  { timestamps: true }
);

// 🔁 Auto update status based on capacity
rideSchema.pre("save", function (next) {
  if (this.passengers.length >= this.capacity) {
    this.status = "Full";
  } else if (this.status === "Full" && this.passengers.length < this.capacity) {
    this.status = "Open";
  }
  next();
});

// Enable geospatial indexing
rideSchema.index({ startLocation: "2dsphere" });
rideSchema.index({ endLocation: "2dsphere" });

export default mongoose.model("Ride", rideSchema);
