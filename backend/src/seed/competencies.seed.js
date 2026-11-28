import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Competency, RoleProfile } from "#modules/competency/competency.model.js";
import { Course } from "#modules/learning/course.model.js";
import { Quiz } from "#modules/assessment/quiz.model.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");

async function loadJson(filename) {
    const raw = await readFile(path.join(DATA_DIR, filename), "utf-8");
    return JSON.parse(raw);
}

export async function seed({ log } = {}) {
    // 1. Competencies
    const competencies = await loadJson("competencies.json");
    for (const c of competencies) {
        await Competency.findByIdAndUpdate(c._id, c, { upsert: true });
    }
    log?.info?.({ count: competencies.length }, "Competencies seeded");

    // 2. Role Profiles
    const roles = await loadJson("roleProfiles.json");
    for (const r of roles) {
        await RoleProfile.findByIdAndUpdate(r._id, r, { upsert: true });
    }
    log?.info?.({ count: roles.length }, "Role profiles seeded");

    // 3. Courses
    const courses = await loadJson("courses.json");
    for (const c of courses) {
        await Course.findByIdAndUpdate(c._id, c, { upsert: true });
    }
    log?.info?.({ count: courses.length }, "Courses seeded");

    // 4. Quizzes
    const quizzes = await loadJson("quizzes.json");
    for (const q of quizzes) {
        await Quiz.findByIdAndUpdate(q._id, q, { upsert: true });
    }
    log?.info?.({ count: quizzes.length }, "Quizzes seeded");
}
