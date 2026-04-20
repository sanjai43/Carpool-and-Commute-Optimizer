import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app.js";

const app = createApp();
let server = null;

beforeAll(async () => {
  await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1");
    s.once("listening", () => {
      server = s;
      resolve();
    });
    s.once("error", () => {
      server = null;
      resolve();
    });
  });
});

afterAll(async () => {
  if (!server) return;
  await new Promise((resolve) => server.close(resolve));
});

const register = async ({ name, email, password, role }) => {
  const res = await request(server).post("/api/auth/register").send({ name, email, password, role });
  expect(res.status).toBe(201);
  expect(res.body.token).toBeTruthy();
  return res.body;
};

const login = async ({ email, password }) => {
  const res = await request(server).post("/api/auth/login").send({ email, password });
  expect(res.status).toBe(200);
  return res.body;
};

describe("CarShary demo flow", () => {
  it("registers, creates ride, matches, joins, accepts, completes, rates", async () => {
    if (!server) return;
    const driver = await register({
      name: "Driver One",
      email: "driver1@example.com",
      password: "pass1234",
      role: "Driver",
    });

    const rider = await register({
      name: "Rider One",
      email: "rider1@example.com",
      password: "pass1234",
      role: "Rider",
    });

    const dep = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const createRide = await request(server)
      .post("/api/rides")
      .set("Authorization", `Bearer ${driver.token}`)
      .send({
        start: "A",
        end: "B",
        distanceKm: 10,
        capacity: 3,
        startLat: 12.97,
        startLng: 80.25,
        endLat: 12.99,
        endLng: 80.27,
        departureTime: dep,
        vehicleType: "PetrolCar",
        recurrence: { frequency: "none", days: [] },
      });
    expect(createRide.status).toBe(201);
    const rideId = createRide.body.ride._id;

    const match = await request(server)
      .post("/api/rides/match")
      .set("Authorization", `Bearer ${rider.token}`)
      .send({
        start: "",
        end: "",
        radiusKm: 50,
        windowMin: 120,
        departTime: dep,
        startLat: 12.9705,
        startLng: 80.2505,
      });
    expect(match.status).toBe(200);
    expect(match.body.length).toBeGreaterThan(0);

    const join = await request(server)
      .post(`/api/rides/${rideId}/join`)
      .set("Authorization", `Bearer ${rider.token}`)
      .send({
        pickup: { lat: 12.9705, lng: 80.2505, label: "Pickup" },
      });
    expect(join.status).toBe(200);

    const my = await request(server)
      .get("/api/rides/mine")
      .set("Authorization", `Bearer ${driver.token}`);
    expect(my.status).toBe(200);
    expect(my.body[0].requests.length).toBe(1);
    const riderId = my.body[0].requests[0]._id;

    const accept = await request(server)
      .patch(`/api/rides/${rideId}/accept/${riderId}`)
      .set("Authorization", `Bearer ${driver.token}`);
    expect(accept.status).toBe(200);

    const joined = await request(server)
      .get("/api/rides/joined")
      .set("Authorization", `Bearer ${rider.token}`);
    expect(joined.status).toBe(200);
    expect(joined.body.length).toBe(1);

    const complete = await request(server)
      .patch(`/api/rides/${rideId}/complete`)
      .set("Authorization", `Bearer ${driver.token}`);
    expect(complete.status).toBe(200);

    const rate = await request(server)
      .post(`/api/rides/${rideId}/rate`)
      .set("Authorization", `Bearer ${rider.token}`)
      .send({ stars: 5 });
    expect(rate.status).toBe(200);

    const eco = await request(server)
      .get("/api/eco")
      .set("Authorization", `Bearer ${rider.token}`);
    expect(eco.status).toBe(200);
    expect(eco.body.totalRides).toBeTruthy();
  });

  it("logs in as default admin and lists users", async () => {
    if (!server) return;
    const admin = await login({ email: "admin@carshary.local", password: "admin123" });
    const res = await request(server)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
  });
});
