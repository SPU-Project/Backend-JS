import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { app, db } = require("../index.js");

describe("Sprint 0: Security & Baseline Verification", () => {
  beforeAll(async () => {
    // Pastikan koneksi DB test tersambung dan tabel disinkronkan
    await db.authenticate();
    await db.sync({ force: true });
  });

  afterAll(async () => {
    await db.close();
  });

  describe("1. Public Health Check Endpoint", () => {
    it("should return 200 OK on GET /health", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
    });
  });

  describe("2. Route Protection & Auth Guard", () => {
    it("should reject unauthenticated GET /bahanbaku with 401", async () => {
      const res = await request(app).get("/bahanbaku");
      expect(res.status).toBe(401);
      expect(res.body.msg).toContain("Akses ditolak");
    });

    it("should reject unauthenticated GET /users with 401", async () => {
      const res = await request(app).get("/users");
      expect(res.status).toBe(401);
      expect(res.body.msg).toContain("Akses ditolak");
    });

    it("should reject unauthenticated POST /upload-profile with 401 before upload processing", async () => {
      const res = await request(app)
        .post("/upload-profile")
        .attach("profileImage", Buffer.from("fake image"), "test.png");
      expect(res.status).toBe(401);
    });
  });

  describe("3. Authentication Hardening", () => {
    it("should return 400 when login payload is missing", async () => {
      const res = await request(app).post("/login").send({});
      expect(res.status).toBe(400);
      expect(res.body.msg).toContain("Email dan password wajib diisi");
    });

    it("should return 401 with unified message on invalid credentials", async () => {
      const res = await request(app).post("/login").send({
        email: "nonexistent@spu.co.id",
        password: "wrongpassword",
      });
      expect(res.status).toBe(401);
      expect(res.body.msg).toBe("Email atau password salah");
    });
  });

  describe("4. First-run Bootstrap & Session Lifecycle", () => {
    let sessionCookie;

    it("should allow creating the initial superadmin user when database is empty", async () => {
      const res = await request(app).post("/users").send({
        email: "superadmin@spu.co.id",
        username: "superadmin",
        password: "Password123!",
        confPassword: "Password123!",
        role: "superadmin",
      });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe(1);
      expect(res.body.data.email).toBe("superadmin@spu.co.id");
      expect(res.body.data.role).toBe("superadmin");
    });

    it("should block creating another user anonymously once a user exists", async () => {
      const res = await request(app).post("/users").send({
        email: "intruder@spu.co.id",
        username: "intruder",
        password: "Password123!",
        confPassword: "Password123!",
        role: "superadmin",
      });

      expect(res.status).toBe(401);
      expect(res.body.msg).toContain("Akses ditolak");
    });

    it("should login successfully with the new superadmin and set session cookie", async () => {
      const res = await request(app).post("/login").send({
        email: "superadmin@spu.co.id",
        password: "Password123!",
      });

      expect(res.status).toBe(200);
      expect(res.body.msg).toBe("Login success");
      expect(res.body.id).toBe(1);

      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      sessionCookie = cookies[0];
    });

    it("should access protected /bahanbaku with valid session cookie", async () => {
      const res = await request(app)
        .get("/bahanbaku")
        .set("Cookie", sessionCookie);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Daftar Bahan Baku");
    });
  });
});
