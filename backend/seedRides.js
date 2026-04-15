import mongoose from "mongoose";
import dotenv from "dotenv";
import Ride from "./models/Ride.js";
import User from "./models/User.js";

dotenv.config();

const seedRides = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");

    await Ride.deleteMany();

    const drivers = await User.find({ role: "Driver" });
    if (!drivers.length) {
      console.log("❌ No drivers found. Please register at least one driver first.");
      process.exit(1);
    }

    const randomDriver = () => drivers[Math.floor(Math.random() * drivers.length)]._id;

    const chennaiRides = [
      { start: "T Nagar", end: "Velachery", distanceKm: 9, co2SavedKg: 1.2, coords: [[80.2345, 13.0418], [80.2180, 12.9790]] },
      { start: "Adyar", end: "OMR Navalur", distanceKm: 16, co2SavedKg: 2.3, coords: [[80.2560, 13.0008], [80.2198, 12.8425]] },
      { start: "Anna Nagar", end: "Guindy", distanceKm: 11, co2SavedKg: 1.6, coords: [[80.2066, 13.0878], [80.2209, 13.0106]] },
      { start: "Porur", end: "T Nagar", distanceKm: 10, co2SavedKg: 1.4, coords: [[80.1582, 13.0411], [80.2345, 13.0418]] },
      { start: "Tambaram", end: "Guindy", distanceKm: 22, co2SavedKg: 3.2, coords: [[80.1275, 12.9250], [80.2209, 13.0106]] },
      { start: "Ambattur", end: "Anna Nagar", distanceKm: 8, co2SavedKg: 1.1, coords: [[80.1616, 13.0983], [80.2066, 13.0878]] },
      { start: "Perambur", end: "T Nagar", distanceKm: 12, co2SavedKg: 1.8, coords: [[80.2459, 13.1177], [80.2345, 13.0418]] },
      { start: "Ennore", end: "Adyar", distanceKm: 26, co2SavedKg: 3.6, coords: [[80.3185, 13.2173], [80.2560, 13.0008]] },
      { start: "Mylapore", end: "Velachery", distanceKm: 10, co2SavedKg: 1.5, coords: [[80.2707, 13.0333], [80.2180, 12.9790]] },
      { start: "Guindy", end: "ECR Thiruvanmiyur", distanceKm: 8, co2SavedKg: 1.0, coords: [[80.2209, 13.0106], [80.2591, 12.9822]] },
      { start: "Sholinganallur", end: "Thoraipakkam", distanceKm: 6, co2SavedKg: 0.8, coords: [[80.2270, 12.9081], [80.2410, 12.9391]] },
      { start: "Velachery", end: "OMR Karapakkam", distanceKm: 9, co2SavedKg: 1.3, coords: [[80.2180, 12.9790], [80.2287, 12.9209]] },
      { start: "ECR Neelankarai", end: "Tidel Park", distanceKm: 11, co2SavedKg: 1.5, coords: [[80.2590, 12.9472], [80.2483, 12.9918]] },
      { start: "Teynampet", end: "Kilpauk", distanceKm: 7, co2SavedKg: 1.0, coords: [[80.2475, 13.0478], [80.2405, 13.0828]] },
      { start: "Guindy", end: "Pallavaram", distanceKm: 12, co2SavedKg: 1.6, coords: [[80.2209, 13.0106], [80.1415, 12.9698]] },
      { start: "Kodambakkam", end: "Saidapet", distanceKm: 5, co2SavedKg: 0.6, coords: [[80.2237, 13.0524], [80.2247, 13.0243]] },
      { start: "Poonamallee", end: "Porur", distanceKm: 6, co2SavedKg: 0.8, coords: [[80.0948, 13.0483], [80.1582, 13.0411]] },
      { start: "Medavakkam", end: "OMR Thoraipakkam", distanceKm: 10, co2SavedKg: 1.3, coords: [[80.1844, 12.9121], [80.2410, 12.9391]] },
      { start: "Avadi", end: "Ambattur", distanceKm: 8, co2SavedKg: 1.1, coords: [[80.1093, 13.1157], [80.1616, 13.0983]] },
      { start: "Perungudi", end: "Guindy", distanceKm: 9, co2SavedKg: 1.2, coords: [[80.2371, 12.9613], [80.2209, 13.0106]] },
      { start: "ECR Injambakkam", end: "Adyar", distanceKm: 17, co2SavedKg: 2.4, coords: [[80.2528, 12.8973], [80.2560, 13.0008]] },
      { start: "Velachery", end: "Medavakkam", distanceKm: 7, co2SavedKg: 1.0, coords: [[80.2180, 12.9790], [80.1844, 12.9121]] },
    ];

    const rides = chennaiRides.map((r) => ({
      driver: randomDriver(),
      start: r.start,
      end: r.end,
      distanceKm: r.distanceKm,
      co2SavedKg: r.co2SavedKg,
      startLocation: { type: "Point", coordinates: r.coords[0] },
      endLocation: { type: "Point", coordinates: r.coords[1] },
      passengers: [],
      status: "Open",
    }));

    await Ride.insertMany(rides);
    console.log(`✅ Seeded ${rides.length} Chennai rides successfully!`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  }
};

seedRides();
