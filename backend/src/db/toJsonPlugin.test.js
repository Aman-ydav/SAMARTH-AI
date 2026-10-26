import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { toJsonPlugin } from "./toJsonPlugin.js";

const schema = new mongoose.Schema({
    name: { type: String, trim: true, maxlength: 50 },
    passwordHash: { type: String, select: false, trim: true, maxlength: 100 },
    tokenHash: { type: String, select: false, trim: true, maxlength: 100 },
});
schema.plugin(toJsonPlugin);
const Person = mongoose.model("JsonPerson", schema, "jsonPeople");

describe("toJsonPlugin (DB-13)", () => {
    const doc = new Person({
        name: "Asha",
        passwordHash: "hash",
        tokenHash: "tok",
    });

    it("renames _id to id and drops __v", () => {
        const json = doc.toJSON();
        expect(json.id).toBe(String(doc._id));
        expect(json).not.toHaveProperty("_id");
        expect(json).not.toHaveProperty("__v");
        expect(json.name).toBe("Asha");
    });

    it("removes every select:false field even when it was loaded", () => {
        const json = doc.toJSON();
        expect(json).not.toHaveProperty("passwordHash");
        expect(json).not.toHaveProperty("tokenHash");
        expect(JSON.stringify(doc)).not.toContain("hash");
    });
});
